"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/councils", label: "კრებები" },
  { href: "/nikodim", label: "განმარტებანი" },
  { href: "/parts", label: "თემატური" },
  { href: "/search", label: "ძიება" },
  { href: "/assistant", label: "ასისტენტი" },
  { href: "/about", label: "შესახებ" },
];
export default function NavLinks() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // გვერდის შეცვლისას მენიუ დაიხუროს
  useEffect(() => {
    setOpen(false);
  }, [path]);

  // Escape ან მენიუს გარეთ დაჭერა ხურავს
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: Event) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div ref={wrap} className="navwrap">
      <button
        type="button"
        className={`icon-btn burger${open ? " is-open" : ""}`}
        aria-label={open ? "მენიუს დახურვა" : "მენიუს გახსნა"}
        aria-expanded={open}
        aria-controls="main-nav"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>
      <nav
        id="main-nav"
        className={`nav${open ? " open" : ""}`}
        aria-label="მთავარი ნავიგაცია"
      >
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={
              path === l.href || path.startsWith(l.href + "/")
                ? "page"
                : undefined
            }
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
