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

/** Float32 PCM (ნებისმიერი სიხშირე) → 16kHz mono WAV (Gemini-ს სჭირდება სტანდარტული ფორმატი) */
function pcmToWav(bufs: Float32Array[], inRate: number): Blob {
  let n = 0;
  for (const b of bufs) n += b.length;
  const all = new Float32Array(n);
  let o = 0;
  for (const b of bufs) {
    all.set(b, o);
    o += b.length;
  }
  const rate = 16000,
    ratio = inRate / rate,
    len = Math.floor(all.length / ratio);
  const pcm = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const a = Math.floor(i * ratio),
      z = Math.min(all.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let k = a; k < z; k++) sum += all[k];
    pcm[i] = z > a ? sum / (z - a) : (all[a] ?? 0);
  }
  const out = new DataView(new ArrayBuffer(44 + len * 2));
  const w = (off: number, str: string) =>
    [...str].forEach((c, i) => out.setUint8(off + i, c.charCodeAt(0)));
  w(0, "RIFF");
  out.setUint32(4, 36 + len * 2, true);
  w(8, "WAVEfmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 1, true);
  out.setUint32(24, rate, true);
  out.setUint32(28, rate * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  w(36, "data");
  out.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++)
    out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return new Blob([out], { type: "audio/wav" });
}

type Pcm = {
  ctx: AudioContext;
  proc: ScriptProcessorNode;
  src: MediaStreamAudioSourceNode;
  bufs: Float32Array[];
};

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
  const pcm = useRef<Pcm | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const useNative = useRef(true); // Web Speech ჯერ; ჩავარდნისას ჩაწერა+Gemini

  useEffect(() => {
    setOk(
      typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
    );
    return () => {
      rec.current?.abort();
      stop(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const join = (base: string, t: string) =>
    (base && t ? base.replace(/\s+$/, "") + " " : base) + t;

  /** ჩაწერის შეწყვეტა; send=false → ჩანაწერი იგდება (გვერდიდან გასვლა) */
  function stop(discard = false) {
    if (timer.current) clearTimeout(timer.current);
    const p = pcm.current;
    pcm.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (!p) return;
    p.proc.onaudioprocess = null;
    try {
      p.src.disconnect();
      p.proc.disconnect();
    } catch {}
    const rate = p.ctx.sampleRate;
    p.ctx.close?.().catch?.(() => {});
    if (!discard) void transcribe(p.bufs, rate);
  }

  async function transcribe(bufs: Float32Array[], rate: number) {
    setState("processing");
    try {
      if (!bufs.length) throw new Error("empty");
      const wav = pcmToWav(bufs, rate);
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
  }

  function startNative(): boolean {
    const C =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    // ქართულს Web Speech მხოლოდ Chrome/Edge-ში ცნობს; Safari-ში (Mac/iPhone) ჩაწერა + Gemini
    const ua = navigator.userAgent;
    const chromium =
      /Chrome\/|Edg\/|CriOS/.test(ua) && !/iPad|iPhone|iPod/.test(ua);
    if (!C || !chromium || !useNative.current) return false;
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
        e.error !== "not-allowed" &&
        e.error !== "no-speech" &&
        e.error !== "aborted"
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

  // ჩაწერა პირდაპირ AudioContext-ით (MediaRecorder/decodeAudioData iPhone-ზე არასანდოა)
  async function startRecorder() {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    let ctx: AudioContext | null = null;
    try {
      ctx = new AC();
      void ctx.resume?.(); // iOS-ზე უნდა დაიწყოს ღილაკზე დაჭერისას, სანამ await-ს მივაწვდით
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      stream.current = s;
      await ctx.resume?.();
      const src = ctx.createMediaStreamSource(s);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const bufs: Float32Array[] = [];
      proc.onaudioprocess = (e) => {
        bufs.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      const mute = ctx.createGain();
      mute.gain.value = 0;
      src.connect(proc);
      proc.connect(mute);
      mute.connect(ctx.destination);
      pcm.current = { ctx, proc, src, bufs };
      setState("listening");
      timer.current = setTimeout(() => stop(), MAX_SEC * 1000);
    } catch (e) {
      console.error("[mic]", e);
      ctx?.close?.().catch?.(() => {});
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
