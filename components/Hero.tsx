/** სიის ეკრანის ზედა ხატი ინდიგოს გამჭვირვალე სათაურით (ძველი აპის „heroImageView + stickyView“) */
export default function Hero({
  src,
  title,
  alt,
  tall,
}: {
  src: string;
  title: string;
  alt: string;
  tall?: boolean;
}) {
  return (
    <div className={tall ? "hero-img tall" : "hero-img"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} />
      <div className="bar">{title}</div>
    </div>
  );
}
