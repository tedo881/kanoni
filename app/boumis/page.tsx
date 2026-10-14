import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getDocs,
  showHidden,
  unitName,
  type Doc,
  type Group,
} from "@/lib/data";
import Cross from "@/components/Cross";

export const metadata: Metadata = { title: "ბუმისი, „კანონიკური სამართალი“" };

export default function Boumis() {
  if (!showHidden()) notFound(); // დაფარულია, სანამ SHOW_BOUMIS ჩართული არ არის (lib/data.ts)
  const { groups, docs } = getDocs() as { groups: Group[]; docs: Doc[] };
  const byId = new Map(docs.map((d) => [d.id, d]));
  const g = groups.find((x) => x.id === "boumis");
  if (!g) notFound();
  return (
    <>
      <h1 style={{ textAlign: "center" }}>კანონიკური სამართალი</h1>
      <p style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 18px" }}>
        პანაიოტის ბუმისის სამეცნიერო სახელმძღვანელო (2013): შესავალი და ზოგადი
        ნაწილი, 14 თავი. ეს არის ავტორის განმარტება და არა თვით კანონის ტექსტი.
      </p>
      <p className="meta" style={{ textAlign: "center" }}>
        ტექსტი OCR-ითაა მიღებული, ამიტომ ადგილ-ადგილ ასოებია არეული.
      </p>
      <section>
        <div className="group-title">
          პანაიოტის ბუმისი, „კანონიკური სამართალი“ (2013)
        </div>
        <ol className="toc">
          {g.docs.map((id) => {
            const d = byId.get(id)!;
            return (
              <li key={id}>
                <Link href={`/councils/${id}`}>
                  <Cross />
                  {d.title.replace(
                    /^პ\. ბუმისი, „კანონიკური სამართალი“ — /,
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
