#!/usr/bin/env python3
"""
HTML (ძველი Android აპის ასეტები) + ნიკოდიმოსის ორი PDF  ->  data/*.json

გაშვება:
    python3 scripts/build_data.py --pdf1 <ტომი I.pdf> --pdf2 <ტომი II.pdf>

შედეგი:
    data/docs.json          41 დოკუმენტის მეტამონაცემები (კრებები, ეპისტოლეები)
    data/docs/<id>.html     გასუფთავებული HTML მკითხველისთვის (კანონებს აქვთ id="k<N>")
    data/parts.json         14 თემატური ნაწილი, მითითებები დაკავშირებულია დოკუმენტებთან
    data/chunks.json.gz     AI ძიების ფრაგმენტები (კანონები + თემები + ნიკოდიმოსის განმარტებები)
"""
import argparse, gzip, json, re, subprocess, sys
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "source" / "legacy-assets"
DATA = ROOT / "data"
G = "ა-ჰ"

# ---------------------------------------------------------------- დოკუმენტები
GROUPS = [
    ("apostolic", "მოციქულთა კანონები", [1]),
    ("ecumenical", "მსოფლიო კრებები", list(range(2, 8))),
    ("local", "ადგილობრივი კრებები", list(range(8, 17))),
    ("fathers", "წმინდა მამათა კანონები და ეპისტოლეები", list(range(17, 41))),
    ("ruisi", "რუის-ურბნისის კრება", [41]),
    ("extra", "დამატებითი კანონები (ნიკოდიმოსის გამოცემიდან)", [42, 43, 44]),
]
GROUP_OF = {i: g for g, _, ids in GROUPS for i in ids}

ALLOWED = {"h3", "h4", "p", "strong", "b", "em", "i", "sup", "sub", "br", "ul", "ol", "li", "blockquote"}


def clean_html(raw: str, doc_id: int):
    soup = BeautifulSoup(raw, "lxml")
    body = soup.body or soup
    for t in body.find_all(["script", "style", "meta", "link", "iframe"]):
        t.decompose()
    for t in list(body.find_all(True)):
        if t.name not in ALLOWED:
            t.unwrap()
        else:
            t.attrs = {}
    # ცარიელი აბზაცების მოშორება
    for p in body.find_all("p"):
        txt = p.get_text().replace("\xa0", " ").strip()
        if not txt and not p.find(["img"]):
            p.decompose()
    # თავში/ბოლოში მდგარი <br>
    for br in body.find_all("br"):
        nxt = br.next_sibling
        if br.previous_sibling is None or (isinstance(nxt, NavigableString) and not nxt.strip() and br.next_sibling.next_sibling is None):
            br.decompose()
    # აბზაცები, რომლებიც თითქმის მთლიანად <strong>-შია (კანონის ტექსტი): ნახევრად თამამი სტილი
    for p_ in body.find_all("p"):
        total = len(p_.get_text().strip())
        bold = sum(len(x.get_text()) for x in p_.find_all("strong"))
        if total and bold / total >= 0.85:
            for x in p_.find_all("strong"):
                x.unwrap()
            p_["class"] = "c"
    # კანონების ანკერები
    canons, seen = [], {}
    for h in body.find_all("h3"):
        m = re.match(r"^\s*კანონი\s+(\d+)", h.get_text())
        if m:
            n = int(m.group(1))
            seen[n] = seen.get(n, 0) + 1
            h["id"] = f"k{n}" if seen[n] == 1 else f"k{n}-{seen[n]}"
            if seen[n] == 1:
                canons.append(n)
    # ადგილი ნიკოდიმოსის განმარტებისთვის (კანონის ბოლოს) — მკითხველი მას ღილაკით ავსებს
    canon_h3 = [h for h in body.find_all("h3") if h.get("id") and re.match(r"^k\d+$", h["id"])]
    for i, h in enumerate(canon_h3):
        slot = BeautifulSoup(f'<div class="cm-slot" data-k="{h["id"][1:]}"></div>', "lxml").div
        if i + 1 < len(canon_h3):
            canon_h3[i + 1].insert_before(slot)
        else:
            body.append(slot)
    html = body.decode_contents() if body.name == "body" else str(body)
    html = re.sub(r"\n{3,}", "\n\n", html).strip()
    return html, canons, body


def plain(el) -> str:
    t = el.get_text(" ") if isinstance(el, Tag) else str(el)
    return re.sub(r"\s+", " ", t.replace("\xa0", " ")).strip()


