"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

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
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    // ვიწრო ეკრანზე აქტიური განყოფილება ჩანდეს
    const nav = ref.current;
    const cur = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && cur)
      nav.scrollTo({
        left: cur.offsetLeft - nav.clientWidth / 2 + cur.clientWidth / 2,
      });
  }, [path]);
  return (
    <nav ref={ref} className="nav" aria-label="მთავარი ნავიგაცია">
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
  );
}
