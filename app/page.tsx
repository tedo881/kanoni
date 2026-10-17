import Link from "next/link";
import type { ReactNode } from "react";
import { getDocs, isHiddenDoc, showHidden } from "@/lib/data";
import ContinueReading from "@/components/ContinueReading";
import InstallPrompt from "@/components/InstallPrompt";
import HeroSearch from "@/components/HeroSearch";

const I = (d: ReactNode) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
);
const ICONS = {
  scroll: I(
    <>
      <path d="M8 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8" />
      <path d="M8 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2" />
      <path d="M10 9h6M10 13h6" />
    </>,
  ),
  book: I(
    <>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5M9 8h6" />
    </>,
  ),
  scale: I(
    <>
      <path d="M12 3v18M7 21h10M5 7h14" />
      <path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z" />
    </>,
  ),
  church: I(
    <>
      <path d="M12 2v5M10 4.5h4" />
      <path d="M5 22V12l7-5 7 5v10z" />
      <path d="M10 22v-5a2 2 0 0 1 4 0v5" />
    </>,
  ),
  comment: I(
    <>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
      <path d="M9 11h6M9 14h4" />
    </>,
  ),
  list: I(
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </>,
  ),
  search: I(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>,
  ),
  spark: I(
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z" />
    </>,
  ),
};

export default function Home() {
  const { docs: all } = getDocs();
  const docs = all.filter(
    (d: { group: string }) =>
      d.group !== "mcire" &&
      d.group !== "churchlaw" &&
      d.group !== "synod" &&
      d.group !== "boumis" &&
      d.group !== "ekkanon",
  );
  const titles = Object.fromEntries(
    all
      .filter((d: { id: number }) => !isHiddenDoc(d.id))
      .map((d: { id: number; title: string }) => [d.id, d.title]),
  );

  const cards: {
    href: string;
    icon: ReactNode;
    title: string;
    text: string;
  }[] = [
    {
      href: "/councils",
      icon: ICONS.scroll,
      title: "დიდი სჯულის კანონი",
      text: `მოციქულთა და კრებათა კანონები, წმინდა მამათა ეპისტოლეები · ${docs.length} დოკუმენტი`,
    },
    {
      href: "/councils/45",
      icon: ICONS.book,
      title: "მცირე სჯულის კანონი",
      text: "ახალი და ძველი ქართული ტექსტი სქოლიოებით",
    },
    {
      href: "/church-law",
      icon: ICONS.church,
      title: "საქართველოს ეკლესიის სამართალი",
      text: "დებულება, შეთანხმებები, სინოდის ოქმები და განჩინებები",
    },
    ...(showHidden()
      ? [
          {
            href: "/boumis",
            icon: ICONS.scale,
            title: "კანონიკური სამართალი",
            text: "პანაიოტის ბუმისი · სამეცნიერო სახელმძღვანელო",
          },
        ]
      : []),
    {
      href: "/canon-law",
      icon: ICONS.scale,
      title: "მართლმადიდებელი ეკლესიის კანონიკური სამართალი",
      text: "დეკ. ზურაბ მჭედლიშვილი · შესავალი და 16 ნაწილი",
    },
    {
      href: "/nikodim",
      icon: ICONS.comment,
      title: "მართლმადიდებელი ეკლესიის კანონები",
      text: "ნიკოდიმოს მილაშის განმარტებები · ტომი I და II",
    },
    {
      href: "/parts",
      icon: ICONS.list,
      title: "კანონთა საძიებელი",
      text: "თემატური სარჩევი · 14 ნაწილი",
    },
  ];

  return (
    <>
      <InstallPrompt />
      <div className="lp">
        <section className="lp-hero">
          <div className="lp-hero-text">
            <p className="lp-eyebrow">მართლმადიდებელი ეკლესიის კანონები</p>
            <h1>საეკლესიო სამართალი</h1>
            <p className="lp-sub">
              მოციქულთა და კრებათა კანონები, წმინდა მამათა ეპისტოლეები და
              თანამედროვე კანონიკური სამართალი — ერთ სივრცეში, ძიებით და
              წყაროებზე დაფუძნებული AI ასისტენტით.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="lp-emblem"
            src="/img/council-icon.webp"
            alt="მსოფლიო კრების ხატი"
            width={300}
            height={300}
          />
          <div className="lp-hero-search">
            <HeroSearch />
          </div>
        </section>

        <ContinueReading titles={titles} />

        <h2 className="lp-h">ბიბლიოთეკა</h2>
        <div className="lp-grid">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className="lp-card">
              <span className="lp-ic">{c.icon}</span>
              <span className="lp-ct">{c.title}</span>
              <span className="lp-tx">{c.text}</span>
            </Link>
          ))}
        </div>

        <h2 className="lp-h">როგორ მუშაობს</h2>
        <ol className="lp-steps">
          <li>
            <b>დასვით კითხვა</b>
            <span>
              ტექსტით ან ხმით — მაგ. „შეუძლია თუ არა მღვდელს მეორედ
              დაქორწინება?“
            </span>
          </li>
          <li>
            <b>ვპოულობთ წყაროებს</b>
            <span>კანონებსა და განმარტებებში ყველაზე შესაბამის ადგილებს.</span>
          </li>
          <li>
            <b>პასუხი წყაროების მითითებით</b>
            <span>
              ყოველ პასუხს თან ახლავს ციტირებული ტექსტი — გადაამოწმეთ
              ორიგინალში.
            </span>
          </li>
        </ol>
        <p className="lp-note">
          ასისტენტის პასუხი ოფიციალურ საეკლესიო განმარტებას არ წარმოადგენს.
          კონკრეტული შემთხვევის გადასაწყვეტად მიმართეთ სასულიერო პირს.
        </p>
      </div>
    </>
  );
}