def split_text(text: str, maxlen: int = 1400):
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= maxlen:
        return [text] if text else []
    out, cur = [], ""
    for s in re.split(r"(?<=[.!?:;»”\"])\s+", text):
        if len(cur) + len(s) + 1 > maxlen and cur:
            out.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}".strip()
        while len(cur) > maxlen * 1.5:  # ძალიან გრძელი წინადადება
            out.append(cur[:maxlen])
            cur = cur[maxlen:]
    if cur:
        out.append(cur)
    return out


def build_docs(titles):
    docs, chunks = [], []
    sj_text = {}
    for i in range(1, len(titles) + 1):
        raw = (ASSETS / f"{i}.html").read_text(encoding="utf-8")
        html, canons, body = clean_html(raw, i)
        (DATA / "docs").mkdir(parents=True, exist_ok=True)
        (DATA / "docs" / f"{i}.html").write_text(html, encoding="utf-8")
        title = titles[i - 1]
        docs.append({"id": i, "title": title, "group": GROUP_OF[i], "canons": canons,
                     "chars": len(plain(body))})
        # ფრაგმენტები
        label = title
        h3s = [h for h in body.find_all("h3") if h.get("id")]
        if h3s:
            # შესავალი (h3-მდე)
            first = h3s[0]
            intro = []
            for el in body.find_all(["p", "h3", "h4"]):
                if el is first:
                    break
                intro.append(plain(el))
            for k, part in enumerate(split_text(" ".join(intro))):
                chunks.append(dict(id=f"s{i}-intro-{k}", src="sjuli", doc=i, canon=None, title=label,
                                   text=part))
            for h in h3s:
                n = h["id"][1:]
                txt = []
                for sib in h.next_siblings:
                    if isinstance(sib, Tag) and sib.name == "h3":
                        break
                    txt.append(plain(sib))
                body_txt = " ".join(x for x in txt if x)
                sj_text.setdefault(i, {})[int(n.split("-")[0])] = body_txt
                for k, part in enumerate(split_text(body_txt)):
                    chunks.append(dict(id=f"s{i}-{n}-{k}", src="sjuli", doc=i, canon=int(n.split('-')[0]),
                                       anchor=h["id"], title=label, text=part))
        else:
            paras = [plain(el) for el in body.find_all(["p", "h4"]) if plain(el)]
            for k, part in enumerate(split_text(" ".join(paras))):
                chunks.append(dict(id=f"s{i}-{k}", src="sjuli", doc=i, canon=None, title=label, text=part))
    return docs, chunks, sj_text


# ---------------------------------------------------------------- თემატური ნაწილები
REF_RULES = [  # (რეგექსი, doc id) — თანმიმდევრობას მნიშვნელობა აქვს
    (r"ორგზის", 15),
    (r"ნიკეის\s+VII|\bVII\b", 7),
    (r"მეექვს|\bVI\b|ტრულ", 6),
    (r"ნიკეის\s+I\b|(?<![IV])I\s+მს|ნიკეის\s+კრების|ნიკეის\s+კანონ", 2),
    (r"(?<![IV])III\s+მს|ეფესო", 4),
    (r"\bIV\b|ქალკედონ", 5),
    (r"(?<![IV])II\s+მს|კონსტანტინე?პოლის\s+კრების|კონსტანტინე?პოლის\s+II", 3),
    (r"მოც\S*ულთა|მოციქულთა", 1),
    (r"ანკვირიის", 8), (r"ნეოკესარიის", 9), (r"ღანგრის", 10), (r"ანტიოქიის", 11),
    (r"ლად?ოკიის|ლაოდიკ", 12), (r"სარდიკიის", 13), (r"კართაგენის", 14),
    (r"სოფიას|სოფიის", 16),
    (r"ტარასი", 17), (r"დიონისე", 18), (r"გრიგოლ\s+ნეოკესარიელ|საკვირველთმოქმედ", 19),
    (r"ათანასე.*ამონ", 20), (r"ათანასე.*39", 21), (r"ათანასე.*რუფინ", 22),
    (r"პეტრე", 23),
    (r"ბასილი.*დიოდორ", 25), (r"ბასილი.*გრიგოლ\s+ხუცეს", 26), (r"ბასილი.*ქორეპისკოპოს", 27),
    (r"ბასილი|ბასილის", 24),
    (r"ტიმოთე", 33), (r"თეოფილე", 34),
    (r"ლიბიელ", 36), (r"კირილე", 35),
    (r"გრიგოლ\s+ნოსელ", 37), (r"მრგვლივ", 38),
]
REF_LINE = re.compile(r"^(?P<label>.*?\S)\s+(?P<nums>\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)*)\s*[.;]?$")


