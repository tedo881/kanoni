import { retrieve } from "@/lib/search";
import { snippet } from "@/lib/highlight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 300) ?? "";
  if (q.trim().length < 2) return Response.json({ results: [] });
  const results = retrieve(q, { groups: 15, maxChars: 60000 }).map(({ n, label, href, kind, excerpt, passages }) => {
    // ფრაგმენტი, სადაც ნაპოვნი სიტყვა ჩანს
    let sn: string | null = null;
    for (const p of passages) { sn = snippet(p.text, q); if (sn) break; }
    return { n, label, href, kind, excerpt: sn ?? excerpt, hit: !!sn };
  });
  return Response.json({ results });
}