/**
 * OpenAI-თავსებადი Chat Completions კლიენტი (Gemini, Groq, OpenRouter, Ollama, Azure OpenAI ...).
 *
 * პროვაიდერები (პირველი არასაჭირო/ჩავარდნის შემთხვევაში მეორეზე გადადის):
 *   LLM_*  — ძირითადი   (BASE_URL, API_KEY, MODEL, API_KEY_HEADER, QUERY_PARAMS)
 *   LLM2_* — სარეზერვო  (იგივე ველები) — მაგ. უფასო ლიმიტის ამოწურვისას
 * ჰოსტინგზე გასაღებები უნდა იყოს გარემოს ცვლადებში (არასოდეს კოდში).
 */
export type Msg = { role: "system" | "user" | "assistant"; content: string };

const DEFAULT_BASE = "http://localhost:11434/v1"; // ლოკალური Ollama (`npm run setup:ai`)
const DEFAULT_LOCAL_MODEL = "kanoni-gemma";

type Provider = { base: string; key?: string; header: string; query: string; model: string; local: boolean; native: boolean; maxChars: number };

const isLocalUrl = (u: string) => /localhost|127\.0\.0\.1|\[::1\]/.test(u);

function fromEnv(prefix: "LLM" | "LLM2"): Provider | null {
  const e = process.env;
  const base = (e[`${prefix}_BASE_URL`] || (prefix === "LLM" ? DEFAULT_BASE : "")).replace(/\/+$/, "");
  if (!base) return null;
  const local = isLocalUrl(base);
  const key = e[`${prefix}_API_KEY`] || undefined;
  if (prefix === "LLM2" && !key && !local) return null;
  // Google-ის ახალი „AQ.“ გასაღებები OpenAI-თავსებად მისამართზე არ მუშაობს — ვიყენებთ Gemini-ს ძირითად API-ს
  const native =
    e[`${prefix}_API_STYLE`] === "gemini" || (/generativelanguage\.googleapis\.com/.test(base) && !!key?.startsWith("AQ."));
  return {
    native,
    base,
    key,
    header: e[`${prefix}_API_KEY_HEADER`] || "Authorization",
    query: e[`${prefix}_QUERY_PARAMS`] ? `?${e[`${prefix}_QUERY_PARAMS`]}` : "",
    model: e[`${prefix}_MODEL`] || (local ? DEFAULT_LOCAL_MODEL : "gpt-4o-mini"),
    local,
    // სარეზერვო პროვაიდერს (მაგ. Groq-ის უფასო გეგმა) მცირე ლიმიტი აქვს — მასალას მისთვის ვამცირებთ (0 = შეუზღუდავი)
    maxChars: Number(e[`${prefix}_MAX_CHARS`]) || (prefix === "LLM2" && !local ? 5000 : 0),
  };
}
const providers = (): Provider[] => [fromEnv("LLM"), fromEnv("LLM2")].filter((p): p is Provider => !!p);

/** ძირითადი პროვაიდერი ლოკალურია (Ollama) და გასაღები არ აქვს */
export const llmIsLocal = () => {
  const p = providers()[0];
  return !!p && p.local && !p.key;
};
export const llmModel = () => providers()[0]?.model.split(",")[0].trim() ?? "";

const g = globalThis as unknown as { __llmProbe?: { at: number; ok: boolean } };

