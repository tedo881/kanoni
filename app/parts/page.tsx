import Link from "next/link";
import type { Metadata } from "next";
import { getParts } from "@/lib/data";
import Hero from "@/components/Hero";
import Cross from "@/components/Cross";

export const metadata: Metadata = { title: "კანონთა საძიებელი" };

export default function Parts() {
  const parts = getParts();
  return (
    <>
      <Hero src="/img/hero-apostles.webp" alt="თორმეტ მოციქულთა კრების ხატი" title="კანონთა საძიებელი" />
      <div className="group-title">თემატური სარჩევი</div>
      <ol className="toc">
        {parts.map((p) => (
          <li key={p.n}>
            <Link href={`/parts/${p.n}`}>
              <Cross />
              <span className="num">{p.roman}</span>
              <strong>ნაწილი {p.roman}</strong>
              <span className="meta" style={{ fontSize: "0.9rem", color: "var(--ink)", fontWeight: 600 }}>{p.title}</span>
              <span className="meta">{p.chapters.length} თავი</span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
