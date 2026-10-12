import Link from "next/link";
import type { RefView } from "@/lib/data";

/** ნიკოდიმოსის მითითებები ბმულებად: „მოც. 28; ანტიოქ. 4“ */
export default function RefChips({ refs }: { refs: RefView[] }) {
  if (!refs.length) return null;
  return (
    <div className="ref-chips">
      <span className="lbl">მსგავსი კანონები:</span>
      {refs.map((r, i) => (
        <span className="grp" key={i}>
          <span className="rl">{r.label}.</span>
          {r.items.map((it) =>
            it.href ? (
              <Link key={it.n} className="cn" href={it.href}>{it.n}</Link>
            ) : (
              <span key={it.n} className="cn off">{it.n}</span>
            ),
          )}
        </span>
      ))}
    </div>
  );
}
