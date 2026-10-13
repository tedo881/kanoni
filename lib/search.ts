import { getChunks, getDocs, getDoc, canonHref, unitName, SOURCE_NAMES, type Chunk, type Doc } from "./data";

/* ------------------------------------------------------------------ ტოკენიზაცია
 * ქართული აგლუტინაციური ენაა (პრევერბები, ბრუნვის და მრავლობითის სუფიქსები), ამიტომ
 * ვიყენებთ სიტყვის 6-ასოიან პრეფიქსს + 4-ასოიან n-გრამებს: "ქორწინება", "ქორწინების",
 * "დაქორწინდა" ერთმანეთს ემთხვევა. */
const WORD = /[ა-ჿ]+/g;

/** ძველი ქართული ასოები თანამედროვეზე დაიყვანება (ჲ ამოვარდება, ჳ→ვ, ჴ→ხ, ჵ→ო, ჱ→ე, ჶ→ფ), რომ ძველი ტექსტი ახალი ორთოგრაფიით ძებნადი იყოს */
const OLD_LETTERS: Record<string, string> = { "ჲ": "", "ჳ": "ვ", "ჴ": "ხ", "ჵ": "ო", "ჱ": "ე", "ჶ": "ფ" };
const norm = (s: string) => s.replace(/[ჲჳჴჵჱჶ]/g, (c) => OLD_LETTERS[c]);

export function features(text: string): string[] {
  const out: string[] = [];
  for (const w of norm(text.toLowerCase()).match(WORD) ?? []) {
    if (w.length <= 3) {
      out.push("w:" + w);
      continue;
    }
    out.push("s:" + w.slice(0, 6));
    for (let i = 0; i + 4 <= w.length; i++) out.push("g:" + w.slice(i, i + 4));
  }
  return out;
}
const WEIGHT: Record<string, number> = { s: 1.6, g: 1, w: 0.4 };

type Index = {
  postings: Map<string, Int32Array>; // [chunkIdx, tf, chunkIdx, tf, ...]
  len: Float64Array;
  avg: number;
  N: number;
  canonMap: Map<string, number[]>; // "doc:canon" -> sjuli chunk indexes
  nikMap: Map<string, number[]>; // "doc:canon" -> commentary chunk indexes
  chunks: Chunk[];
};
const g = globalThis as unknown as { __kanoniIndex?: Index };

function build(): Index {
  const chunks = getChunks();
  const N = chunks.length;
  const tmp = new Map<string, number[]>();
  const len = new Float64Array(N);
  const canonMap = new Map<string, number[]>();
  const nikMap = new Map<string, number[]>();
  chunks.forEach((c, i) => {
    const f = features(c.text);
    len[i] = f.length;
    const tf = new Map<string, number>();
    for (const t of f) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, n] of tf) {
      let arr = tmp.get(t);
      if (!arr) tmp.set(t, (arr = []));
      arr.push(i, n);
    }
    if (c.doc && c.canon) {
      const key = `${c.doc}:${c.canon}`;
      const m = c.src === "sjuli" ? canonMap : c.src === "topic" ? null : nikMap;
      if (m) (m.get(key) ?? (m.set(key, []), m.get(key)!)).push(i);
    }
  });
  const postings = new Map<string, Int32Array>();
  for (const [t, a] of tmp) postings.set(t, Int32Array.from(a));
  let sum = 0;
  for (let i = 0; i < N; i++) sum += len[i];
  return { postings, len, avg: sum / N, N, canonMap, nikMap, chunks };
}
export function getIndex(): Index {
  return (g.__kanoniIndex ??= build());
}

/* ------------------------------------------------------------------ პირდაპირი მითითებები
 * "ლაოდიკიის 35-ე კანონი", "მოციქულთა მე-8" -> (doc, canon) */