def resolve_doc(label: str):
    for rx, doc in REF_RULES:
        if re.search(rx, label):
            return doc
    return None


def parse_nums(s: str):
    out = []
    for part in re.split(r"\s*,\s*", s.strip()):
        m = re.match(r"^(\d+)\s*[-–]\s*(\d+)$", part)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            out.extend(range(a, b + 1) if 0 < b - a < 120 else [a, b])
        elif part.isdigit():
            out.append(int(part))
    return out


def build_parts(docs_by_id):
    parts, chunks = [], []
    for n in range(1, 15):
        raw = (ASSETS / f"v{n}.html").read_text(encoding="utf-8")
        soup = BeautifulSoup(raw, "lxml")
        for br in soup.find_all("br"):
            br.replace_with("\n")
        text = soup.get_text("\n").replace("\xa0", " ")
        lines = [re.sub(r"\s+", " ", l).strip() for l in text.split("\n")]
        lines = [l for l in lines if l]
        head = lines[0]
        m = re.match(r"^ნაწილი\s+([IVXL]+)", head)
        roman = m.group(1) if m else str(n)
        idx = 1
        sub = []
        while idx < len(lines) and not lines[idx].startswith("თავი"):
            sub.append(lines[idx]); idx += 1
        chapters, cur = [], None
        for l in lines[idx:]:
            if re.match(r"^თავი\s+[IVXLC]+\.", l):
                cur = {"title": re.sub(r"\s*:\s*$", "", l), "refs": []}
                chapters.append(cur)
            elif cur is not None:
                mm = REF_LINE.match(l)
                if mm:
                    nums = parse_nums(mm.group("nums"))
                    cur["refs"].append({"label": mm.group("label"), "doc": resolve_doc(mm.group("label")),
                                        "canons": nums, "raw": l})
                else:
                    cur["refs"].append({"label": l, "doc": resolve_doc(l), "canons": [], "raw": l})
        parts.append({"n": n, "roman": roman, "title": " ".join(sub), "chapters": chapters})
        for ci, ch in enumerate(chapters):
            ref_txt = "; ".join(r["raw"] for r in ch["refs"])
            chunks.append(dict(id=f"t{n}-{ci}", src="topic", part=n, title=f"თემატური ნაწილი {roman}",
                               text=f"{ch['title']}. მითითებული კანონები: {ref_txt}",
                               refs=[{"doc": r["doc"], "canons": r["canons"]} for r in ch["refs"] if r["doc"]]))
    return parts, chunks


# ---------------------------------------------------------------- PDF -> ნიკოდიმოსის განმარტებები
# (საწყისი PDF გვერდი, სათაური, doc id) — doc 42-44: დამატებითი კანონები, რომლებიც ძველ აპში არ იყო
VOL1 = [  # 2007, ტომი I
    (26, "მოციქულთა კანონები", 1), (155, "I მსოფლიო კრება (ნიკეა)", 2),
    (218, "II მსოფლიო კრება (კონსტანტინოპოლი)", 3), (269, "III მსოფლიო კრება (ეფესო)", 4),
    (312, "IV მსოფლიო კრება (ქალკედონი)", 5), (414, "VI მსოფლიო კრება (ტრულის)", 6),
    (577, "VII მსოფლიო კრება (ნიკეა)", 7), (640, None, None),  # სარჩევი: გამოვტოვოთ
]
VOL2 = [  # 2011, ტომი II
    (5, "ანკვირიის კრება", 8), (25, "ნეოკესარიის კრება", 9), (35, "ღანგრის კრება", 10),
    (45, "ანტიოქიის კრება", 11), (72, "ლაოდიკიის კრება", 12), (103, "სარდიკიის კრება", 13),
    (128, "კართაგენის კრება", 14), (248, "კონსტანტინოპოლის ორგზისი კრება", 15),
    (274, "წმინდა სოფიას ტაძრის კრება", 16), (289, "დიონისე ალექსანდრიელის ეპისტოლე", 18),
    (303, "პეტრე ალექსანდრიელის კანონები", 23), (312, "გრიგოლ საკვირველთმოქმედის ეპისტოლე", 19),
    (314, "ათანასე დიდის ეპისტოლე ამონისადმი", 20), (325, "ბასილი დიდის კანონები და ეპისტოლეები", 24),
    (417, "ტიმოთე ალექსანდრიელის კანონიკური პასუხები", 33), (428, "გრიგოლ ნოსელის ეპისტოლე", 37),
    (441, "თეოფილე ალექსანდრიელის კანონები", 34), (450, "კირილე ალექსანდრიელის კანონები", 35),
    (465, "წმინდა იოანე მარხულის კანონები", 42), (492, "წმინდა ნიკიფორე აღმსარებლის კანონები", 43),
    (516, "ნიკოლოზ კონსტანტინოპოლელის კანონები", 44), (531, None, None),
]
EXTRA_DOCS = {42: "წმინდა იოანე მარხულის კანონები", 43: "წმინდა ნიკიფორე აღმსარებლის კანონები",
              44: "ნიკოლოზ კონსტანტინოპოლელი პატრიარქის კანონები"}
