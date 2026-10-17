"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Mic from "./Mic";

/** მთავარი გვერდის ველი: ერთი ტექსტი — ან კითხვა ასისტენტს, ან ძიება ტექსტებში */
export default function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const t = q.trim();
  const ask = () =>
    router.push(t ? `/assistant?q=${encodeURIComponent(t)}` : "/assistant");
  const search = () =>
    router.push(t ? `/search?q=${encodeURIComponent(t)}` : "/search");
  return (
    <form
      className="lp-ask"
      onSubmit={(e) => {
        e.preventDefault();
        ask();
      }}
    >
      <div className="lp-field">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          enterKeyHint="send"
          autoComplete="off"
          placeholder="დაწერეთ კითხვა ან საძიებო სიტყვა…"
          aria-label="კითხვა ან საძიებო სიტყვა"
        />
        <Mic getValue={() => q} setValue={setQ} />
      </div>
      <div className="lp-btns">
        <button type="submit" className="lp-cta">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
            <path d="M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z" />
          </svg>
          დაუსვით კითხვა
        </button>
        <button type="button" className="lp-ghost" onClick={search}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          დაძებნეთ
        </button>
      </div>
      <p className="lp-hint">
        „დაუსვით კითხვა“ — AI ასისტენტი უპასუხებს წყაროების მითითებით;
        „დაძებნეთ“ — იპოვის სიტყვას კანონების ტექსტში.
      </p>
    </form>
  );
}
