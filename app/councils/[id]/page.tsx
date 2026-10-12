import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDoc, getDocHtml, getDocs, type Doc } from "@/lib/data";
import Reader from "@/components/Reader";

export function generateStaticParams() {
  return (getDocs().docs as Doc[]).map((d) => ({ id: String(d.id) }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const d = getDoc(Number((await params).id));
  return { title: d?.title ?? "კრება" };
}

export default async function CouncilPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const doc = getDoc(id);
  if (!doc) notFound();
  const prev = getDoc(id - 1);
  const next = getDoc(id + 1);
  return (
    <>
      <div className="crumbs"><Link href="/councils">← კრებები</Link></div>
      <h1 className="reader-title">{doc.title}</h1>
      <Reader docId={doc.id} html={getDocHtml(id)} canons={doc.canons} inline={doc.comm?.inline ?? []} hasComm={!!doc.comm} />
      <nav className="pager" aria-label="წინა და შემდეგი">
        {prev ? <Link href={`/councils/${prev.id}`}><small>← წინა</small>{prev.title}</Link> : <span />}
        {next ? <Link href={`/councils/${next.id}`} className="next"><small>შემდეგი →</small>{next.title}</Link> : <span />}
      </nav>
    </>
  );
}
