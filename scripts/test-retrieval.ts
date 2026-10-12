import { retrieve, getIndex } from "../lib/search";

const queries = process.argv.slice(2).length ? process.argv.slice(2) : [
  "შეუძლია თუ არა მღვდელს მეორედ დაქორწინება?",
  "რა სასჯელი ადევს სიმონიას, ანუ ფულით ხელდასხმას?",
  "მოციქულთა 35-ე კანონი",
  "ვინ შეიძლება გახდეს ეპისკოპოსი და რამდენი ეპისკოპოსი აკურთხებს?",
  "მარხვის დარღვევა კვირა დღეს",
  "მონაზვნის ქორწინება",
  "ლაოდიკიის 35 კანონი",
  "შეიძლება თუ არა ქალის მღვდელმსახურება?",
];
const t0 = Date.now();
getIndex();
console.log(`ინდექსი: ${Date.now() - t0}ms`);
for (const q of queries) {
  const t = Date.now();
  const s = retrieve(q);
  console.log(`\n### ${q}  (${Date.now() - t}ms)`);
  for (const x of s.slice(0, 5)) console.log(`  [${x.n}] ${x.label} | ${x.kind} | ${x.score.toFixed(1)} | ${x.passages.length}p | ${x.passages[0].text.slice(0, 90)}`);
}
