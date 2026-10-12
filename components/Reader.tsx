"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CommentToggle from "./CommentToggle";

const SIZES = ["0.95rem", "1.03rem", "1.125rem", "1.3rem", "1.55rem"];

function clearMarks(root: HTMLElement) {
  root
    .querySelectorAll("mark.find")
    .forEach((m) =>
      m.replaceWith(document.createTextNode(m.textContent ?? "")),
    );
  root.normalize();
}
function markAll(root: HTMLElement, q: string): HTMLElement[] {
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(esc, "gi");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    // კომენტარებს (React-ის მართულ ნაწილს) არ ვეხებით
    acceptNode: (n) =>
      n.parentElement?.closest(".cm-slot")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  const out: HTMLElement[] = [];
  for (const node of nodes) {
    const text = node.nodeValue ?? "";
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    let last = 0;
    const frag = document.createDocumentFragment();
    let any = false;
    while ((m = re.exec(text))) {
      any = true;
      if (m.index > last) frag.append(text.slice(last, m.index));
      const mk = document.createElement("mark");
      mk.className = "find";
      mk.textContent = m[0];
      frag.append(mk);
      out.push(mk);
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    if (any) {
      if (last < text.length) frag.append(text.slice(last));
      node.replaceWith(frag);
    }
  }
  return out;
}

type LangSwitch = {
  cur: { id: number; label: string };
  other: { id: number; label: string };
  map: Record<string, number>;
};

export default function Reader({
  docId,
  html,
  canons,
  inline = [],
  hasComm = false,
  titles,
  unit = "კანონი",
  lang,
}: {
  docId: number;
  html: string;
  canons: number[];
  inline?: number[];
  hasComm?: boolean;
  titles?: string[];
  unit?: string;
  lang?: LangSwitch;
}) {
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  const [fn, setFn] = useState<{ label: string; text: string } | null>(null);
  const [q, setQ] = useState("");
  const [marks, setMarks] = useState<HTMLElement[]>([]);
  const [cur, setCur] = useState(0);
  const [size, setSize] = useState(2);
  const [sizeReady, setSizeReady] = useState(false); // შენახული ზომა წაკითხულია
  const [slots, setSlots] = useState<HTMLElement[]>([]);
  useEffect(() => {
    setSlots(
      Array.from(root.current?.querySelectorAll<HTMLElement>(".cm-slot") ?? []),
    );
  }, [html]);
  const inlineSet = useMemo(() => new Set(inline), [inline]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("kanoni:size");
      const s = raw === null ? NaN : Number(raw);
      if (Number.isInteger(s) && s >= 0 && s < SIZES.length) setSize(s);
      localStorage.setItem(
        "kanoni:last",
        JSON.stringify({ id: docId, t: Date.now() }),
      );
    } catch {}
    setSizeReady(true);
  }, [docId]);
  useEffect(() => {
    if (!sizeReady) return; // ნაგულისხმევი ზომა შენახულს არ გადაეწეროს (ტექსტი აღარ „ითამაშებს“)
    document.documentElement.style.setProperty("--reader-size", SIZES[size]);
    try {
      localStorage.setItem("kanoni:size", String(size));
    } catch {}
  }, [size, sizeReady]);

  // ძიებიდან მოსული სიტყვა (?q=...) ავტომატურად მოინიშნოს
  useEffect(() => {
    try {
      const pre = new URLSearchParams(location.search).get("q");
      if (pre) setQ(pre);
    } catch {}
  }, [docId]);

  // ძიება გვერდზე
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const t = setTimeout(() => {
      clearMarks(el);
      const query = q.trim();
      if (query.length < 2) {
        setMarks([]);
        setCur(0);
        return;
      }
      const found = markAll(el, query);
      setMarks(found);
      // თუ კონკრეტულ კანონზე (#kN) მოვედით, დავიწყოთ მისი პირველი დამთხვევიდან
      let start = 0;
      const target = location.hash
        ? document.getElementById(location.hash.slice(1))
        : null;
      if (target) {
        const idx = found.findIndex(
          (m) =>
            target.compareDocumentPosition(m) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        );
        if (idx > 0) start = idx;
      }
      setCur(start);
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    marks.forEach((m, i) => m.classList.toggle("active", i === cur));
    marks[cur]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [marks, cur]);

  const step = useCallback(
    (d: number) => {
      if (!marks.length) return;
      setCur((c) => (c + d + marks.length) % marks.length);
    },
    [marks.length],
  );

  const jump = (n: string) => {
    if (!n) return;
    history.replaceState(null, "", `#k${n}`);
    const el = document.getElementById(`k${n}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    el?.animate(
      [
        { background: "color-mix(in srgb, var(--gold) 45%, transparent)" },
        { background: "transparent" },
      ],
      { duration: 2200 },
    );
  };

  // ძველ/ახალ ქართულ ტექსტს შორის გადართვა: ვრჩებით იმავე თავზე, რომელსაც ახლა ვკითხულობთ
  const switchLang = () => {
    if (!lang) return;
    let cur = canons[0];
    for (const n of canons) {
      const el = document.getElementById(`k${n}`);
      if (el && el.getBoundingClientRect().top <= 160) cur = n;
    }
    const mapped = lang.map[String(cur)] ?? 1;
    const atTop = cur === canons[0] && window.scrollY < 300;
    const qs = q.trim().length >= 2 ? `?q=${encodeURIComponent(q.trim())}` : "";
    router.push(`/councils/${lang.other.id}${qs}${atTop ? "" : `#k${mapped}`}`);
  };

  // სქოლიოს ნომერზე დაჭერა: ტექსტი ჩნდება ქვემოთ, გადასვლის გარეშე
  const onArticleClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>(
      "a[data-fn]",
    );
    if (!a) return;
    e.preventDefault();
    const id = a.dataset.fn!;
    const note = root.current?.querySelector(`#fn-${id}`);
    if (!note) return;
    const label = id.startsWith("s") ? "*" + id.slice(1) : id;
    const text = (note.textContent ?? "").replace(/^\s*\*?\d+\.\s*/, "");
    setFn((f) => (f && f.label === label ? null : { label, text }));
  };
  useEffect(() => {
    if (!fn) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setFn(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [fn]);
  useEffect(() => setFn(null), [docId]);

  const html_ = useMemo(() => ({ __html: html }), [html]);

  return (
    <>
      <div
        className="reader-bar"
        role="toolbar"
        aria-label="წაკითხვის პარამეტრები"
      >
        <div className="find">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ძიება ამ გვერდზე…"
            aria-label="ძიება ამ გვერდზე"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                step(e.shiftKey ? -1 : 1);
              }
            }}
          />
          {q.trim().length >= 2 && (
            <span className="count" aria-live="polite">
              {marks.length ? `${cur + 1}/${marks.length}` : "0"}
            </span>
          )}
          <button
            className="mini-btn"
            onClick={() => step(-1)}
            disabled={!marks.length}
            aria-label="წინა"
          >
            ▲
          </button>
          <button
            className="mini-btn"
            onClick={() => step(1)}
            disabled={!marks.length}
            aria-label="შემდეგი"
          >
            ▼
          </button>
        </div>
        {lang && (
          <div className="lang-switch" role="group" aria-label="ტექსტის ენა">
            {[lang.cur, lang.other]
              .sort((a, b) => a.label.localeCompare(b.label, "ka"))
              .map((l) =>
                l.id === docId ? (
                  <button
                    key={l.id}
                    className="on"
                    aria-pressed="true"
                    disabled
                  >
                    {l.label}
                  </button>
                ) : (
                  <button key={l.id} aria-pressed="false" onClick={switchLang}>
                    {l.label}
                  </button>
                ),
              )}
          </div>
        )}
        {canons.length > 1 && (
          <select
            aria-label={`გადასვლა: ${unit}`}
            defaultValue=""
            onChange={(e) => {
              jump(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              {unit}…
            </option>
            {canons.map((n) => (
              <option key={n} value={n}>
                {titles?.[n - 1] ? `${n}. ${titles[n - 1]}` : `${unit} ${n}`}
              </option>
            ))}
          </select>
        )}
        {hasComm && (
          <Link className="bar-link" href={`/councils/${docId}/commentary`}>
            განმარტებები
          </Link>
        )}
        <div className="size-ctl" aria-label="ტექსტის ზომა">
          <button
            onClick={() => setSize((s) => Math.max(0, s - 1))}
            disabled={size === 0}
            aria-label="ტექსტის შემცირება"
            style={{ fontSize: "0.8rem" }}
          >
            ა
          </button>
          <button
            onClick={() => setSize((s) => Math.min(SIZES.length - 1, s + 1))}
            disabled={size === SIZES.length - 1}
            aria-label="ტექსტის გაზრდა"
            style={{ fontSize: "1.15rem" }}
          >
            ა
          </button>
        </div>
      </div>
      <article
        ref={root}
        className={`prose${lang ? " mcire" : ""}`}
        dangerouslySetInnerHTML={html_}
        onClick={onArticleClick}
        lang="ka"
      />
      {fn && (
        <div className="fnpop" role="dialog" aria-label="სქოლიო">
          <b>სქოლიო {fn.label}</b>
          <button
            className="mini-btn"
            onClick={() => setFn(null)}
            aria-label="დახურვა"
          >
            ✕
          </button>
          <p>{fn.text}</p>
        </div>
      )}
      {slots.map((s) => {
        const k = Number(s.dataset.k);
        return inlineSet.has(k)
          ? createPortal(<CommentToggle doc={docId} canon={k} />, s, `c${k}`)
          : null;
      })}
    </>
  );
}
