/** სიის ეკრანის ზედა ხატი ინდიგოს გამჭვირვალე სათაურით (ძველი აპის „heroImageView + stickyView“) */
export default function Hero({ src, title, alt }: { src: string; title: string; alt: string }) {
  return (
    <div className="hero-img">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} />
      <div className="bar">{title}</div>
    </div>
  );
}
