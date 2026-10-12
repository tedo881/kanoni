"use client";
import Link from "next/link";
import { useState } from "react";
import RefChips from "./RefChips";
import type { RefView } from "@/lib/data";

type Data = {
  n: number; page: number; vol: number; canonText: string | null; refsRaw: string | null; paras: string[];
  refs: RefView[]; allHref: string; docTitle?: string;
};

/** კანონის ბოლოს გამოსაჩენი ღილაკი: დაჭერით იშლება ნიკოდიმოსის (მილაშის) განმარტება კომენტარად */
export default function CommentToggle({ doc, canon }: { doc: number; canon: number }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !data && state !== "loading") {
      setState("loading");
      try {
        const r = await fetch(`/api/commentary?doc=${doc}&canon=${canon}`);
        if (!r.ok) throw new Error();
        setData(await r.json());
        setState("idle");
      } catch {
        setState("error");
      }
    }
  }

  return (
    <div className={`cm ${open ? "open" : ""}`}>
      <button className="cm-btn" onClick={toggle} aria-expanded={open}>
        <span className="chev" aria-hidden="true">▸</span> ნიკოდიმოსის განმარტება
      </button>
      {open && (
        <div className="cm-body" role="region" aria-label={`კანონი ${canon}: ნიკოდიმოსის განმარტება`}>
          {state === "loading" && <p className="cm-muted">იტვირთება…</p>}
          {state === "error" && <p className="cm-muted">განმარტების ჩატვირთვა ვერ მოხერხდა. სცადეთ თავიდან.</p>}
          {data && (
            <>
              {data.canonText && (
                <p className="cm-canon"><strong>კანონი ნიკოდიმოსის თარგმანით:</strong> {data.canonText}</p>
              )}
              {data.paras.map((p, i) => <p key={i}>{p}</p>)}
              <RefChips refs={data.refs} />
              <p className="cm-foot">
                ნიკოდიმოსი (მილაში), ტ. {data.vol === 1 ? "I (2007)" : "II (2011)"}, PDF გვ. {data.page}. ტექსტი ავტომატური ამოცნობით არის მიღებული და შეიძლება შეიცავდეს უზუსტობას.{" "}
                <Link href={data.allHref}>ყველა განმარტება →</Link>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
