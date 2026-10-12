import { getCommentary, getDoc, refViews } from "@/lib/data";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const doc = Number(u.searchParams.get("doc"));
  const canon = Number(u.searchParams.get("canon"));
  const file = Number.isInteger(doc) ? getCommentary(doc) : null;
  const e = file?.entries.find((x) => x.n === canon);
  if (!file || !e) return Response.json({ error: "ვერ მოიძებნა" }, { status: 404 });
  return Response.json(
    {
      n: e.n, page: e.p, vol: e.v, canonText: e.t, refsRaw: e.r, paras: e.c,
      refs: refViews(e.x),
      allHref: `/councils/${doc}/commentary#n${e.n}`,
      docTitle: getDoc(doc)?.title,
    },
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } },
  );
}
