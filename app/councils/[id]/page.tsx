import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getDoc,
  getDocHtml,
  getDocs,
  isHiddenDoc,
  unitName,
  type Doc,
} from "@/lib/data";
import Reader from "@/components/Reader";

export function generateStaticParams() {
  return (getDocs().docs as Doc[])
    .filter((d) => !isHiddenDoc(d.id))
    .map((d) => ({ id: String(d.id) }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const d = getDoc(Number((await params).id));
  return { title: d?.title ?? "კრება" };
}

export default async function CouncilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  const doc = getDoc(id);
  if (!doc || isHiddenDoc(id)) notFound();
  // მცირე სჯულის კანონში წინა/შემდეგი არ არის (ახალი/ძველი ტექსტის გადამრთველია); ეკლესიის სამართალში — ჯგუფის შიგნით
  const grp = getDocs().groups.find((g: { id: string }) => g.id === doc.group);
  const gi = grp ? grp.docs.indexOf(id) : -1;
  const standalone = doc.group === "mcire";
  const inGroup =
    doc.group === "churchlaw" ||
    doc.group === "synod" ||
    doc.group === "boumis";
  const prev = standalone
    ? undefined
    : inGroup
      ? getDoc(grp.docs[gi - 1])
      : getDoc(id - 1);
  const next = standalone
    ? undefined
    : inGroup
      ? getDoc(grp.docs[gi + 1])
      : getDoc(id + 1);
  const alt = doc.alt ? getDoc(doc.alt) : undefined;
  return (
    <>
      <div className="crumbs">
        {doc.group === "boumis" ? (
          <Link href="/boumis">← კანონიკური სამართალი</Link>
        ) : inGroup ? (
          <Link href="/church-law">← საქართველოს ეკლესიის სამართალი</Link>
        ) : (
          <Link href="/councils">← კრებები</Link>
        )}
      </div>
      <h1 className="reader-title">{doc.title}</h1>
      <Reader
        docId={doc.id}
        html={getDocHtml(id)}
        canons={doc.canons}
        inline={doc.comm?.inline ?? []}
        hasComm={!!doc.comm}
        titles={doc.titles}
        unit={unitName(doc)}
        lang={
          doc.lang && alt?.lang
            ? {
                cur: { id: doc.id, label: doc.lang },
                other: { id: alt.id, label: alt.lang },
                map: doc.altMap ?? {},
              }
            : undefined
        }
      />
      {(prev || next) && (
        <nav className="pager" aria-label="წინა და შემდეგი">
          {prev ? (
            <Link href={`/councils/${prev.id}`}>
              <small>← წინა</small>
              {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/councils/${next.id}`} className="next">
              <small>შემდეგი →</small>
              {next.title}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
