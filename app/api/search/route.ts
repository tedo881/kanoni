import { retrieve } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 300) ?? "";
  if (q.trim().length < 2) return Response.json({ results: [] });
  const results = retrieve(q, { groups: 15, maxChars: 60000 }).map(({ n, label, href, kind, excerpt }) => ({ n, label, href, kind, excerpt }));
  return Response.json({ results });
}
