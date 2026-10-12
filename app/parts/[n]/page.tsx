import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDoc, getParts } from "@/lib/data";

export function generateStaticParams() {
  return getParts().map((p) => ({ n: String(p.n) }));
}
export async function generateMetadata({ params }: { params: Promise<{ n: string }> }): Promise<Metadata> {
  const { n } = await params;
  const p = getParts().find((x) => x.n === Number(n));
  return { title: p ? `ნაწილი ${p.roman}` : "ნაწილი" };
}

export default async function PartPage({ params }: { params: Promise<{ n: string }> }) {
  const n = Number((await params).n);
  const parts = getParts();
  const part = parts.find((p) => p.n === n);
  if (!part) notFound();
  const prev = parts.find((p) => p.n === n - 1);
  const next = parts.find((p) => p.n === n + 1);
  return (
    <>
      <div className="crumbs"><Link href="/parts">← კანონთა საძიებელი</Link></div>
      <h1 className="reader-title">ნაწილი {part.roman}</h1>
      <p className="lead" style={{ marginTop: 0, textAlign: "center", marginInline: "auto" }}>{part.title}</p>
      {part.chapters.map((ch, i) => (
        <section key={i} className="chapter">
          <h3>{ch.title}</h3>
          <ul className="refs">
            {ch.refs.map((r, j) => {
              const doc = r.doc ? getDoc(r.doc) : null;
              const linkable = doc && doc.canons.length > 0;
              return (
                <li key={j}>
                  {doc ? (
                    <>
                      <Link href={`/councils/${doc.id}`}>{r.label.replace(/\s*\d[\d\s,\-–]*$/, "")}</Link>
                      {r.canons.length > 0 && ": "}
                      {r.canons.map((c) =>
                        linkable && doc.canons.includes(c) ? (
                          <Link key={c} className="cn" href={`/councils/${doc.id}#k${c}`}>{c}</Link>
                        ) : (
                          <span key={c} className="cn">{c}</span>
                        ),
                      )}
                    </>
                  ) : (
                    r.raw
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <nav className="pager">
        {prev ? <Link href={`/parts/${prev.n}`}><small>← წინა</small>ნაწილი {prev.roman}</Link> : <span />}
        {next ? <Link href={`/parts/${next.n}`} className="next"><small>შემდეგი →</small>ნაწილი {next.roman}</Link> : <span />}
      </nav>
    </>
  );
}
