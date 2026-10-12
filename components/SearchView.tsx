"use client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { highlightRe, stems } from "@/lib/highlight";

type R = {
  n: number;
  label: string;
  href?: string;
  kind: string;
  excerpt: string;
};

function mark(text: string, re: RegExp | null): ReactNode {
  if (!re) return text;
  const out: ReactNode[] = [];
  let last = 0,
    k = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last)
      out.push(<Fragment key={k++}>{text.slice(last, i)}</Fragment>);
    out.push(<mark key={k++}>{m[0]}</mark>);
    last = i + m[0].length;
  }
  if (last < text.length)
    out.push(<Fragment key={k++}>{text.slice(last)}</Fragment>);
  return out;
}

/** გვერდზე გადასვლისას ნაპოვნი სიტყვა იქაც მონიშნული იყოს (?q=...) */
function withQuery(href: string, q: string) {
  const st = stems(q)[0];
  if (!st || href.includes("/commentary")) return href;
  const [path, hash] = href.split("#");
  return `${path}?q=${encodeURIComponent(st)}${hash ? "#" + hash : ""}`;
}

export default function SearchView({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<R[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(initial); // რომელი მოთხოვნის შედეგებია ნაჩვენები
  const re = useMemo(() => highlightRe(shown), [shown]);

  const run = async (query: string) => {
    if (query.trim().length < 2) return setRes(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      setRes((await r.json()).results ?? []);
      setShown(query);
    } catch {
      setRes([]);
    }
    setBusy(false);
  };
  useEffect(() => {
    if (initial) run(initial);
  }, [initial]);

  return (
    <>
      <form
        className="searchbar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          history.replaceState(null, "", `?q=${encodeURIComponent(q)}`);
          run(q);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="მაგ.: ქორწინება, სიმონია, მარხვა…"
          aria-label="ძიება"
          autoFocus
        />
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "…" : "ძიება"}
        </button>
      </form>
      {res && res.length === 0 && (
        <p className="notice">შედეგი ვერ მოიძებნა. სცადეთ სხვა სიტყვა.</p>
      )}
      {res?.map((r) => (
        <div className="result" key={r.n}>
          <h3>
            {r.href ? (
              <Link href={withQuery(r.href, shown)}>{mark(r.label, re)}</Link>
            ) : (
              mark(r.label, re)
            )}{" "}
            {r.kind === "commentary" && (
              <span className="badge">განმარტება</span>
            )}
          </h3>
          <p>{mark(r.excerpt, re)}</p>
        </div>
      ))}
    </>
  );
}
