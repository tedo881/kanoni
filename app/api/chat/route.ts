import { isKinshipQuery, KINSHIP_GUIDE, KINSHIP_HEAD, KINSHIP_HREF, KINSHIP_LABEL } from "@/lib/kinship";
import { retrieve, type Source } from "@/lib/search";
import { complete, llmConfigured, llmIsLocal, streamChat, type Msg } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `შენ ხარ „საეკლესიო სამართლის“ ასისტენტი — მართლმადიდებლური ეკლესიის კანონების მკითხველის დამხმარე.

მკაცრი წესები:
1. უპასუხე მხოლოდ მოწოდებული ფრაგმენტების საფუძველზე. ფრაგმენტები სამი სახისაა: „კანონის ტექსტი“ (დიდი სჯული, არსენ იყალთოელის თარგმანი), „მცირე სჯულის კანონის“ ტექსტი (იოანე მმარხველის/მონაზვნის კანონარი, ახალ ქართულზე — ეპიტიმიები და აღსარების წესი), საქართველოს ეკლესიის ოფიციალური დოკუმენტები (1995 წლის მართვა-გამგეობის დებულება, კონსტიტუციური შეთანხმება და სხვა შეთანხმებები, აგრეთვე წმიდა სინოდის სხდომების ოქმები და განჩინებები 1992–2026 წწ.) და „ნიკოდიმოსის (მილაშის) განმარტება“. მცირე სჯულის კანონის ფრაგმენტი ციტირებისას დაასახელე, როგორც „მცირე სჯულის კანონი“, დიდი სჯულისგან გამიჯნე.
2. ყოველი დებულების შემდეგ მიუთითე წყარო კვადრატულ ფრჩხილებში, მაგალითად [1] ან [2][3]. წყაროს ნომრები ემთხვევა ფრაგმენტების ნომრებს.
3. თუ ფრაგმენტებში პასუხი არ ჩანს ან არასაკმარისია, პირდაპირ თქვი ეს. არასოდეს მოიგონო კანონის ნომერი, ციტატა ან განმარტება. არ დაამატო ცოდნა, რომელიც ფრაგმენტებში არ არის.
4. კანონის ტექსტს ციტირებისას გადმოწერე ზუსტად, ბრჭყალებში, და მიუთითე კრება და კანონის ნომერი.
5. განასხვავე, რას ამბობს თვით კანონი და რას განმარტავს ნიკოდიმოსი. თუ ფრაგმენტში არის „ნიკოდიმოსის განმარტება“, აუცილებლად გამოიყენე: კანონის შინაარსის შემდეგ ცალკე აბზაცში დაწერე „ნიკოდიმოსის განმარტებით: …“ და მიუთითე იმ ფრაგმენტის ნომერი. თუ განმარტება კითხვას არ ეხება ან ტექსტი ამოუკითხავია (OCR), ეს არ დაფარო და მხოლოდ გასაგები ნაწილი გადმოეცი.
6. თუ ფრაგმენტები ერთმანეთს არ ეთანხმება ან კანონები განსხვავებულ შემთხვევებს ეხება, აჩვენე ორივე.
7. ქართულად, გასაგებად და მოკლედ (საჭიროების შემთხვევაში მოკლე სიით). არ დაწერო ზოგადი შესავალი და არ გაიმეორო ეს წესები.
8. სამღვდელო, პირად ან სადავო საკითხებში ბოლოს ერთი წინადადებით შეახსენე, რომ კონკრეტული შემთხვევის გადასაწყვეტად საჭიროა სასულიერო პირთან კონსულტაცია.
9. ტექსტი არ დაიწყო „მოცემული ფრაგმენტის მიხედვით“.
10. თუ ფრაგმენტი პანაიოტის ბუმისის „კანონიკური სამართლიდანაა“ (სამეცნიერო სახელმძღვანელო, ავტორის განმარტება და არა კანონის ტექსტი), გადმოეცი შინაარსი საკუთარი სიტყვებით, მხოლოდ ძალიან მოკლე ციტატებით, და დააფიქსირე, რომ ეს ავტორის მოსაზრებაა და არა თვით კანონი.
11. პასუხის გაცემისას ყოველთვის გადაამოწმე და გაითვალისწინე როგორც ნიკოდიმოსის (მილაშის) განმარტებები, ისე ბუმისის „კანონიკური სამართლის“ ფრაგმენტები, თუ ისინი მოწოდებულ ფრაგმენტებში არის და კითხვას ეხება; კანონის ტექსტი, ნიკოდიმოსის განმარტება და ბუმისის მოსაზრება ერთმანეთისგან გამიჯნე.
12. თუ ფრაგმენტი დეკანოზ ზურაბ მჭედლიშვილის წიგნიდან „მართლმადიდებელი ეკლესიის კანონიკური სამართალი“ (2023) არის და პასუხში გამოიყენე, გადმოეცი შინაარსი საკუთარი სიტყვებით (ციტატა — მხოლოდ მოკლე), დასახელე წიგნი როგორც წყარო და დაუკავშირე კითხვას. ასეთი ფრაგმენტი კითხვას თუ ეხება, აუცილებლად გამოიყენე. პასუხის ბოლოს, თუ ამ წიგნის ფრაგმენტი გამოიყენე, ერთხელ, ცალკე ხაზზე დაწერე ზუსტად ასე: „წიგნის შეძენა შესაძლებელია: საბურთალოს წმ. იოანე ღვთისმეტყველის ტაძარში (ზურაბ ანჯაფარიძის ქუჩა N21) და საეკლესიო წიგნების მაღაზია „ჩირაღდანი“-ში (თბილისი, ვერცხლის ქ. 32).“
13. თუ კითხვა ქორწინებას ან ნათესაობას ეხება (შესაძლებელია თუ არა კონკრეტული ქორწინება), ფრაგმენტებში მოცემული „ნათესაური ქორწინების ცნობარი“ და მჭედლიშვილის წიგნის ფრაგმენტები ძირითადი წყაროა. იმოქმედე ასე: (ა) გაარკვიე კონკრეტულად ვინ ვის შერთვაზეა საუბარი და ნათესაობის სახე (სისხლით / მძახლობითი / სულიერი / შვილად აყვანით); თუ ურთიერთობა გაურკვეველია, ჯერ დაზუსტება ითხოვე; (ბ) სისხლით ნათესაობაში გამოიყვანე საერთო წინაპარი და ეტაპობრივად დათვალე ხარისხი, როგორც ცნობარშია; (გ) მიუთითე, სად აქვს წიგნს პირდაპირი ჩამონათვალი ამ შემთხვევისთვის და მისი [ნომერი]; (დ) დასაწყისშივე მკაფიოდ თქვი წიგნის მიხედვით: დაუშვებელია / დაშვებულია / დამოკიდებულია გარემოებაზე; (ე) თუ ზუსტი შემთხვევა მასალაში არ არის ან ხარისხი სადავო საზღვარზეა (მე-6, მე-7), ამის შესახებ პირდაპირ დაწერე და ურჩიე სასულიერო პირთან ან ეპარქიაში კონსულტაცია; ეკლესიის დღევანდელი პრაქტიკა ან განსხვავებული წესები, რომლებიც მასალაში არ არის, არ გამოიგონო.`;

