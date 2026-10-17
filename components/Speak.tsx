"use client";
import { useEffect, useRef, useState } from "react";

/** Markdown/ციტირებების გარეშე, წასაკითხი ტექსტი */
function clean(t: string) {
  return t
    .replace(/\[(\d+)\]/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^\s*([-*•]|\d+[.)])\s+/gm, "")
    .replace(/[ \t  ]+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/** გრძელი ტექსტი მოკლე ნაწილებად (Chrome-ში გრძელი წაკითხვა წყდება) */
function chunks(t: string, max = 180): string[] {
  const out: string[] = [];
  for (const para of t.split(/\n+/)) {
    let cur = "";
    for (const s of para.match(/[^.!?…]+[.!?…]*\s*/g) ?? [para]) {
      if (cur && (cur + s).length > max) {
        out.push(cur.trim());
        cur = "";
      }
      cur += s;
      while (cur.length > max * 1.6) {
        const k = cur.lastIndexOf(" ", max);
        const at = k > 40 ? k : max;
        out.push(cur.slice(0, at).trim());
        cur = cur.slice(at);
      }
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out.filter(Boolean);
}

const pickVoice = () =>
  typeof speechSynthesis === "undefined"
    ? undefined
    : speechSynthesis.getVoices().find((v) => /^ka([-_]|$)/i.test(v.lang));

export default function Speak({ text }: { text: string }) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | undefined>();
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [err, setErr] = useState("");
  const run = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => {
    const upd = () => setVoice(pickVoice());
    if (typeof speechSynthesis !== "undefined") {
      upd();
      speechSynthesis.addEventListener?.("voiceschanged", upd);
    }
    return () => {
      run.current++;
      ctl.current?.abort();
      audio.current?.pause();
      if (typeof speechSynthesis !== "undefined") {
        speechSynthesis.removeEventListener?.("voiceschanged", upd);
        speechSynthesis.cancel();
      }
    };
  }, []);

  function stop() {
    run.current++;
    ctl.current?.abort();
    audio.current?.pause();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setState("idle");
  }

  function playBrowser(id: number) {
    const parts = chunks(clean(text));
    if (!parts.length) return;
    setState("playing");
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.voice = voice ?? null;
      u.lang = voice!.lang;
      u.rate = 0.95;
      u.onend = () => {
        if (i === parts.length - 1 && run.current === id) setState("idle");
      };
      u.onerror = () => {
        if (run.current === id) setState("idle");
      };
      speechSynthesis.speak(u);
    });
  }

  async function playGemini(id: number) {
    const parts = chunks(clean(text), 600);
    if (!parts.length) return;
    const c = (ctl.current = new AbortController());
    const fetchPart = async (p: string) => {
      const r = await fetch("/api/speak", {
        method: "POST",
        signal: c.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: p }),
      });
      if (!r.ok)
        throw new Error(
          (await r.json().catch(() => ({}))).error || `HTTP ${r.status}`,
        );
      return URL.createObjectURL(await r.blob());
    };
    setState("loading");
    try {
      let next = fetchPart(parts[0]);
      for (let i = 0; i < parts.length; i++) {
        const url = await next;
        if (run.current !== id) {
          URL.revokeObjectURL(url);
          return;
        }
        if (i + 1 < parts.length) next = fetchPart(parts[i + 1]);
        const a = (audio.current = new Audio(url));
        setState("playing");
        await new Promise<void>((res, rej) => {
          a.onended = () => res();
          a.onerror = () => rej(new Error("audio"));
          a.play().catch(rej);
        });
        URL.revokeObjectURL(url);
        if (run.current !== id) return;
        if (i + 1 < parts.length) setState("loading");
      }
      if (run.current === id) setState("idle");
    } catch (e) {
      if (run.current !== id || (e as Error).name === "AbortError") return;
      console.error("[speak]", e);
      setErr(
        e instanceof Error && e.message && e.message !== "audio"
          ? e.message
          : "გახმოვანება ვერ მოხერხდა",
      );
      setState("idle");
    }
  }

  function play() {
    setErr("");
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    audio.current?.pause();
    const id = ++run.current;
    if (voice) playBrowser(id);
    else void playGemini(id);
  }

  const on = state !== "idle";
  return (
    <>
      <button
        type="button"
        className={`speak${on ? " on" : ""}`}
        onClick={on ? stop : play}
        aria-pressed={on}
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {on ? (
            <rect x="6" y="6" width="12" height="12" rx="2" />
          ) : (
            <>
              <path d="M11 5 6 9H3v6h3l5 4z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
            </>
          )}
        </svg>
        {state === "loading" ? "იტვირთება…" : on ? "შეჩერება" : "მოსმენა"}
      </button>
      {err && (
        <span className="speak-err" role="status">
          {" "}
          {err}
        </span>
      )}
    </>
  );
}
