import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 3_500_000; // Vercel-ის სხეულის ლიმიტი ~4.5MB

/** ხმის ამოცნობა Gemini-ით (ქართული). გასაღები: STT_API_KEY, ან LLM_API_KEY, თუ ის Gemini-სია. */
export async function POST(req: NextRequest) {
  const useLlm = /generativelanguage\.googleapis\.com/.test(process.env.LLM_BASE_URL || "");
  const key = process.env.STT_API_KEY || (useLlm ? process.env.LLM_API_KEY : "");
  if (!key) return NextResponse.json({ error: "ხმის ამოცნობა არ არის მოწყობილი (STT_API_KEY)" }, { status: 501 });

  const mime = (req.headers.get("content-type") || "audio/wav").split(";")[0];
  if (!mime.startsWith("audio/")) return NextResponse.json({ error: "არასწორი ფორმატი" }, { status: 415 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length < 800) return NextResponse.json({ text: "" });
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: "ჩანაწერი ძალიან გრძელია" }, { status: 413 });

  const model = process.env.STT_MODEL || "gemini-2.5-flash";
  const body = {
    contents: [{
      role: "user",
      parts: [
        { text: "ჩაწერე ამ აუდიოში ნათქვამი ქართულად, სიტყვასიტყვით, ზუსტი მართლწერით. ეს არის შეკითხვა მართლმადიდებლური ეკლესიის კანონიკური სამართლის თემაზე (კანონები, კრებები, ეპიტიმია, ხელდასხმა, ქორწინება და ა.შ.). დააბრუნე მხოლოდ ნათქვამის ტექსტი, ყოველგვარი კომენტარის გარეშე. თუ ხმა არ ისმის ან მეტყველება არ არის, დააბრუნე ცარიელი სტრიქონი." },
        { inline_data: { mime_type: mime, data: buf.toString("base64") } },
      ],
    }],
    generationConfig: { temperature: 0 },
  };
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) {
      console.error("[transcribe]", r.status, (await r.text()).slice(0, 300));
      return NextResponse.json({ error: "ამოცნობა ვერ მოხერხდა" }, { status: 502 });
    }
    const j = await r.json();
    const text = ((j?.candidates?.[0]?.content?.parts ?? []) as { text?: string }[]).map((p) => p.text ?? "").join("").trim();
    return NextResponse.json({ text });
  } catch (e) {
    console.error("[transcribe]", e);
    return NextResponse.json({ error: "ამოცნობა ვერ მოხერხდა" }, { status: 502 });
  }
}