# დოკუმენტები, სადაც „დიდი სჯულის“ კანონის ნომრები ემთხვევა ნიკოდიმოსის ნომრებს (შემოწმებულია ტექსტების დამთხვევით).
# კართაგენში (14) ნომრები განსხვავდება, ამიტომ იქ განმარტებები მხოლოდ ცალკე გვერდზეა.
ALIGNED = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 42, 43, 44}

TR = str.maketrans({"I": "1", "l": "1", "O": "0", "o": "0", "|": "1", "!": "1", "i": "1"})
LEAD = r"[\s“”\"„«»'’#+\-–—*]*"
HEAD = re.compile(rf"^{LEAD}([{G}]{{0,3}}[{G}]ნონი)\s+(\S{{1,4}})(?:\s*[(\[«].{{0,16}})?\s*$")
TERMINAL = tuple(".:;!?»”\"…)")


def to_num(tok):
    t = tok.translate(TR)
    return int(t) if t.isdigit() else None


def page_lines(raw_page: str):
    """გვერდის სტრიქონები (ჩაწევის შენარჩუნებით), ზედა სათაურისა და გვერდის ნომრის გარეშე."""
    lines = raw_page.split("\n")
    nb = [i for i, l in enumerate(lines) if l.strip()]
    if nb:
        i = nb[0]
        s = lines[i].strip()
        if len(s) < 120 and not HEAD.match(lines[i]) and (re.match(r"^\d{1,3}\b", s) or re.search(r"\b\d{1,3}[:.]?$", s)):
            lines[i] = ""
    while lines and (not lines[-1].strip() or re.fullmatch(r"\s*\d{1,3}\s*", lines[-1])):
        lines.pop()
    return lines


def join_lines(lines):
    out = ""
    for ln in lines:
        ln = re.sub(r"\s+", " ", ln).strip()
        if not ln:
            continue
        if out and re.search(rf"[{G}][-–­]$", out) and re.match(rf"[{G}]", ln):
            out = out[:-1] + ln  # გადატანის დეფისი
        elif out and re.search(r"\bმე[-–]$", out) and ln[0].isdigit():
            out += ln
        else:
            out = f"{out} {ln}".strip()
    return out


def parse_entries(pdf: Path, start: int, end: int, pages):
    """გვერდების დიაპაზონი -> [{n, p, paras}] (n=0: შესავალი)."""
    entries, cur, last = [], None, 0

    def begin(n, p):
        nonlocal cur
        cur = {"n": n, "p": p, "paras": [], "_prev": ""}
        entries.append(cur)

    begin(0, start)
    for pi in range(start, min(end, len(pages)) + 1):
        for raw in page_lines(pages[pi - 1]):
            s = raw.strip()
            if not s:
                continue
            m = HEAD.match(raw)
            if m:
                n = to_num(m.group(2))
                exp = last + 1
                if n is None or n < 1:
                    n = exp
                elif n == 1 and last >= 3:
                    pass  # ახალი ქვეკრება
                elif exp <= n <= exp + 3 or last == 0:
                    pass
                else:
                    n = exp
                last = n
                begin(n, pi)
                continue
            indent = len(raw) - len(raw.lstrip(" "))
            if not cur["paras"] or (indent >= 3 and cur["_prev"].endswith(TERMINAL)):
                cur["paras"].append([s])
            else:
                cur["paras"][-1].append(s)
            cur["_prev"] = s
    out = []
    for e in entries:
        paras = [join_lines(p) for p in e["paras"]]
        paras = [p for p in paras if p]
        if sum(len(p) for p in paras) < 30:
            continue
        out.append({"n": e["n"], "p": e["p"], "paras": paras})
    return out


