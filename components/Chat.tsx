"use client";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

type Src = {
  n: number;
  label: string;
  href?: string;
  kind: string;
  excerpt: string;
};
type M = {
  role: "user" | "assistant";
  content: string;
  sources?: Src[];
  info?: string;
  error?: string;
  pending?: boolean;
};

const SUGGESTIONS = [
  "შეუძლია თუ არა მღვდელს მეორედ დაქორწინება?",
  "რა სასჯელი ადევს ფულით ხელდასხმას (სიმონიას)?",
  "რამდენი ეპისკოპოსი აკურთხებს ახალ ეპისკოპოსს?",
  "რას ამბობს ლაოდიკიის კრება შაბათისა და კვირის შესახებ?",
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
  const blocks = text.split(/\n{2,}/);
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

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history = [
      ...msgs.filter((m) => !m.error),
      { role: "user", content: q } as M,
    ];
    setMsgs([...history, { role: "assistant", content: "", pending: true }]);
    setInput("");
    if (area.current) area.current.style.height = "auto";
    stick.current = true;
    setBusy(true);
    const ctl = (abort.current = new AbortController());
    const patch = (fn: (m: M) => M) =>
      setMsgs((all) => all.map((m, i) => (i === all.length - 1 ? fn(m) : m)));
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        signal: ctl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `შეცდომა ${res.status}`);
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
          if (ev.type === "sources")
            patch((m) => ({ ...m, sources: ev.sources }));
          else if (ev.type === "delta")
            patch((m) => ({ ...m, content: m.content + ev.text }));
          else if (ev.type === "info") patch((m) => ({ ...m, info: ev.text }));
          else if (ev.type === "error")
            patch((m) => ({ ...m, error: ev.message }));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        patch((m) => ({ ...m, error: (e as Error).message }));
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
                  {m.content ? (
                    <Answer text={m.content} idx={i} />
                  ) : m.pending && !m.info && !m.error ? (
                    <span className="dots">ვეძებ კანონებში</span>
                  ) : null}
                  {m.info && <div className="notice">{m.info}</div>}
                  {m.error && (
                    <div className="notice error" role="alert">
                      {m.error}
                    </div>
                  )}
                </>
              )}
            </div>
            {m.sources && m.sources.length > 0 && (
              <details className="sources" open={!!m.info}>
                <summary>წყაროები ({m.sources.length})</summary>
                {m.sources.map((s) => (
                  <div className="src" id={`src-${i}-${s.n}`} key={s.n}>
                    <div className="t">
                      <span className="badge">{s.n}</span>
                      {s.href ? <Link href={s.href}>{s.label}</Link> : s.label}
                    </div>
                    <p>{s.excerpt}…</p>
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
