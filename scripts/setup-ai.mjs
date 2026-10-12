#!/usr/bin/env node
// ერთი ბრძანებით ამზადებს უფასო ლოკალურ AI მოდელს: Ollama + Gemma 3 (ქართულს ცნობს).
//   npm run setup:ai            (ავტომატურად ირჩევს მოდელს RAM-ის მიხედვით)
//   npm run setup:ai -- gemma3:12b
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts });

const has = spawnSync("ollama", ["--version"], { shell: process.platform === "win32", encoding: "utf-8" });
if (has.status !== 0) {
  console.log(`\nOllama ვერ მოიძებნა. დააინსტალირეთ: https://ollama.com/download\nშემდეგ გაუშვით ეს ბრძანება თავიდან.\n`);
  process.exit(1);
}

const ramGb = os.totalmem() / 2 ** 30;
const base = process.argv[2] || (ramGb >= 24 ? "gemma3:27b" : ramGb >= 14 ? "gemma3:12b" : "gemma3:4b");
console.log(`RAM: ${ramGb.toFixed(0)} GB → მოდელი: ${base}\n(ჩამოტვირთვა ერთხელ ხდება; 4b ≈ 3 GB, 12b ≈ 8 GB)\n`);

if (run("ollama", ["pull", base]).status !== 0) process.exit(1);

// გრძელი კონტექსტი (კანონების ფრაგმენტებისთვის) — ნაგულისხმევი 4096 არ ჰყოფნის
fs.writeFileSync("Modelfile", `FROM ${base}\nPARAMETER num_ctx 8192\nPARAMETER temperature 0.2\n`);
if (run("ollama", ["create", "kanoni-gemma", "-f", "Modelfile"]).status !== 0) process.exit(1);
fs.rmSync("Modelfile", { force: true });

// .env.local: ლოკალური მოდელი (გასაღებს არ ვეხებით)
const file = ".env.local";
let env = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
const set = (k, v) => {
  const re = new RegExp(`^${k}=.*$`, "m");
  env = re.test(env) ? env.replace(re, `${k}=${v}`) : env + (env && !env.endsWith("\n") ? "\n" : "") + `${k}=${v}\n`;
};
set("LLM_BASE_URL", "http://localhost:11434/v1");
set("LLM_MODEL", "kanoni-gemma");
set("LLM_API_KEY", "");
fs.writeFileSync(file, env);

console.log("\n✔ მზადაა. გაუშვით: npm run dev  და გახსენით /assistant\n");