# მითითებების (ფრჩხილებში) ამოცნობა: "(მოც. 14, 16; I მსოფლ. 8; ტრულ. 37)"
ABBR = [
    (r"^მოც", 1), (r"^VII\b", 7), (r"^VI\b|^ტრულ", 6), (r"^IV\b", 5), (r"^III\b", 4), (r"^II\b", 3), (r"^[I1l|]\s", 2),
    (r"^ანკ", 8), (r"^ნეოკ", 9), (r"^[ღგ]ანგ", 10), (r"^ანტიო", 11), (r"^ლაოდ", 12), (r"^სარდ", 13),
    (r"^კართ", 14), (r"^ორგზ", 15), (r"^სოფ", 16), (r"^ბას", 24), (r"^კირილე", 35), (r"^თეოფ", 34),
    (r"^ტიმ", 33), (r"^გრიგ.*ნოს|^გრ\.\s*ნოს", 37), (r"^პეტრე", 23), (r"^დიონ", 18),
]


def parse_refs(raw: str):
    body = raw.strip().strip("()[] .")
    res = []
    for part in re.split(r"\s*;\s*", body):
        part = part.strip(" .,")
        m = re.match(r"^(.*?[^\d\s,\-–.])[\s.,–-]*((?:\d+[a-zა-ჰ]?(?:\s*[-–]\s*\d+)?\s*,?\s*)+)$", part)
        if not m:
            continue
        label, nums = m.group(1).strip(" ,.–-"), m.group(2)
        doc = next((d for rx, d in ABBR if re.search(rx, label + " ")), None)
        res.append({"l": label, "d": doc, "n": parse_nums(re.sub(r"[a-zა-ჰ]", "", nums))})
    return res


def structure_entry(e):
    """paras -> ნიკოდიმოსის კანონის ტექსტი | მითითებები | განმარტება."""
    paras, r = e["paras"], None
    for i, p in enumerate(paras[:5]):
        if p.startswith(("(", "[")) and re.search(r"\d", p) and re.search(r"[)\]]\s*[.!]?$", p):
            r = i
            break
    out = {"n": e["n"], "p": e["p"]}
    if r is not None:
        out["t"] = " ".join(paras[:r]) or None
        out["r"] = paras[r]
        out["x"] = parse_refs(paras[r])
        out["c"] = paras[r + 1:]
    else:
        out["t"], out["r"], out["x"], out["c"] = None, None, [], paras
    return out


def extract_pdf(pdf: Path, sections, vol: int):
    txt = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, check=True).stdout.decode("utf-8")
    pages = txt.split("\f")
    res = []
    for si, (start, title, doc) in enumerate(sections[:-1]):
        if title is None:
            continue
        end = sections[si + 1][0] - 1
        entries = [structure_entry(e) for e in parse_entries(pdf, start, end, pages)]
        for e in entries:
            e["v"] = vol
        res.append({"doc": doc, "title": title, "vol": vol, "entries": entries, "si": si})
    return res


def stem_set(t):
    return {w[:5] for w in re.findall(rf"[{G}]{{5,}}", (t or "").lower())}


def entries_to_chunks(sec, src):
    out, k = [], 0
    for e in sec["entries"]:
        body = " ".join(x for x in [e.get("t"), e.get("r")] + e["c"] if x)
        for part in split_text(body):
            out.append(dict(id=f"{src}-{sec['si']}-{k}", src=src, doc=sec["doc"], canon=e["n"] or None,
                            title=f"ნიკოდიმოსი (მილაში), {'ტ. I (2007)' if sec['vol'] == 1 else 'ტ. II (2011)'}: {sec['title']}",
                            page=e["p"], text=part))
            k += 1
    return out


