import Link from "next/link";
import type { Metadata } from "next";
import { getDocs, unitName, type Doc, type Group } from "@/lib/data";
import Hero from "@/components/Hero";
import Cross from "@/components/Cross";

export const metadata: Metadata = { title: "კრებები და კანონები" };

export default function Councils() {
  const { groups, docs } = getDocs() as { groups: Group[]; docs: Doc[] };
  const byId = new Map(docs.map((d) => [d.id, d]));
  return (
    <>
      <Hero
        src="/img/hero-nicaea.webp"
        alt="ნიკეის I მსოფლიო კრების ხატი"
        title="დიდი სჯულის კანონი"
      />
      {groups
        .filter(
          (g) =>
            g.id !== "churchlaw" &&
            g.id !== "synod" &&
            g.id !== "boumis" &&
            g.id !== "ekkanon",
        )
        .map((g) => (
          <section key={g.id}>
            <div className="group-title">{g.title}</div>
            <ol className="toc">
              {g.docs.map((id) => {
                const d = byId.get(id)!;
                return (
                  <li key={id}>
                    <Link href={`/councils/${id}`}>
                      <Cross />
                      <span className="num">{id}</span>
                      {d.title}
                      {d.canons.length > 1 && (
                        <span className="meta">
                          {d.canons.length} {unitName(d)}
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
