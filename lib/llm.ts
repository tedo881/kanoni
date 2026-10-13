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

type Provider = { base: string; key?: string; header: string; query: string; model: string; local: boolean; native: boolean };

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

async function call(messages: Msg[], stream: boolean, signal?: AbortSignal, onAttempt?: AttemptHook) {
  const ps = providers().filter((p) => p.key || p.local);
  let last: unknown = new LlmError("AI მოდელი არ არის მიერთებული");
  const errs: string[] = [];
  for (const p of ps) {
    const models = p.model.split(",").map((m) => m.trim()).filter(Boolean);
    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          onAttempt?.(modelLabel(p.base, model));
          return await callOne({ ...p, model }, messages, stream, signal);
        } catch (e) {
          if (signal?.aborted) throw e;
          last = e;
          const st = e instanceof LlmError ? e.status : 0;
          if (attempt === 1 || st !== 503) {
            errs.push(`[${model}] ${e instanceof Error ? e.message : String(e)}`);
            break;
          }
          await sleep(1200);
        }
      }
    }
  }
  if (errs.length > 1 && last instanceof LlmError) throw new LlmError(errs.join("  |  "), last.status);
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

export async function* streamChat(messages: Msg[], signal?: AbortSignal, onAttempt?: AttemptHook): AsyncGenerator<string> {
  const { res, native } = await call(messages, true, signal, onAttempt);
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const j = JSON.parse(payload);
        const delta = native ? geminiText(j) : j?.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch {
        /* არასრული JSON — გამოვტოვოთ */
      }
    }
  }
}