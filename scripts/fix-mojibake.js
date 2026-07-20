const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|css|sql|md|json)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function looksLikeMojibake(s) {
  return /â.|Â[^\x00-\x7F]|ðŸ|ï¸/.test(s);
}

/** Convert a mojibake string back to the intended UTF-8 text. */
function decodeMojibake(chunk) {
  try {
    const fixed = Buffer.from(chunk, "latin1").toString("utf8");
    if (!fixed || fixed.includes("\uFFFD")) return null;
    return fixed;
  } catch {
    return null;
  }
}

function repairText(text) {
  let out = text;

  // Long emoji / symbol sequences first (greedy enough for common emoji)
  out = out.replace(/(?:ðŸ|â|ï¸|Â)[\u0080-\u00FF]{1,12}/g, (chunk) => {
    if (!looksLikeMojibake(chunk)) return chunk;
    const fixed = decodeMojibake(chunk);
    return fixed || chunk;
  });

  // Explicit known leftovers
  const pairs = [
    ["âŒ", "❌"],
    ["âœ…", "✅"],
    ["âš ï¸", "⚠️"],
    ["âš ️", "⚠️"],
    ["âš ", "⚠"],
    ["â†’", "→"],
    ["â€¦", "…"],
    ["â€“", "–"],
    ["â€”", "—"],
    ["â€¢", "•"],
    ["â€™", "’"],
    ["â€œ", "“"],
    ["â€", "”"],
    ["Â·", "·"],
    ["ðŸ”§", "🔧"],
    ["ðŸš€", "🚀"],
  ];
  for (const [bad, good] of pairs) {
    out = out.split(bad).join(good);
  }

  return out;
}

const files = walk(ROOT);
let changed = 0;
let hits = 0;

for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  if (!looksLikeMojibake(original) && !original.includes("ðŸ") && !original.includes("â")) {
    continue;
  }
  // Skip this script itself
  if (file.endsWith("fix-mojibake.js")) continue;

  hits += 1;
  const repaired = repairText(original);
  if (repaired !== original) {
    fs.writeFileSync(file, repaired, "utf8");
    changed += 1;
    console.log("fixed:", path.relative(ROOT, file));
  } else {
    console.log("still dirty:", path.relative(ROOT, file));
  }
}

const dashboard = fs.readFileSync(path.join(ROOT, "src/app/dashboard/page.tsx"), "utf8");
const remaining = (dashboard.match(/â|Â[^\x00-\x7F]|ðŸ|ï¸/g) || []).length;
console.log(`hits=${hits} changed=${changed} dashboardRemaining=${remaining}`);

// Print a few remaining snippets if any
if (remaining > 0) {
  const lines = dashboard.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/â|Â[^\x00-\x7F]|ðŸ|ï¸/.test(lines[i])) {
      console.log(`L${i + 1}: ${JSON.stringify(lines[i].slice(0, 160))}`);
    }
  }
}
