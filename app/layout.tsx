import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "@fontsource/noto-sans-georgian/400.css";
import "@fontsource/noto-sans-georgian/600.css";
import "@fontsource/noto-sans-georgian/700.css";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import NavLinks from "@/components/NavLinks";

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
              <img src="/img/logo.png" alt="" width={34} height={34} />
              საეკლესიო სამართალი
            </Link>
            <NavLinks />
            <ThemeToggle />
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            კანონების ტექსტი: „დიდი სჯულის კანონი“ (არსენ იყალთოელის თარგმანი,
            2009). განმარტებები: ეპისკოპოსი ნიკოდიმოსი (მილაში). აპლიკაცია
            საინფორმაციო დანიშნულებისაა და არ ცვლის სასულიერო პირის რჩევას.
          </div>
        </footer>
      </body>
    </html>
  );
}