const COUNCIL_RX: [RegExp, number][] = [
  [/ორგზის/, 15], [/ნიკეის\s*VII|\bVII\b|მეშვიდე\s+მს/, 7], [/მეექვს|\bVI\b|ტრულ/, 6],
  [/ნიკეის\s*I\b|პირველი\s+მს|ნიკეის\s+კრების/, 2], [/\bIII\b|ეფეს/, 4], [/\bIV\b|ქალკედ/, 5],
  [/\bII\b|II\s*მს/, 3], [/მოციქულთა/, 1], [/ანკვირი|ანკირი/, 8], [/ნეოკესარი/, 9], [/განგრ|ღანგრ/, 10],
  [/ანტიოქი/, 11], [/ლაოდიკი/, 12], [/სარდიკი/, 13], [/კართაგენ/, 14], [/სოფიას|სოფიის/, 16],
  [/ბასილი/, 24],
];
function directRefs(q: string): { doc: number; canon: number }[] {
  const nums = [...q.matchAll(/(?:მე-)?(\d{1,3})(?:-(?:ე|ლი|ს|ზე))?/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 200);
  if (!nums.length) return [];
  const docs = COUNCIL_RX.filter(([rx]) => rx.test(q)).map(([, d]) => d);
  const out: { doc: number; canon: number }[] = [];
  for (const d of docs) for (const n of nums.slice(0, 4)) out.push({ doc: d, canon: n });
  return out.slice(0, 6);
}

/* ------------------------------------------------------------------ BM25 */
export type Hit = { idx: number; score: number };

export function bm25(query: string, limit = 40): Hit[] {
  const ix = getIndex();
  const qf = new Map<string, number>();
  for (const t of features(query)) qf.set(t, (qf.get(t) ?? 0) + 1);
  const scores = new Float64Array(ix.N);
  const k1 = 1.2, b = 0.75;
  for (const [t, qn] of qf) {
    const p = ix.postings.get(t);
    if (!p) continue;
    const df = p.length / 2;
    const idf = Math.log(1 + (ix.N - df + 0.5) / (df + 0.5));
    if (idf < 0.35) continue; // ძალიან გავრცელებული გრამები ხმაურია
    const w = (WEIGHT[t[0]] ?? 1) * idf * (1 + Math.log(qn));
    for (let j = 0; j < p.length; j += 2) {
      const i = p[j], tf = p[j + 1];
      scores[i] += (w * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * ix.len[i]) / ix.avg));
    }
  }
  const top: Hit[] = [];
  for (let i = 0; i < ix.N; i++) if (scores[i] > 0) top.push({ idx: i, score: scores[i] });
  top.sort((a, b2) => b2.score - a.score);
  return top.slice(0, limit);
}

/* ------------------------------------------------------------------ ჯგუფები (კანონი + განმარტება) */
export type Source = {
  n: number;
  label: string;
  href?: string;
  kind: "canon" | "commentary" | "topic";
  excerpt: string; // UI-სთვის
  passages: { head: string; text: string }[]; // LLM-ისთვის
  commHref?: string; // ნიკოდიმოსის განმარტების გვერდი
  score: number;
};

const docTitle = (id: number | null | undefined): string =>
  (id && getDocs().docs.find((d: Doc) => d.id === id)?.title) || "";

function shortTitle(t: string) {
  return t.replace(/\s*საეკლესიო\s*/g, " ").replace(/\s+/g, " ").trim();
}

