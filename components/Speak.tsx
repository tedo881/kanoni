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
  const [playing, setPlaying] = useState(false);
  const run = useRef(0);

  useEffect(() => {
    if (typeof speechSynthesis === "undefined") return;
    const upd = () => setVoice(pickVoice());
    upd();
    speechSynthesis.addEventListener?.("voiceschanged", upd);
    return () => {
      speechSynthesis.removeEventListener?.("voiceschanged", upd);
      run.current++;
      speechSynthesis.cancel();
    };
  }, []);

  if (!voice) return null; // ქართული ხმა მოწყობილობაზე არ არის — ღილაკს არ ვაჩვენებთ

  function stop() {
    run.current++;
    speechSynthesis.cancel();
    setPlaying(false);
  }
  function play() {
    speechSynthesis.cancel();
    const id = ++run.current;
    const parts = chunks(clean(text));
    if (!parts.length) return;
    setPlaying(true);
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.voice = voice ?? null;
      u.lang = voice!.lang;
      u.rate = 0.95;
      u.onend = () => {
        if (i === parts.length - 1 && run.current === id) setPlaying(false);
      };
      u.onerror = () => {
        if (run.current === id) setPlaying(false);
      };
      speechSynthesis.speak(u);
    });
  }

  return (
    <button
      type="button"
      className={`speak${playing ? " on" : ""}`}
      onClick={playing ? stop : play}
      aria-pressed={playing}
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
        {playing ? (
          <rect x="6" y="6" width="12" height="12" rx="2" />
        ) : (
          <>
            <path d="M11 5 6 9H3v6h3l5 4z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        )}
      </svg>
      {playing ? "შეჩერება" : "მოსმენა"}
    </button>
  );
}
