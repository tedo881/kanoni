"use client";
import { useEffect, useRef, useState } from "react";

type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

const MAX_SEC = 45;

/** ნებისმიერი აუდიო → 16kHz mono WAV (Gemini-ს სჭირდება სტანდარტული ფორმატი) */
async function toWav(blob: Blob): Promise<Blob> {
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AC();
  const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close?.();
  const rate = 16000;
  const off = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(audio.duration * rate)),
    rate,
  );
  const src = off.createBufferSource();
  src.buffer = audio;
  src.connect(off.destination);
  src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const w = (o: number, s: string) =>
    [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  out.setUint32(4, 36 + pcm.length * 2, true);
  w(8, "WAVEfmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 1, true);
  out.setUint32(24, rate, true);
  out.setUint32(28, rate * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  w(36, "data");
  out.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++)
    out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return new Blob([out], { type: "audio/wav" });
}

export default function Mic({
  getValue,
  setValue,
  disabled,
}: {
  getValue: () => string;
  setValue: (v: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<"idle" | "listening" | "processing">(
    "idle",
  );
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const rec = useRef<SR | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const useNative = useRef(true); // Web Speech ჯერ; ჩავარდნისას ჩაწერა+Gemini

  useEffect(() => {
    setOk(
      typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
    );
    return () => {
      rec.current?.abort();
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const join = (base: string, t: string) =>
    (base && t ? base.replace(/\s+$/, "") + " " : base) + t;

  function stop() {
    if (timer.current) clearTimeout(timer.current);
    if (mr.current && mr.current.state !== "inactive") mr.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  function startNative(): boolean {
    const C =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!C || isIOS || !useNative.current) return false;
    const r: SR = new C();
    r.lang = "ka-GE";
    r.interimResults = true;
    r.continuous = false;
    const base = getValue();
    let got = false,
      failed = false;
    r.onresult = (e: any) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++)
        t += e.results[i][0].transcript;
      got = true;
      setValue(join(base, t.trim()));
    };
    r.onerror = (e: any) => {
      failed = true;
      if (
        e.error === "language-not-supported" ||
        e.error === "service-not-allowed"
      ) {
        useNative.current = false;
        setErr("");
        void startRecorder();
        return;
      }
      if (e.error === "not-allowed")
        setErr("მიკროფონზე წვდომა დაბლოკილია — ბრაუზერის პარამეტრებში ჩართეთ.");
      else if (e.error === "no-speech") setErr("ხმა არ ისმის, სცადეთ თავიდან.");
      else if (e.error !== "aborted") setErr("ამოცნობა ვერ მოხერხდა.");
    };
    r.onend = () => {
      if (!failed) {
        if (!got) setErr((x) => x || "ხმა არ ისმის, სცადეთ თავიდან.");
        setState("idle");
      }
    };
    rec.current = r;
    try {
      r.start();
      setState("listening");
      return true;
    } catch {
      return false;
    }
  }

  async function startRecorder() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const chunks: Blob[] = [];
      const m = new MediaRecorder(s);
      mr.current = m;
      m.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      m.onstop = async () => {
        s.getTracks().forEach((t) => t.stop());
        setState("processing");
        try {
          const wav = await toWav(
            new Blob(chunks, { type: m.mimeType || "audio/webm" }),
          );
          const res = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "audio/wav" },
            body: wav,
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          if (j.text) setValue(join(getValue(), j.text));
          else setErr("ხმა არ ისმის, სცადეთ თავიდან.");
        } catch (e) {
          console.error("[mic]", e);
          setErr("ამოცნობა ვერ მოხერხდა.");
        } finally {
          setState("idle");
        }
      };
      m.start();
      setState("listening");
      timer.current = setTimeout(() => stop(), MAX_SEC * 1000);
    } catch (e) {
      console.error("[mic]", e);
      setErr("მიკროფონზე წვდომა დაბლოკილია — ბრაუზერის პარამეტრებში ჩართეთ.");
      setState("idle");
    }
  }

  async function toggle() {
    setErr("");
    if (state === "listening") {
      if (rec.current && useNative.current) rec.current.stop();
      else stop();
      return;
    }
    if (state !== "idle") return;
    if (!startNative()) await startRecorder();
  }

  if (!ok) return null;
  const listening = state === "listening";
  return (
    <>
      <button
        type="button"
        className={`mic${listening ? " on" : ""}`}
        onClick={toggle}
        disabled={disabled || state === "processing"}
        aria-label={listening ? "ჩაწერის შეწყვეტა" : "ხმით კითხვა"}
        title={listening ? "შეწყვეტა" : "ხმით კითხვა"}
        aria-pressed={listening}
      >
        {state === "processing" ? (
          <span className="dots">…</span>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3" />
          </svg>
        )}
      </button>
      {err && (
        <span className="mic-err" role="status">
          {err}
        </span>
      )}
    </>
  );
}
