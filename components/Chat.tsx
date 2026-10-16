"use client";
import Mic from "./Mic";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

type Part = { comm: boolean; head: string; text: string };
type Src = {
  n: number;
  label: string;
  href?: string;
  kind: string;
  excerpt: string;
  commHref?: string;
  parts?: Part[];
  hidden?: boolean;
};
type M = {
  role: "user" | "assistant";
  content: string;
  sources?: Src[];
  info?: string;
  error?: string;
  pending?: boolean;
  stage?: "expand" | "search" | "ai";
  expandModel?: string;
  model?: string;
  ctx?: string;
  notes?: string[];
};

const SUGGESTIONS = [
  "შეუძლია თუ არა მღვდელს მეორედ დაქორწინება?",
  "რა სასჯელი ადევს ფულით ხელდასხმას (სიმონიას)?",
  "რამდენი ეპისკოპოსი აკურთხებს ახალ ეპისკოპოსს?",
];

function inline(text: string, msgIdx: number): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|(?:\[\d+\])+)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^(\[\d+\])+$/.test(part)) {
      return (
        <Fragment key={i}>
          {[...part.matchAll(/\[(\d+)\]/g)].map((m, k) => (
            <a key={k} className="cite" href={`#src-${msgIdx}-${m[1]}`}>
              {m[1]}
            </a>
          ))}
        </Fragment>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Answer({ text, idx }: { text: string; idx: number }) {
  // ზოგი მოდელი (Groq/gpt-oss) სიტყვებს შორის არატეხვად ინტერვალს სვამს — ტექსტი აღარ იმტვრევა და გადის ზღვარს
  const blocks = text
    .replace(/[\u00A0\u202F\u2007\u2060\uFEFF\u200B]/g, (c) =>
      c === "\u2060" || c === "\uFEFF" || c === "\u200B" ? "" : " ",
    )
    .split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter(Boolean);
        if (
          lines.length &&
          lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))
        ) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>
                  {inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""), idx)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l, idx)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

