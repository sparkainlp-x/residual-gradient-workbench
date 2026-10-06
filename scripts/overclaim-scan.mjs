// SPDX-License-Identifier: AGPL-3.0-only
// Overclaim scan: fails if a tracked text file makes a forbidden claim.
// "free energy" may appear only as a denial (no / not / never / without ... within the same sentence).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set([".git", "node_modules", "_site"]);
const SKIP_FILES = new Set(["LICENSE", "scripts/overclaim-scan.mjs"]);
const EXT = /\.(md|mjs|js|html|css|json|cff|yml|yaml|txt)$/i;

// Always forbidden, with a narrow allowance for explicit disclaimers.
const FORBIDDEN = [
  { re: /\bNASA\b/i, label: "NASA claim" },
  { re: /\bQEC\b|quantum error correct/i, label: "QEC claim" },
  { re: /conscious/i, label: "consciousness claim" },
  { re: /\bmedical\b|\bclinical\b|\bpatient/i, label: "medical claim" },
  { re: /gravit/i, label: "gravity claim" },
  { re: /perpetual motion|over-?unity|zero-point energy/i, label: "perpetual-motion claim" },
];
const DISCLAIMER = /\b(no|not|never|without|nor|none)\b/i;
const FREE_ENERGY = /free[- ]energy/i;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.test(name) || name === "LICENSE") out.push(p);
  }
  return out;
}

const sentences = (text) => text.split(/(?<=[.!?])\s+|\n\s*\n|\n[-*|]/);
const hits = [];
let scanned = 0;
for (const file of walk(root)) {
  const rel = relative(root, file).split("\\").join("/");
  if (SKIP_FILES.has(rel)) continue;
  scanned += 1;
  const text = readFileSync(file, "utf8");
  for (const s of sentences(text)) {
    if (FREE_ENERGY.test(s) && !DISCLAIMER.test(s)) hits.push(`${rel}: "free energy" outside a denial: ${s.trim().slice(0, 160)}`);
    for (const { re, label } of FORBIDDEN) {
      if (re.test(s) && !DISCLAIMER.test(s)) hits.push(`${rel}: ${label}: ${s.trim().slice(0, 160)}`);
    }
  }
}
for (const h of hits) console.log(h);
console.log(`overclaim scan: ${hits.length} hit(s) in ${scanned} file(s)`);
process.exit(hits.length ? 1 : 0);