/** true, თუ რომელიმე პროვაიდერი მისაწვდომია: გასაღები მითითებულია ან ლოკალური სერვერი პასუხობს. */
export async function llmConfigured(): Promise<boolean> {
  const ps = providers();
  if (ps.some((p) => p.key)) return true;
  const local = ps.find((p) => p.local);
  if (!local) return false;
  const now = Date.now();
  if (g.__llmProbe && now - g.__llmProbe.at < 15_000) return g.__llmProbe.ok;
  let ok = false;
  try {
    ok = (await fetch(`${local.base}/models`, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    ok = false;
  }
  g.__llmProbe = { at: now, ok };
  return ok;
}

export class LlmError extends Error {
  constructor(message: string, readonly status = 0) {
    super(message);
  }
}

function headers(p: Provider): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (p.key) h[p.header] = p.header.toLowerCase() === "authorization" ? `Bearer ${p.key}` : p.key;
  return h;
}

function geminiBody(messages: Msg[]) {
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  return {
    ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}),
    contents,
    generationConfig: { temperature: 0.2 },
    // კანონებში ცოდვების, სასჯელების და მკვლელობის თემებია — ავტომატურმა ფილტრებმა პასუხი არ დაბლოკონ
    safetySettings: ["HARASSMENT", "HATE_SPEECH", "SEXUALLY_EXPLICIT", "DANGEROUS_CONTENT"].map((c) => ({
      category: `HARM_CATEGORY_${c}`,
      threshold: "BLOCK_NONE",
    })),
  };
}

