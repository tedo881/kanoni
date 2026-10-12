"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type R = { n: number; label: string; href?: string; kind: string; excerpt: string };

export default function SearchView({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<R[] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (query: string) => {
    if (query.trim().length < 2) return setRes(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      setRes((await r.json()).results ?? []);
    } catch { setRes([]); }
    setBusy(false);
  };
  useEffect(() => { if (initial) run(initial); }, [initial]);

  return (
    <>
      <form className="searchbar" role="search" onSubmit={(e) => { e.preventDefault(); history.replaceState(null, "", `?q=${encodeURIComponent(q)}`); run(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="მაგ.: ქორწინება, სიმონია, მარხვა…" aria-label="ძიება" autoFocus />
        <button className="btn" type="submit" disabled={busy}>{busy ? "…" : "ძიება"}</button>
      </form>
      {res && res.length === 0 && <p className="notice">შედეგი ვერ მოიძებნა. სცადეთ სხვა სიტყვა.</p>}
      {res?.map((r) => (
        <div className="result" key={r.n}>
          <h3>{r.href ? <Link href={r.href}>{r.label}</Link> : r.label} {r.kind === "commentary" && <span className="badge">განმარტება</span>}</h3>
          <p>{r.excerpt}…</p>
        </div>
      ))}
    </>
  );
}
