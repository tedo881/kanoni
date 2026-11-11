import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "@fontsource/noto-sans-georgian/400.css";
import "@fontsource/noto-sans-georgian/600.css";
import "@fontsource/noto-sans-georgian/700.css";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import NavLinks from "@/components/NavLinks";
import { showHidden } from "@/lib/data";

export const metadata: Metadata = {
  title: {
    default: "საეკლესიო სამართალი",
    template: "%s · საეკლესიო სამართალი",
  },
  description:
    "მართლმადიდებელი ეკლესიის კანონები: მოციქულთა და კრებათა კანონები, წმინდა მამათა ეპისტოლეები, თემატური სარჩევი და AI ასისტენტი.",
  icons: { icon: "/icon.png", apple: "/icon.png" },
};
export const viewport: Viewport = {
  themeColor: "#3f51b5",
  width: "device-width",
  initialScale: 1,
};

const THEME_INIT = `try{var t=localStorage.getItem("kanoni:theme");if(t)document.documentElement.dataset.theme=t;var s=localStorage.getItem("kanoni:size");if(s)document.documentElement.style.setProperty("--reader-size",["0.95rem","1.03rem","1.125rem","1.3rem","1.55rem"][+s]||"1.125rem")}catch(e){}`;

const sources: { title: string; details?: string[] }[] = [
  {
    title:
      "„წმიდა მოციქულთა კანონები განმარტებებით“ — ეპისკოპოსი ნიკოდიმოსი (მილაში)",
    details: ["რუსულიდან თარგმნა ვლადიმერ ჩხიკვაძემ", "თბილისი, 2006"],
  },
  {
    title:
      "„მართლმადიდებელი ეკლესიის კანონები ეპისკოპოს ნიკოდიმის (მილაში) განმარტებებით“, ტომი I–II",
    details: ["საქართველოს ეროვნული ბიბლიოთეკა", "2007"],
  },
  {
    title: "„დიდი სჯულის კანონი“, თარგმნილი არსენ იყალთოელის მიერ",
    details: [
      "ახალქართული ვერსია მოამზადეს მანანა დოლაქიძემ და გულნარა ნინუამ",
      "თბილისი, 2009",
    ],
  },
  {
    title: "„სპეკალი მართლმადიდებლობისა“",
    details: [
      "ძველი ბერძნულიდან თარგმნა და შენიშვნები დაურთო ედიშერ ჭელიძემ",
      "თბილისი, 2007",
    ],
  },
  {
    title: "პანაიოტის ბუმისი — „საეკლესიო სამართალი“",
    details: ["2013"],
  },
  {
    title: "„მართლმადიდებელი ეკლესიის კანონიკური სამართალი“",
    details: [
      "რუსულიდან თარგმნა, თემატურად დაალაგა და საეკლესიო კანონები დაურთო საბურთალოს წმ. იოანე ღვთისმეტყველის ტაძრის წინამძღვარმა, დეკანოზმა ზურაბ მჭედლიშვილმა",
      "წიგნი აერთიანებს ეპისკოპოს ნიკოდიმოსის (მილაშის) „მართლმადიდებლურ საეკლესიო სამართალს“ და დეკანოზ ვლადისლავ ციპინის „საეკლესიო სამართალს“",
      "გამომცემლობა „ლაზარე“, 2023",
    ],
  },
];

const links = [
  { label: "orthodoxy.ge", href: "https://www.orthodoxy.ge/" },
  { label: "library.church.ge", href: "http://library.church.ge/" },
  { label: "patriarchate.ge", href: "https://patriarchate.ge/" },
  { label: "dspace.nplg.gov.ge", href: "https://dspace.nplg.gov.ge/" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ka" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="brand">
              <img src="/icon.png" alt="" width={30} height={30} />
              საეკლესიო სამართალი
            </Link>
            <NavLinks showBoumis={showHidden()} />
            <ThemeToggle />
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <details style={{ margin: "0 0 0.75rem" }}>
              <summary style={{ cursor: "pointer" }}>წყაროები</summary>
              <p style={{ margin: "0.75rem 0 0" }}>
                კანონების ტექსტი: „დიდი სჯულის კანონი“ (არსენ იყალთოელის
                თარგმანი, 2009). განმარტებები: ეპისკოპოსი ნიკოდიმოსი (მილაში).
                აპლიკაცია საინფორმაციო დანიშნულებისაა და არ ცვლის სასულიერო
                პირის რჩევას.
              </p>
              <ol style={{ margin: "0.75rem 0 0", paddingLeft: "1.25rem" }}>
                {sources.map((s) => (
                  <li key={s.title} style={{ marginBottom: "0.6rem" }}>
                    <div>{s.title}</div>
                    {s.details?.map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </li>
                ))}
              </ol>
              <p style={{ margin: "0.75rem 0 0" }}>
                {links.map((l, i) => (
                  <span key={l.href}>
                    {i > 0 && " · "}
                    <a href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.label}
                    </a>
                  </span>
                ))}
              </p>
            </details>
            <p>
              მასალები აღებულია ღია წყაროებიდან. საავტორო უფლებებთან
              დაკავშირებული ნებისმიერი პრეტენზიის არსებობის შემთხვევაში,
              შესაბამისი მასალა დაუყოვნებლივ მოიხსნება ვებგვერდიდან.
            </p>
            <p>
              შენიშვნების ან წინადადებების შემთხვევაში:{" "}
              <a href="mailto:tedo881@gmail.com">tedo881@gmail.com</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
