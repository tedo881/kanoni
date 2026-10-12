/** ძიებისას სიტყვების მონიშვნა: ქართული ფორმებისადმი ტოლერანტულია (სიტყვის დასაწყისით ემთხვევა). */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** საძიებო სიტყვების ფუძეები (პირველი 5 ასო, მოკლე სიტყვები — მთლიანად) */
export function stems(q: string): string[] {
  const out: string[] = [];
  for (const w of q.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (w.length < 3) continue;
    const s = w.length >= 6 ? w.slice(0, 5) : w;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/** ფუძით დაწყებული მთელი სიტყვის ამომცნობი გამოსახულება */
export function highlightRe(q: string): RegExp | null {
  const st = stems(q);
  if (!st.length) return null;
  return new RegExp(`(?:${st.map(esc).join("|")})[\\p{L}\\p{N}]*`, "giu");
}

/** ამოჭრილი ფრაგმენტი პირველი დამთხვევის ირგვლივ (null — დამთხვევა არ არის) */
export function snippet(text: string, q: string, len = 320): string | null {
  const re = highlightRe(q);
  const m = re ? re.exec(text) : null;
  if (!m) return null;
  let start = Math.max(0, m.index - Math.round(len * 0.3));
  if (start > 0) {
    const sp = text.indexOf(" ", start);
    if (sp !== -1 && sp < m.index) start = sp + 1;
  }
  const end = Math.min(text.length, start + len);
  return (start > 0 ? "… " : "") + text.slice(start, end).trim() + (end < text.length ? " …" : "");
}