export function retrieve(query: string, opts: { groups?: number; maxChars?: number; includeOld?: boolean } = {}): Source[] {
  const ix = getIndex();
  // ძველქართულენოვანი ტექსტები (დოკ. 46) მხოლოდ საძიებო გვერდზეა; ასისტენტი თანამედროვე ტექსტს იყენებს
  const oldDocs = new Set((getDocs().docs as Doc[]).filter((d) => d.old).map((d) => d.id));
  const skip = (c: Chunk) => !opts.includeOld && c.doc != null && oldDocs.has(c.doc);
  const maxGroups = opts.groups ?? 7;
  const maxChars = opts.maxChars ?? 18000;
  const hits = bm25(query, 60);
  type G = { score: number; doc?: number | null; canon?: number | null; sj: Set<number>; nik: Set<number>; topic: Set<number>; first: number };
  const groups = new Map<string, G>();
  const touch = (key: string, init: () => { doc?: number | null; canon?: number | null }): G => {
    let gr = groups.get(key);
    if (!gr) {
      gr = { score: 0, sj: new Set(), nik: new Set(), topic: new Set(), first: -1, ...init() };
      groups.set(key, gr);
    }
    return gr;
  };
  const addChunk = (idx: number, score: number) => {
    const c = ix.chunks[idx];
    if (skip(c)) return;
    if (c.src === "topic") {
      // თემატური სარჩევი: მასში მითითებულ კანონებს მივაკუთვნოთ ქულა
      const shown = (c.refs ?? []).flatMap((r) => r.canons.slice(0, 3).map((n) => ({ doc: r.doc, canon: n }))).slice(0, 8);
      for (const r of shown) {
        const gr = touch(`${r.doc}:${r.canon}`, () => ({ doc: r.doc, canon: r.canon }));
        gr.score += score * 0.35;
        gr.topic.add(idx);
      }
      return;
    }
    const key = c.canon && c.doc ? `${c.doc}:${c.canon}` : `x:${c.id}`;
    const gr = touch(key, () => ({ doc: c.doc, canon: c.canon }));
    gr.score += gr.score === 0 ? score : score * 0.4;
    (c.src === "sjuli" ? gr.sj : gr.nik).add(idx);
    if (gr.first < 0) gr.first = idx;
  };
  for (const h of hits) addChunk(h.idx, h.score);
  const top = hits[0]?.score ?? 10;
  const refs = directRefs(query);
  const pureRef = query.trim().split(/\s+/).length <= 4; // "მოციქულთა 35-ე კანონი"
  for (const r of refs) {
    const key = `${r.doc}:${r.canon}`;
    if (ix.canonMap.has(key) || ix.nikMap.has(key)) {
      const gr = touch(key, () => ({ doc: r.doc, canon: r.canon }));
      gr.score += top * (pureRef ? 4 : 1.5);
    }
  }

  const ranked = [...groups.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, maxGroups);
  const sources: Source[] = [];
  let used = 0;
  for (const [key, gr] of ranked) {
    const sjIdx = gr.sj.size ? [...gr.sj] : ix.canonMap.get(key) ?? [];
    let nikIdx = gr.nik.size ? [...gr.nik] : (ix.nikMap.get(key) ?? []).slice(0, 2);
    nikIdx = nikIdx.slice(0, 2);
    const passages: { head: string; text: string }[] = [];
    const gdoc = gr.doc ? getDoc(gr.doc) : undefined;
    const sjHead = gdoc && (gdoc.group === "mcire" || gdoc.group === "churchlaw" || gdoc.group === "synod") ? gdoc.title : "კანონის ტექსტი (დიდი სჯული)";
    for (const i of sjIdx.slice(0, 2)) passages.push({ head: sjHead, text: ix.chunks[i].text });
    for (const i of nikIdx) {
      const c = ix.chunks[i];
      passages.push({ head: `ნიკოდიმოსის განმარტება (${SOURCE_NAMES[c.src].replace("ნიკოდიმოსი (მილაში), ", "")}, PDF გვ. ${c.page})`, text: c.text });
    }
    if (!passages.length && gr.first >= 0) passages.push({ head: "", text: ix.chunks[gr.first].text });
    if (!passages.length) continue;
    const size = passages.reduce((s, p) => s + p.text.length, 0);
    if (used + size > maxChars && sources.length >= 3) continue;
    used += size;
    const ref = ix.chunks[sjIdx[0] ?? nikIdx[0] ?? gr.first];
    const dt = shortTitle(docTitle(gr.doc) || ref?.title || "");
    const secTitle = gr.canon ? gdoc?.titles?.[gr.canon - 1] : undefined;
    const label = gr.canon
      ? secTitle ? `${dt}, ${secTitle}` : `${dt}, ${unitName(gdoc)} ${gr.canon}`
      : shortTitle(ref?.title ?? dt);
    sources.push({
      n: sources.length + 1,
      label,
      href: !gr.doc
        ? undefined
        : sjIdx.length || !getDoc(gr.doc)?.comm
          ? canonHref(gr.doc, sjIdx.length ? gr.canon : null)
          : `/councils/${gr.doc}/commentary${gr.canon ? `#n${gr.canon}` : ""}`,
      kind: sjIdx.length ? "canon" : "commentary",
      excerpt: passages[0].text.slice(0, 380),
      commHref: gr.doc && nikIdx.length && getDoc(gr.doc)?.comm ? `/councils/${gr.doc}/commentary${gr.canon ? `#n${gr.canon}` : ""}` : undefined,
      passages,
      score: gr.score,
    });
  }
  return sources;
}