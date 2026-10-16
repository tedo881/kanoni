import Link from "next/link";
import type { Metadata } from "next";
import { getDocs, unitName, type Doc, type Group } from "@/lib/data";
import Cross from "@/components/Cross";
import BuyBook from "@/components/BuyBook";

export const metadata: Metadata = {
  title: "მართლმადიდებელი ეკლესიის კანონიკური სამართალი",
  description:
    "დეკანოზ ზურაბ მჭედლიშვილის წიგნი „მართლმადიდებელი ეკლესიის კანონიკური სამართალი“ (2023): თემატურად დალაგებული საეკლესიო სამართალი კანონებით.",
};

export default function CanonLaw() {
  const { groups, docs } = getDocs() as { groups: Group[]; docs: Doc[] };
  const byId = new Map(docs.map((d) => [d.id, d]));
  const g = groups.find((x) => x.id === "ekkanon");
  if (!g) return null;
  return (
    <>
      <h1 style={{ textAlign: "center" }}>
        მართლმადიდებელი ეკლესიის კანონიკური სამართალი
      </h1>
      <p style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 14px" }}>
        რუსულიდან თარგმნა, თემატურად დაალაგა და საეკლესიო კანონები დაურთო
        საბურთალოს წმ. იოანე ღვთისმეტყველის ტაძრის წინამძღვარმა დეკანოზმა ზურაბ
        მჭედლიშვილმა (გამომცემლობა „ლაზარე“, 2023). წიგნი აერთიანებს ეპისკოპოს
        ნიკოდიმოსის (მილაშის) „მართლმადიდებლურ საეკლესიო სამართალს“ და დეკანოზ
        ვლადისლავ ციპინის „საეკლესიო სამართალს“.
      </p>
      <BuyBook />
      <section>
        <div className="group-title">შინაარსი</div>
        <ol className="toc">
          {g.docs.map((id) => {
            const d = byId.get(id)!;
            return (
              <li key={id}>
                <Link href={`/councils/${id}`}>
                  <Cross />
                  {d.title.replace(
                    /^მართლმადიდებელი ეკლესიის კანონიკური სამართალი — /,
                    "",
                  )}
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
    </>
  );
}
