"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ContinueReading({ titles }: { titles: Record<number, string> }) {
  const [last, setLast] = useState<number | null>(null);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem("kanoni:last") ?? "null");
      if (v?.id && titles[v.id]) setLast(v.id);
    } catch {}
  }, [titles]);
  if (!last) return null;
  return (
    <p className="notice" style={{ marginTop: 0 }}>
      ბოლოს კითხულობდით: <Link href={`/councils/${last}`}>{titles[last]}</Link>
    </p>
  );
}