async function callOne(p: Provider, messages: Msg[], stream: boolean, signal?: AbortSignal) {
  let res: Response;
  if (p.native) {
    const root = p.base.replace(/\/v1beta.*$/, "").replace(/\/v1\/?$/, "");
    const url = `${root}/v1beta/models/${p.model}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": p.key ?? "" },
      signal,
      body: JSON.stringify(geminiBody(messages)),
    });
  } else {
    res = await fetch(`${p.base}/chat/completions${p.query}`, {
      method: "POST",
      headers: headers(p),
      signal,
      body: JSON.stringify({ model: p.model, messages, stream, temperature: 0.2 }),
    });
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 300);
    throw new LlmError(`მოდელის სერვისმა დააბრუნა ${res.status}. ${body}`, res.status);
  }
  return { res, native: p.native };
}

const geminiText = (j: any): string =>
  (j?.candidates?.[0]?.content?.parts ?? []).map((x: { text?: string }) => x.text ?? "").join("");

/** ცდის პროვაიდერებს რიგით; გადადის შემდეგზე ლიმიტის (429), სერვერის (5xx), ავტორიზაციის (401/403) და ქსელის შეცდომისას */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * პროვაიდერებს რიგით ცდის. ყოველი პროვაიდერის MODEL შეიძლება იყოს მოდელების სია მძიმით გამოყოფილი
 * (მაგ. `gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite`): პირველი გადატვირთულია (503/429) — შემდეგს ცდის.
 * გადატვირთვის (503) შემთხვევაში იგივე მოდელს ერთხელ კიდევ ცდის მცირე პაუზის შემდეგ.
 */
/** მოდელის საჩვენებელი სახელი, მაგ. „Gemini 3.8 Flash“ ან „Groq · openai/gpt-oss-20b“ */
export function modelLabel(base: string, model: string): string {
  if (/^gemini-/i.test(model)) return model.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const prov = /groq/i.test(base) ? "Groq" : /openrouter/i.test(base) ? "OpenRouter" : /mistral/i.test(base) ? "Mistral"
    : /generativelanguage/i.test(base) ? "Gemini" : isLocalUrl(base) ? "ლოკალური" : (() => { try { return new URL(base).hostname; } catch { return base; } })();
  return `${prov} · ${model}`;
}

export type AttemptHook = (label: string) => void;

type Cand = { p: Provider; model: string };
const gcd = globalThis as unknown as { __llmCool?: Map<string, number> };
const cool = (gcd.__llmCool ??= new Map<string, number>());
const keyOf = (c: Cand) => `${c.p.base}|${c.model}`;

/** მოდელები რიგით; ახლახან ლიმიტზე (429) ან გადატვირთვაზე (503) ჩავარდნილებს დროებით ვტოვებთ, რომ დრო არ დავკარგოთ */
function candidates(): Cand[] {
  const all = providers()
    .filter((p) => p.key || p.local)
    .flatMap((p) => p.model.split(",").map((m) => m.trim()).filter(Boolean).map((model) => ({ p, model })));
  const now = Date.now();
  const ready = all.filter((c) => (cool.get(keyOf(c)) ?? 0) <= now);
  return ready.length ? ready : all;
}
function cooldown(c: Cand, status: number) {
  if (status === 429) cool.set(keyOf(c), Date.now() + 90_000);
  else if (status === 503) cool.set(keyOf(c), Date.now() + 20_000);
}

async function call(messages: Msg[], stream: boolean, signal?: AbortSignal, onAttempt?: AttemptHook) {
  const cands = candidates();
  let last: unknown = new LlmError("AI მოდელი არ არის მიერთებული");
  const errs: string[] = [];
  for (const c of cands) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        onAttempt?.(modelLabel(c.p.base, c.model));
        return await callOne({ ...c.p, model: c.model }, messages, stream, signal);
      } catch (e) {
        if (signal?.aborted) throw e;
        last = e;
        const st = e instanceof LlmError ? e.status : 0;
        if (attempt === 1 || st !== 503) {
          cooldown(c, st);
          errs.push(`[${c.model}] ${e instanceof Error ? e.message : String(e)}`);
          break;
        }
        await sleep(1200);
      }
    }
  }
  if (errs.length > 1) throw new LlmError(errs.join("  |  "), last instanceof LlmError ? last.status : 0);
  throw last;
}

export async function complete(messages: Msg[], timeoutMs = 9000, onAttempt?: AttemptHook): Promise<string> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const { res, native } = await call(messages, false, ctl.signal, onAttempt);
    const j = await res.json();
    return native ? geminiText(j) : (j?.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(t);
  }
}

/**
 * პასუხის ნაკადი. თუ მოდელმა 200-ით დაგვიბრუნა, მაგრამ ტექსტი არ მოაწოდა (დაბლოკვა, მხოლოდ „ფიქრი“ და ა.შ.),
 * ეს ჩავარდნად ითვლება და შემდეგ მოდელზე გადადის (სანამ მომხმარებელს რამე გავუგზავნეთ).
 */
export type StreamOpts = { deadline?: number; firstByteMs?: number };

/** ბოლო მომხმარებლის შეტყობინებაში „ფრაგმენტებს“ ვამოკლებთ max სიმბოლომდე (წყაროები მნიშვნელობის რიგით რჩება) */
function fitMessages(messages: Msg[], max: number): Msg[] {
  if (!max) return messages;
  const li = messages.length - 1;
  const last = messages[li];
  if (!last || last.role !== "user") return messages;
  const m = last.content.match(/^ფრაგმენტები:\n\n([\s\S]*?)\n\n-----\nკითხვა: ([\s\S]*)$/);
  if (!m || m[1].length <= max) return messages;
  const keep: string[] = [];
  let used = 0;
  for (const b of m[1].split("\n\n=====\n\n")) {
    if (used + b.length > max) {
      if (!keep.length) keep.push(b.slice(0, max)); // პირველი წყარო მაინც დარჩეს
      break;
    }
    keep.push(b);
    used += b.length;
  }
  const trimmed: Msg = { ...last, content: `ფრაგმენტები:\n\n${keep.join("\n\n=====\n\n")}\n\n-----\nკითხვა: ${m[2]}` };
  // ისტორიასაც ვამოკლებთ (ბოლო 2 შეტყობინება)
  const hist = messages.slice(0, li).filter((x) => x.role !== "system");
  return [...messages.filter((x) => x.role === "system"), ...hist.slice(-2), trimmed];
}

export async function* streamChat(messages: Msg[], signal?: AbortSignal, onAttempt?: AttemptHook, opts: StreamOpts = {}): AsyncGenerator<string> {
  const cands = candidates();
  if (!cands.length) throw new LlmError("AI მოდელი არ არის მიერთებული");
  const deadline = opts.deadline ?? Date.now() + 54_000; // ჰოსტინგის 60-წამიანი ლიმიტის წინ ვასრულებთ
  const firstByteMs = opts.firstByteMs ?? Number(process.env.LLM_FIRST_BYTE_MS ?? 20_000); // ამდენ ხანში პირველი ტექსტი თუ არ მოვიდა — შემდეგ მოდელზე გადავდივართ
  const errs: string[] = [];
  let lastStatus = 0;
  outer: for (const c of cands) {
    const { p, model } = c;
    const base = fitMessages(messages, p.maxChars);
    let cur = base;
    let softened = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const remain = deadline - Date.now();
      if (remain < 4000) {
        errs.push("დროის ბიუჯეტი ამოიწურა");
        break outer;
      }
      let yielded = false;
      const ctl = new AbortController();
      const onAbort = () => ctl.abort();
      signal?.addEventListener("abort", onAbort);
      let timedOut = false;
      let timer = setTimeout(() => { timedOut = true; ctl.abort(); }, Math.min(firstByteMs, remain));
      try {
        onAttempt?.(modelLabel(p.base, model));
        const { res, native } = await callOne({ ...p, model }, cur, true, ctl.signal);
        const meta = new Set<string>();
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";
        const handle = (line: string): string => {
          if (!line.startsWith("data:")) return "";
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") return "";
          try {
            const j = JSON.parse(payload);
            if (native) {
              if (j?.promptFeedback?.blockReason) meta.add(`blockReason=${j.promptFeedback.blockReason}`);
              const fr = j?.candidates?.[0]?.finishReason;
              if (fr && fr !== "STOP") meta.add(`finishReason=${fr}`);
              return geminiText(j);
            }
            const ch = j?.choices?.[0];
            if (ch?.finish_reason && ch.finish_reason !== "stop") meta.add(`finish_reason=${ch.finish_reason}`);
            if (ch?.delta?.reasoning || ch?.delta?.reasoning_content) meta.add("მხოლოდ მსჯელობა, ტექსტის გარეშე");
            return (ch?.delta?.content as string) || "";
          } catch {
            return ""; // არასრული JSON
          }
        };
        const first = () => {
          if (!yielded) {
            yielded = true;
            clearTimeout(timer);
            // პირველი ტექსტის შემდეგ მხოლოდ საერთო ვადა გვზღუდავს
            timer = setTimeout(() => { timedOut = true; ctl.abort(); }, Math.max(deadline - Date.now(), 1000));
          }
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            const d = handle(line);
            if (d) {
              first();
              yield d;
            }
          }
        }
        const tail = handle(buf.trim());
        if (tail) {
          first();
          yield tail;
        }
        if (yielded) return;
        const why = [...meta].join(", ");
        // დაბლოკვა/„გადმოწერის“ ფილტრი: იმავე მოდელს ერთხელ კიდევ ვცდით, მოკლე ციტატებისა და საკუთარი სიტყვების მოთხოვნით
        if (!softened && /RECITATION|SAFETY|PROHIBITED|content_filter/i.test(why)) {
          softened = true;
          errs.push(`[${model}] ცარიელი პასუხი (${why}) — ვიმეორებ შერბილებული მოთხოვნით`);
          cur = base.map((m, i) =>
            i === base.length - 1 && m.role === "user"
              ? { ...m, content: m.content + "\n\n(შენიშვნა: პასუხი შეადგინე საკუთარი სიტყვებით და მხოლოდ მოკლე ციტატებით; დიდი ტექსტი სიტყვასიტყვით არ გადმოწერო.)" }
              : m,
          );
          attempt = -1;
          continue;
        }
        errs.push(`[${model}] ცარიელი პასუხი${why ? ` (${why})` : ""}`);
        lastStatus = 0;
        break; // შემდეგი მოდელი
      } catch (e) {
        if (signal?.aborted || yielded) throw e;
        const st = timedOut ? 0 : e instanceof LlmError ? e.status : 0;
        lastStatus = st;
        if (timedOut) {
          cool.set(keyOf(c), Date.now() + 30_000);
          errs.push(`[${model}] პასუხი დროზე ვერ მოვიდა`);
          break;
        }
        if (attempt === 1 || st !== 503) {
          cooldown(c, st);
          errs.push(`[${model}] ${e instanceof Error ? e.message : String(e)}`);
          break;
        }
        await sleep(1200);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    }
  }
  throw new LlmError(errs.join("  |  "), lastStatus);
}