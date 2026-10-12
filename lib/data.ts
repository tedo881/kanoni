import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const DATA_DIR = path.join(process.cwd(), "data");

export type Doc = {
  id: number; title: string; group: string; canons: number[]; chars: number;
  aligned?: boolean; // დიდი სჯულის კანონების ნომრები ემთხვევა ნიკოდიმოსის ნომრებს
  comm?: { total: number; inline: number[]; intro: boolean }; // ნიკოდიმოსის განმარტებები
};
export type CommRef = { l: string; d: number | null; n: number[] };
export type CommEntry = { n: number; p: number; v: number; t: string | null; r: string | null; x: CommRef[]; c: string[] };
export type CommFile = { doc: number; vol: number; title: string; entries: CommEntry[] };
export type RefView = { label: string; doc: number | null; items: { n: number; href: string | null }[] };
export type Group = { id: string; title: string; docs: number[] };
export type PartRef = { label: string; doc: number | null; canons: number[]; raw: string };
export type PartChapter = { title: string; refs: PartRef[] };
export type Part = { n: number; roman: string; title: string; chapters: PartChapter[] };
export type Chunk = {
  id: string;
  src: "sjuli" | "nik1" | "nik2" | "topic";
  doc?: number | null;
  canon?: number | null;
  anchor?: string;
  part?: number;
  page?: number;
  title: string;
  text: string;
  refs?: { doc: number; canons: number[] }[];
};

type Cache = { comm: Map<number, CommFile | null>; docs?: { groups: Group[]; docs: Doc[] }; parts?: Part[]; chunks?: Chunk[]; html: Map<number, string> };
const g = globalThis as unknown as { __kanoniCache?: Cache };
const cache: Cache = (g.__kanoniCache ??= { html: new Map(), comm: new Map() });

export function getDocs() {
  return (cache.docs ??= JSON.parse(fs.readFileSync(path.join(DATA_DIR, "docs.json"), "utf-8")));
}
export function getDoc(id: number): Doc | undefined {
  return getDocs().docs.find((d: Doc) => d.id === id);
}
export function getDocHtml(id: number): string {
  let h = cache.html.get(id);
  if (h === undefined) {
    h = fs.readFileSync(path.join(DATA_DIR, "docs", `${id}.html`), "utf-8");
    cache.html.set(id, h);
  }
  return h;
}
export function getParts(): Part[] {
  return (cache.parts ??= JSON.parse(fs.readFileSync(path.join(DATA_DIR, "parts.json"), "utf-8")));
}
export function getChunks(): Chunk[] {
  return (cache.chunks ??= JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATA_DIR, "chunks.json.gz"))).toString("utf-8")));
}

export function getCommentary(id: number): CommFile | null {
  if (!cache.comm.has(id)) {
    const f = path.join(DATA_DIR, "commentary", `${id}.json`);
    cache.comm.set(id, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf-8")) : null);
  }
  return cache.comm.get(id)!;
}

/** ბმული ნიკოდიმოსის მითითებიდან: კანონზე მკითხველში (თუ ნომრები ემთხვევა), სხვა შემთხვევაში განმარტებების გვერდზე */
export function refHref(d: number | null, n: number): string | null {
  if (!d) return null;
  const doc = getDoc(d);
  if (!doc) return null;
  if (doc.aligned && doc.canons.includes(n)) return `/councils/${d}#k${n}`;
  if (doc.comm) return `/councils/${d}/commentary#n${n}`;
  return `/councils/${d}`;
}
export function refViews(refs: CommRef[]): RefView[] {
  return refs.map((r) => ({ label: r.l, doc: r.d, items: r.n.map((n) => ({ n, href: refHref(r.d, n) })) }));
}

export function canonHref(doc: number, canon?: number | null) {
  return canon ? `/councils/${doc}#k${canon}` : `/councils/${doc}`;
}

export const SOURCE_NAMES: Record<Chunk["src"], string> = {
  sjuli: "დიდი სჯულის კანონი",
  nik1: "ნიკოდიმოსი (მილაში), ტ. I (2007)",
  nik2: "ნიკოდიმოსი (მილაში), ტ. II (2011)",
  topic: "თემატური სარჩევი",
};
