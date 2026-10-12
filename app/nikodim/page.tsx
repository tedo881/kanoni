import Link from "next/link";
import type { Metadata } from "next";
import { getDocs, type Doc, type Group } from "@/lib/data";
import Cross from "@/components/Cross";

export const metadata: Metadata = {
  title: "ნიკოდიმოს მილაშის განმარტებები",
  description: "მართლმადიდებელი ეკლესიის კანონები ნიკოდიმოს მილაშის განმარტებებით",
};

export default function Nikodim() {
  const { groups, docs } = getDocs() as { groups: Group[]; docs: Doc[] };
  const byId = new Map(docs.map((d) => [d.id, d]));
  const total = docs.reduce((s, d) => s + (d.comm?.total ?? 0), 0);
  const count = docs.filter((d) => d.comm).length;
  return (
    <>
      <h1 style={{ textAlign: "center" }}>ნიკოდიმოს მილაშის განმარტებები</h1>
      <p style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 18px" }}>
        „მართლმადიდებელი ეკლესიის კანონები“ (ტომი I, 2007 და ტომი II, 2011) — კანონების განმარტებები ეპისკოპოს ნიკოდიმოს მილაშისა.
        აქ თავმოყრილია {total} განმარტება {count} კრებასა და მამათა კანონზე. იგივე განმარტება კანონის ტექსტის ქვეშაც იხსნება (ღილაკი „ნიკოდიმოსის განმარტება“).
      </p>
      <p className="meta" style={{ textAlign: "center" }}>ტექსტი OCR-ითაა მიღებული, ამიტომ ადგილ-ადგილ ასოებია არეული.</p>
      {groups.map((g) => {
        const items = g.docs.map((id) => byId.get(id)!).filter((d) => d?.comm);
        if (!items.length) return null;
        return (
          <section key={g.id}>
            <div className="group-title">{g.title}</div>
            <ol className="toc">
              {items.map((d) => (
                <li key={d.id}>
                  <Link href={`/councils/${d.id}/commentary`}>
                    <Cross />
                    <span className="num">{d.id}</span>
                    {d.title}
                    <span className="meta">{d.comm!.total} განმარტება</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </>
  );
}
