"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/councils", label: "კრებები" },
  { href: "/nikodim", label: "განმარტებანი" },
  { href: "/parts", label: "თემატური" },
  { href: "/search", label: "ძიება" },
  { href: "/assistant", label: "ასისტენტი" },
  { href: "/about", label: "შესახებ" },
  //asdasdsa
];
export default function NavLinks() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="მთავარი ნავიგაცია">
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
