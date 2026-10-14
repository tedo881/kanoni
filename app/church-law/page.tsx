import Link from "next/link";
import type { Metadata } from "next";
import {
  getDocs,
  isHiddenDoc,
  unitName,
  type Doc,
  type Group,
} from "@/lib/data";
import Hero from "@/components/Hero";
import Cross from "@/components/Cross";

export const metadata: Metadata = { title: "საქართველოს ეკლესიის სამართალი" };

const GROUPS = ["churchlaw", "synod", "boumis"]; // „boumis“ ჩანს მხოლოდ თუ SHOW_BOUMIS=1

export default function ChurchLaw() {
  const { groups, docs } = getDocs() as { groups: Group[]; docs: Doc[] };
  const byId = new Map(docs.map((d) => [d.id, d]));
  return (
    <>
      <Hero
        src="/img/sveti2.webp"
        alt=""
        tall
        title="საქართველოს ეკლესიის სამართალი"
      />
      {groups
        .filter(
          (g) => GROUPS.includes(g.id) && g.docs.some((id) => !isHiddenDoc(id)),
        )
        .map((g) => (
          <section key={g.id}>
            <div className="group-title">
              {g.title.replace("საქართველოს ეკლესიის სამართალი: ", "")}
            </div>
            <ol className="toc">
              {g.docs.map((id) => {
                const d = byId.get(id)!;
                return (
                  <li key={id}>
                    <Link href={`/councils/${id}`}>
                      <Cross />
                      {d.title}
                      {d.canons.length > 1 && (
                        <span className="meta">
                          {d.canons.length}{" "}
                          {d.group === "synod" ? "საკითხი" : unitName(d)}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
    </>
  );
}
