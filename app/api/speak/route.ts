import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_CHARS = 900;

/** PCM (s16le, 24kHz, mono) → WAV */
function wav(pcm: Buffer, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** ტექსტის გახმოვანება Gemini TTS-ით. გასაღები: STT_API_KEY, ან LLM_API_KEY, თუ ის Gemini-სია. */
export async function POST(req: NextRequest) {
  const useLlm = /generativelanguage\.googleapis\.com/.test(process.env.LLM_BASE_URL || "");
  const key = process.env.STT_API_KEY || (useLlm ? process.env.LLM_API_KEY : "");
  if (!key) return NextResponse.json({ error: "გახმოვანება არ არის მოწყობილი (STT_API_KEY)" }, { status: 501 });
  let text = "";
  try { text = String((await req.json())?.text ?? "").trim(); } catch { /* */ }
  if (!text) return NextResponse.json({ error: "ცარიელი ტექსტი" }, { status: 400 });
  text = text.slice(0, MAX_CHARS);

  const model = process.env.TTS_MODEL || "gemini-2.5-flash-preview-tts";
  const body = {
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: process.env.TTS_VOICE || "Kore" } } },
    },
  };
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) {
      console.error("[speak]", r.status, (await r.text()).slice(0, 300));
      return NextResponse.json({ error: r.status === 429 ? "ლიმიტი ამოიწურა, სცადეთ მოგვიანებით" : "გახმოვანება ვერ მოხერხდა" }, { status: 502 });
    }
    const j = await r.json();
    const parts = (j?.candidates?.[0]?.content?.parts ?? []) as { inlineData?: { data?: string } }[];
    const b64 = parts.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (!b64) { console.error("[speak] ცარიელი პასუხი", JSON.stringify(j).slice(0, 300)); return NextResponse.json({ error: "გახმოვანება ვერ მოხერხდა" }, { status: 502 }); }
    return new NextResponse(new Uint8Array(wav(Buffer.from(b64, "base64"))), { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[speak]", e);
    return NextResponse.json({ error: "გახმოვანება ვერ მოხერხდა" }, { status: 502 });
  }
}