/** ძიებისა და დამუშავების ეტაპები პასუხის თავზე */
function Steps({ m }: { m: M }) {
  const order = { expand: 1, search: 2, ai: 3 } as const;
  const cur = m.stage ? order[m.stage] : 0;
  const writing = !!m.content;
  const rows: { done: boolean; text: string }[] = [];
  if (m.expandModel || m.stage === "expand") {
    rows.push({
      done: cur > 1,
      text: `საძიებო სიტყვების გაფართოება AI-ს მიერ${m.expandModel ? `: ${m.expandModel}` : ""}`,
    });
  }
  if (cur >= 2 || !m.stage) {
    rows.push({
      done: !!m.sources,
      text: m.sources
        ? `წყაროებში ძებნა (${m.sources.length} წყარო ნაპოვნია)`
        : "ვეძებ წყაროებში",
    });
  }
  if (cur >= 3) {
    const failed = !!m.error && !writing;
    const done = (writing || !m.pending) && !failed;
    rows.push({
      done,
      text: `${failed ? "ვერ დამუშავდა" : done ? "დამუშავებულია" : "მუშავდება"} AI-ს მიერ${m.model ? `: ${m.model}` : ""}`,
    });
  }
  for (const n of m.notes ?? [])
    rows.splice(Math.max(rows.length - 1, 0), 0, { done: true, text: n });
  if (!rows.length) return null;
  return (
    <div className="stages">
      {rows.map((r, k) => (
        <div key={k} className={`st${r.done ? " done" : ""}`}>
          {r.done ? "✓ " : ""}
          {r.done || !m.pending ? (
            r.text
          ) : (
            <span className="dots">{r.text}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Chat() {
  const [msgs, setMsgs] = useState<M[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true); // ქვემოთ ვართ? მაშინ პასუხს მივყვეთ, სხვა შემთხვევაში მომხმარებელს ხელს არ შევუშლით

  useEffect(() => {
    const onScroll = () => {
      stick.current =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 220;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (stick.current) bottom.current?.scrollIntoView({ block: "end" });
  }, [msgs]);

  function reset() {
    abort.current?.abort(); // მიმდინარე პასუხი შეწყდეს
    setMsgs([]);
    setInput("");
    setBusy(false);
    stick.current = true;
    if (area.current) area.current.style.height = "auto";
    window.scrollTo({ top: 0 });
  }

  async function send(
    text: string,
    base: M[] = msgs,
    reuse?: { sources: Src[]; ctx: string },
  ) {
    const q = text.trim();
    if (!q || busy) return;
    const history = [
      ...base.filter((m) => !m.error),
      { role: "user", content: q } as M,
    ];
    setMsgs([
      ...history,
      {
        role: "assistant",
        content: "",
        pending: true,
        ...(reuse
          ? { sources: reuse.sources, ctx: reuse.ctx, stage: "ai" as const }
          : {}),
      },
    ]);
    setInput("");
    if (area.current) area.current.style.height = "auto";
    stick.current = true;
    setBusy(true);
    const ctl = (abort.current = new AbortController());
    const patch = (fn: (m: M) => M) =>
      setMsgs((all) => all.map((m, i) => (i === all.length - 1 ? fn(m) : m)));
    const BUSY_MSG = "სერვერი გადატვირთულია, სცადეთ მოგვიანებით.";
    let gotText = false,
      gotInfo = false,
      failed = false,
      sawDone = false;
    const t0 = Date.now();
    const seen: string[] = [];
    let lastStage = "-",
      lastModel = "-";
    const fail = (detail: unknown) => {
      failed = true;
      console.error("[chat] შეცდომა:", detail);
      patch((m) => ({ ...m, error: BUSY_MSG }));
    };
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        signal: ctl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          ...(reuse ? { context: reuse.ctx } : {}),
        }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(`HTTP ${res.status}: ${j.error ?? "უცნობი შეცდომა"}`);
      }
      const reader = res.body.getReader();
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
          if (!line) continue;
          const ev = JSON.parse(line);
          seen.push(ev.type);
          if (ev.type === "stage") lastStage = ev.stage;
          if (ev.type === "model") lastModel = ev.label;
          if (ev.type === "done") sawDone = true;
          if (ev.type === "stage") patch((m) => ({ ...m, stage: ev.stage }));
          else if (ev.type === "model")
            patch((m) =>
              ev.for === "expand"
                ? { ...m, expandModel: ev.label }
                : { ...m, model: ev.label },
            );
          else if (ev.type === "note")
            patch((m) => ({ ...m, notes: [...(m.notes ?? []), ev.text] }));
          else if (ev.type === "sources")
            patch((m) => ({ ...m, sources: ev.sources, ctx: ev.ctx }));
          else if (ev.type === "delta") {
            gotText = true;
            patch((m) => ({ ...m, content: m.content + ev.text }));
          } else if (ev.type === "info") {
            gotInfo = true;
            patch((m) => ({ ...m, info: ev.text }));
          } else if (ev.type === "error") fail(ev.message);
        }
      }
      // ცარიელი პასუხი (სერვისმა არაფერი დააბრუნა)
      if (!gotText && !gotInfo && !failed && !ctl.signal.aborted)
        fail(
          `ცარიელი პასუხი | ეტაპი=${lastStage} | მოდელი=${lastModel} | done=${sawDone} | ${Date.now() - t0}ms | ივენთები=${seen.join(",")}`,
        );
    } catch (e) {
      if ((e as Error).name !== "AbortError") fail(e);
    } finally {
      patch((m) => ({ ...m, pending: false }));
      setBusy(false);
    }
  }

  return (
    <>
      {msgs.length === 0 && (
        <>
          <div className="chips" role="list">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="chip"
                role="listitem"
                onClick={() => send(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="chat" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble">
              {m.role === "user" ? (
                m.content
              ) : (
                <>
                  {(m.stage || m.pending) && !m.info && <Steps m={m} />}
                  {m.content ? <Answer text={m.content} idx={i} /> : null}
                  {m.info && <div className="notice">{m.info}</div>}
                  {m.error && (
                    <div className="notice error" role="alert">
                      {m.error}
                      {i === msgs.length - 1 &&
                        i > 0 &&
                        msgs[i - 1].role === "user" && (
                          <button
                            type="button"
                            className="retry"
                            disabled={busy}
                            onClick={() =>
                              send(
                                msgs[i - 1].content,
                                msgs.slice(0, i - 1),
                                m.sources?.length && m.ctx
                                  ? { sources: m.sources, ctx: m.ctx }
                                  : undefined,
                              )
                            }
                          >
                            ხელახლა ცდა
                          </button>
                        )}
                    </div>
                  )}
                </>
              )}
            </div>
            {m.sources && m.sources.length > 0 && (
              <details
                className="sources"
                open={!!m.info || (!!m.error && !m.content)}
              >
                <summary>წყაროები ({m.sources.length})</summary>
                {m.sources.map((s) => (
                  <div className="src" id={`src-${i}-${s.n}`} key={s.n}>
                    <div className="t">
                      <span className="badge">{s.n}</span>
                      {s.href ? <Link href={s.href}>{s.label}</Link> : s.label}
                    </div>
                    {s.parts?.length ? (
                      s.parts.map((p, k) => (
                        <div className={`part${p.comm ? " comm" : ""}`} key={k}>
                          <span className="ph">
                            {p.comm
                              ? "ნიკოდიმოსის განმარტება"
                              : p.head || "კანონის ტექსტი"}
                          </span>
                          <p>{p.text}…</p>
                        </div>
                      ))
                    ) : s.hidden ? null : (
                      <p>{s.excerpt}…</p>
                    )}
                    {s.commHref && (
                      <Link className="more" href={s.commHref}>
                        სრული განმარტება →
                      </Link>
                    )}
                  </div>
                ))}
              </details>
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <p className="disclaimer">
        პასუხი ეყრდნობა მხოლოდ მოძებნილ ფრაგმენტებს, მაგრამ შეიძლება შეიცავდეს
        უზუსტობას — გადაამოწმეთ ციტირებული წყაროები. ეს არ არის ეკლესიის
        ოფიციალური განმარტება.
      </p>
      <div className="composer">
        {msgs.length > 0 && (
          <button type="button" className="newchat" onClick={reset}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            ახალი საუბარი
          </button>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            ref={area}
            rows={1}
            value={input}
            enterKeyHint="send"
            placeholder="დასვით კითხვა…"
            aria-label="კითხვა"
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height =
                Math.min(e.target.scrollHeight, 160) + "px";
            }}
            onKeyDown={(e) => {
              // კომპიუტერზე Enter აგზავნის; ტელეფონზე (ეკრანული კლავიატურა) Enter ახალ ხაზს ნიშნავს
              const touch = window.matchMedia("(pointer: coarse)").matches;
              if (e.key === "Enter" && !e.shiftKey && !touch) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <Mic
            disabled={busy}
            getValue={() => input}
            setValue={(v) => {
              setInput(v);
              requestAnimationFrame(() => {
                const a = area.current;
                if (a) {
                  a.style.height = "auto";
                  a.style.height = Math.min(a.scrollHeight, 160) + "px";
                }
              });
            }}
          />
          {busy ? (
            <button
              type="button"
              className="btn ghost"
              onClick={() => abort.current?.abort()}
            >
              შეწყვეტა
            </button>
          ) : (
            <button className="btn" type="submit" disabled={!input.trim()}>
              გაგზავნა
            </button>
          )}
        </form>
      </div>
    </>
  );
}
