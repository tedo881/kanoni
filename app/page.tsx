import Link from "next/link";
import { getDocs } from "@/lib/data";
import ContinueReading from "@/components/ContinueReading";
import InstallPrompt from "@/components/InstallPrompt";

export default function Home() {
  const { docs: all } = getDocs();
  const docs = all.filter(
    (d: { group: string }) =>
      d.group !== "mcire" && d.group !== "churchlaw" && d.group !== "synod",
  );
  const titles = Object.fromEntries(
    all.map((d: { id: number; title: string }) => [d.id, d.title]),
  );
  return (
    <>
      <div className="home-bg" aria-hidden="true" />
      <InstallPrompt />
      <section className="home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="emblem"
          src="/img/council-icon.webp"
          alt="მსოფლიო კრების ხატი"
          width={300}
          height={300}
        />
        <p className="sub">
          მოციქულთა და კრებათა კანონები, წმინდა მამათა ეპისტოლეები — ძიებით და
          AI ასისტენტით.
        </p>
        <ContinueReading titles={titles} />
        <Link href="/councils" className="btn-grad">
          დიდი სჯულის კანონი
          <small>კრებების მიხედვით · {docs.length} დოკუმენტი</small>
        </Link>
        <Link href="/councils/45" className="btn-grad">
          მცირე სჯულის კანონი
          <small>ახალი და ძველი ქართული ტექსტი · სქოლიოებით</small>
        </Link>
        <Link href="/church-law" className="btn-grad">
          საქართველოს ეკლესიის სამართალი
          <small>დებულება, შეთანხმებები, სინოდის ოქმები და განჩინებები</small>
        </Link>
        <Link href="/nikodim" className="btn-grad">
          ნიკოდიმოს მილაშის განმარტებები
          <small>მართლმადიდებელი ეკლესიის კანონები · ტომი I და II</small>
        </Link>
        <Link href="/parts" className="btn-grad">
          კანონთა საძიებელი<small>თემატური სარჩევი · 14 ნაწილი</small>
        </Link>
        <Link href="/assistant" className="btn-grad gold">
          AI ასისტენტი
          <small>კითხვა-პასუხი კანონებისა და განმარტებების საფუძველზე</small>
        </Link>
        <Link href="/search" className="btn-grad">
          ძიება ყველა ტექსტში
        </Link>
      </section>
    </>
  );
}
