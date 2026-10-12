import type { Metadata } from "next";
import SearchView from "@/components/SearchView";

export const metadata: Metadata = { title: "ძიება" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <>
      <h1 className="reader-title">ძიება</h1>
      <p className="lead" style={{ textAlign: "center", marginInline: "auto" }}>ძიება კანონებსა და ნიკოდიმოსის განმარტებებში. სიტყვის ფორმას მნიშვნელობა არ აქვს: „ქორწინება“ იპოვის „დაქორწინდა“-საც.</p>
      <SearchView initial={q ?? ""} />
    </>
  );
}