// დღიური საერთო ლიმიტი უფასო API-ს კვოტის დასაცავად (0 = გამორთული). სერვერულ გარემოში თითო ინსტანციაზე ითვლება.
const day = { date: "", n: 0 };
function dailyExceeded(): boolean {
  const max = Number(process.env.DAILY_LIMIT ?? 400);
  if (!max) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (day.date !== today) Object.assign(day, { date: today, n: 0 });
  return ++day.n > max;
}

const hits = new Map<string, { n: number; reset: number }>();
function limited(ip: string): boolean {
  const max = Number(process.env.RATE_LIMIT_PER_10MIN ?? 30);
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + 10 * 60_000 });
    return false;
  }
  return ++h.n > max;
}

function buildContext(sources: Source[]): string {
  return sources
    .map((s) => {
      const body = s.passages.map((p) => (p.head ? `(${p.head})\n${p.text}` : p.text)).join("\n\n");
      return `[${s.n}] ${s.label}\n${body}`;
    })
    .join("\n\n=====\n\n");
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return Response.json({ error: "ძალიან ბევრი მოთხოვნაა. სცადეთ რამდენიმე წუთში." }, { status: 429 });

  if (dailyExceeded()) {
    return Response.json({ error: "დღევანდელი უფასო ლიმიტი ამოიწურა. სცადეთ ხვალ, ან გამოიყენეთ ძიება ცალკე გვერდზე." }, { status: 429 });
  }

  let body: { messages?: { role: string; content: string }[]; context?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "არასწორი მოთხოვნა" }, { status: 400 });
  }
  const history = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-8)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 2000) }));
  // ხელახლა ცდა: უკვე მოძიებული ფრაგმენტები მოდის კლიენტიდან — ძიებას აღარ ვიმეორებთ
  const reuse = typeof body.context === "string" && body.context.length > 0 && body.context.length <= 40000 ? body.context : null;
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  if (!lastUser || !lastUser.content.trim()) return Response.json({ error: "კითხვა ცარიელია" }, { status: 400 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const t0 = Date.now();
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const configured = await llmConfigured();
        const local = llmIsLocal();
        // საძიებო მოთხოვნა: მოკლე გაგრძელების შემთხვევაში წინა კითხვასაც ვითვალისწინებთ
        const userMsgs = history.filter((m) => m.role === "user");
        let query = lastUser.content;
        if (query.length < 40 && userMsgs.length > 1) query = userMsgs[userMsgs.length - 2].content + " " + query;

        // ლოკალურ (პატარა) მოდელზე გაფართოება ნელია და ნაკლებად სარგებლიანი; ჩვეულებრივ ირთვება მხოლოდ ღრუბლოვან API-ზე
        if (!reuse && configured && (local ? process.env.QUERY_REWRITE === "1" : process.env.QUERY_REWRITE !== "0")) {
          try {
            send({ type: "stage", stage: "expand" });
            const kw = await complete([
              {
                role: "system",
                content:
                  "მოგცემ კითხვას ქართულად. დაწერე 8-12 საძიებო სიტყვა ან მოკლე ფრაზა, რომლებიც ამ თემაზე გამოიყენება მართლმადიდებლური საეკლესიო კანონების ტექსტში (სამღვდელო პირთა წოდებები, ცოდვების და სასჯელების სახელწოდებები, სინონიმები, ძველი ქართული ფორმები). გამოიყენე მხოლოდ ქართული სიტყვები, გამოყავი მძიმით, სხვა არაფერი დაწერო.",
              },
              { role: "user", content: query },
            ], 7000, (label) => send({ type: "model", for: "expand", label }));
            query += " " + kw.replace(/[^ა-ჿ\s,]/g, " ");
          } catch {
            /* გაფართოების გარეშეც ვაგრძელებთ */
          }
        }

        let sources: ReturnType<typeof retrieve> = [];
        let ctx = reuse ?? "";
        if (!reuse) {
          send({ type: "stage", stage: "search" });
          // ქორწინება/ნათესაობა: მჭედლიშვილის წიგნის მეტი ფრაგმენტი + ცნობარი, რომ AI ზუსტად და გააზრებულად უპასუხოს
          const kin = isKinshipQuery(query);
          sources = retrieve(query, {
            // ლოკალურ მოდელს მცირე კონტექსტი აქვს, ამიტომ ნაკლებ ფრაგმენტს ვაძლევთ
            groups: local ? 4 : 7,
            maxChars: Number(process.env.RAG_MAX_CHARS ?? (local ? 9000 : 18000)),
            ekMin: kin ? 4 : 2,
          });
          if (kin) {
            sources.unshift({
              n: 0, label: KINSHIP_LABEL, href: KINSHIP_HREF, kind: "commentary",
              excerpt: KINSHIP_GUIDE.slice(0, 380),
              passages: [{ head: KINSHIP_HEAD, text: KINSHIP_GUIDE }], score: 1e9,
            } as Source);
            sources.forEach((x, i) => { x.n = i + 1; });
          }
          ctx = sources.length ? buildContext(sources) : "";
          send({
            type: "sources",
            ctx,
            sources: sources.map(({ n, label, href, kind, excerpt, commHref, passages, hidden }) => ({
              n, label, href, kind, excerpt, commHref, hidden,
              // ორივე სახის ფრაგმენტი ჩანდეს: კანონის ტექსტი და ნიკოდიმოსის განმარტება
              // ფარული წყაროს ტექსტი მომხმარებელს არ ეგზავნება (AI მას იყენებს)
              parts: hidden ? [] : passages.map((p) => ({ comm: p.head.startsWith("ნიკოდიმოსის"), head: p.head.startsWith("კანონის ტექსტი") ? "კანონის ტექსტი" : p.head, text: p.text.slice(0, 300) })),
            })),
          });
        }

        if (!configured) {
          send({
            type: "info",
            text: "AI მოდელი ჯერ არ არის ჩართული, ამიტომ ნაჩვენებია მხოლოდ მოძებნილი კანონები და განმარტებები. უფასოდ ჩასართავად დააინსტალირეთ Ollama და გაუშვით `npm run setup:ai` (იხ. README), ან ჩაწერეთ Gemini გასაღები .env.local-ში.",
          });
        } else if (!reuse && !sources.length) {
          send({ type: "delta", text: "ამ თემაზე შესაბამისი ადგილი ვერ ვიპოვე. სცადეთ სხვა სიტყვებით ან მიუთითეთ კონკრეტული კრება და კანონი." });
        } else {
          send({ type: "stage", stage: "ai" });
          // თუ მასალა AI-სთვის ძალიან დიდია, თანმიმდევრულად ვამცირებთ (ბოლო, ნაკლებად შესაბამის წყაროებს ვაკლებთ)
          const blocks = ctx.split("\n\n=====\n\n");
          let nBlocks = blocks.length;
          let done = false;
          for (const keep of [1, 0.6, 0.35]) {
            let used = 0;
            const total = blocks.reduce((n, x) => n + x.length, 0);
            const cut: string[] = [];
            for (const blk of blocks) {
              if (cut.length > 0 && used + blk.length > total * keep) break;
              cut.push(blk);
              used += blk.length;
            }
            if (keep < 1 && cut.length >= nBlocks) continue; // შემცირება არ მოხდა — იგივეს არ ვიმეორებთ
            if (keep < 1) send({ type: "note", text: `მასალა AI-სთვის ძალიან დიდი აღმოჩნდა — ვამცირებ: ${blocks.length} წყაროდან ${cut.length} რჩება` });
            nBlocks = cut.length;
            const msgs: Msg[] = [
              { role: "system", content: SYSTEM },
              ...history.slice(0, -1),
              {
                role: "user",
                content: `ფრაგმენტები:\n\n${cut.join("\n\n=====\n\n")}\n\n-----\nკითხვა: ${lastUser.content}`,
              },
            ];
            let gotAny = false;
            try {
              for await (const d of streamChat(msgs, req.signal, (label) => send({ type: "model", for: "ai", label }), { deadline: t0 + 54_000 })) {
                gotAny = true;
                send({ type: "delta", text: d });
              }
              done = true;
              break;
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              const tooBig = /დააბრუნა 413|too large|too long|reduce your message|context length|maximum context|exceeds the maximum/i.test(msg);
              if (gotAny || !tooBig || keep === 0.35 || req.signal.aborted) throw e;
            }
          }
          if (!done) throw new Error("მასალის შემცირება ვერ მოხერხდა");
        }
        send({ type: "done" });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "უცნობი შეცდომა" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}