def build_extra_html(sec):
    parts = []
    for e in sec["entries"]:
        if e["n"] == 0:
            continue
        parts.append(f'<h3 id="k{e["n"]}">კანონი {e["n"]}</h3>')
        if e.get("t"):
            parts.append(f'<p class="c">{e["t"]}</p>')
        if e.get("r"):
            parts.append(f'<p><em>{e["r"]}</em></p>')
        if not e.get("t") and e["c"]:
            parts.append(f'<p>{e["c"][0]}</p>')
        parts.append(f'<div class="cm-slot" data-k="{e["n"]}"></div>')
    return "\n".join(parts)


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf1", type=Path)
    ap.add_argument("--pdf2", type=Path)
    a = ap.parse_args()

    titles = json.loads((ROOT / "source" / "titles.json").read_text(encoding="utf-8"))
    DATA.mkdir(exist_ok=True)
    (DATA / "commentary").mkdir(exist_ok=True)

    docs, ch_docs, sj_text = build_docs(titles)
    parts, ch_topics = build_parts({d["id"]: d for d in docs})
    (DATA / "parts.json").write_text(json.dumps(parts, ensure_ascii=False, indent=1), encoding="utf-8")

    chunks = ch_docs + ch_topics
    unresolved = sum(1 for p in parts for c in p["chapters"] for r in c["refs"] if r["canons"] and not r["doc"])
    print(f"docs={len(docs)} sjuli-chunks={len(ch_docs)} topic-chunks={len(ch_topics)} unresolved-refs={unresolved}")

    secs = []
    for pdf, sections, vol, src in ((a.pdf1, VOL1, 1, "nik1"), (a.pdf2, VOL2, 2, "nik2")):
        if pdf and pdf.exists():
            for sec in extract_pdf(pdf, sections, vol):
                sec["src"] = src
                secs.append(sec)
        else:
            print(f"გამოტოვებულია {src}: PDF არ არის მითითებული")

    by_id = {d["id"]: d for d in docs}
    for sec in secs:
        doc = sec["doc"]
        if doc in EXTRA_DOCS:  # ახალი დოკუმენტი PDF-იდან
            canons = [e["n"] for e in sec["entries"] if e["n"] > 0]
            html = build_extra_html(sec)
            (DATA / "docs" / f"{doc}.html").write_text(html, encoding="utf-8")
            docs.append({"id": doc, "title": EXTRA_DOCS[doc], "group": "extra", "canons": canons,
                         "chars": len(html)})
            by_id[doc] = docs[-1]
        # ზოგ დოკუმენტს რამდენიმე ამოღება ჰქონდეს — გავაერთიანოთ
        (DATA / "commentary" / f"{doc}.json").write_text(
            json.dumps({"doc": doc, "vol": sec["vol"], "title": sec["title"], "entries": sec["entries"]},
                       ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        # რომელ კანონებზე ჩავრთოთ განმარტება უშუალოდ მკითხველში
        inline, bad = [], []
        if doc in ALIGNED:
            for e in sec["entries"]:
                n = e["n"]
                if n <= 0 or n not in by_id[doc]["canons"]:
                    continue
                if doc in EXTRA_DOCS:
                    inline.append(n)
                    continue
                a_, b_ = stem_set(sj_text.get(doc, {}).get(n)), stem_set(e.get("t") or " ".join(e["c"][:2])[:600])
                ov = len(a_ & b_) / min(len(a_), len(b_)) if a_ and b_ else 0
                (inline if ov >= 0.12 else bad).append(n)
        by_id[doc]["comm"] = {"total": len([e for e in sec["entries"] if e["n"] > 0]), "inline": sorted(set(inline)),
                              "intro": any(e["n"] == 0 for e in sec["entries"])}
        chunks += entries_to_chunks(sec, sec["src"])
        print(f"  doc {doc:>2} {sec['title'][:34]:<34} entries={len(sec['entries']):>3} inline={len(inline):>3} lowsim={bad}")

    for d in docs:
        d["aligned"] = d["id"] in ALIGNED and "comm" in d
    docs.sort(key=lambda d: d["id"])
    (DATA / "docs.json").write_text(json.dumps({"groups": [{"id": g, "title": t, "docs": ids} for g, t, ids in GROUPS],
                                                 "docs": docs}, ensure_ascii=False, indent=1), encoding="utf-8")
    with gzip.open(DATA / "chunks.json.gz", "wt", encoding="utf-8", compresslevel=9) as f:
        json.dump(chunks, f, ensure_ascii=False, separators=(",", ":"))
    print("chunks total:", len(chunks), "size:", round((DATA / "chunks.json.gz").stat().st_size / 1e6, 1), "MB")


if __name__ == "__main__":
    sys.exit(main())
