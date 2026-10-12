import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCommentary, getDoc, getDocs, refViews, type Doc } from "@/lib/data";
import RefChips from "@/components/RefChips";

export function generateStaticParams() {
  return (getDocs().docs as Doc[]).filter((d) => d.comm).map((d) => ({ id: String(d.id) }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const d = getDoc(Number((await params).id));
  return { title: d ? `განმარტებები: ${d.title}` : "განმარტებები" };
}

export default async function CommentaryPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const doc = getDoc(id);
  const file = getCommentary(id);
  if (!doc || !file) notFound();
  const seen = new Map<number, number>();
  const entries = file.entries.map((e) => {
    const c = (seen.get(e.n) ?? 0) + 1;
    seen.set(e.n, c);
    return { e, anchor: c === 1 ? `n${e.n}` : `n${e.n}-${c}` };
  });
  const canonical = entries.filter((x) => x.e.n > 0);
  return (
    <>
      <div className="crumbs"><Link href={`/councils/${id}`}>← {doc.title}</Link></div>
      <h1 className="reader-title">ნიკოდიმოსის (მილაშის) განმარტებები</h1>
      <p className="lead" style={{ marginTop: 0, textAlign: "center", marginInline: "auto" }}>
        {file.title} · ტ. {file.vol === 1 ? "I (2007)" : "II (2011)"}
      </p>
      <nav className="canon-nav" aria-label="კანონები">
        {canonical.map(({ e, anchor }) => <a key={anchor} href={`#${anchor}`} className="cn">{e.n}</a>)}
      </nav>
      <div className="comm-list">
        {entries.map(({ e, anchor }) => (
          <section key={anchor} id={anchor} className="comm-entry">
            <h3>{e.n === 0 ? "წინათქმა" : `კანონი ${e.n}`}</h3>
            {e.t && <p className="cm-canon"><strong>კანონი ნიკოდიმოსის თარგმანით:</strong> {e.t}</p>}
            {e.c.map((p, i) => <p key={i}>{p}</p>)}
            <RefChips refs={refViews(e.x)} />
            <p className="cm-foot">
              PDF გვ. {e.p}
              {e.n > 0 && doc.aligned && doc.canons.includes(e.n) && <> · <Link href={`/councils/${id}#k${e.n}`}>კანონის ტექსტი დიდ სჯულში →</Link></>}
            </p>
          </section>
        ))}
      </div>
      <p className="notice" style={{ marginTop: 24 }}>
        განმარტებების ტექსტი სკანირებული წიგნიდან ავტომატური ამოცნობით (OCR) არის მიღებული და ზოგჯერ შეიცავს უზუსტობებს.
        {!doc.aligned && " ამ კრების კანონების ნუმერაცია „დიდი სჯულის“ ნუმერაციისგან განსხვავდება, ამიტომ განმარტებები ცალკეა მოცემული."}
      </p>
    </>
  );
}
