import fs from "fs";
import path from "path";

const root = path.resolve("e:/projects/FinderB Sites/FinderB Admin");

const files = [
  "src/app/dashboard/page.tsx",
  "src/components/SettingsContent.tsx",
  "src/components/FinderBJobsContent.tsx",
  "src/components/BlogContent.tsx",
].map((f) => path.join(root, f));

function refineClasses(classes) {
  let c = classes;

  const swaps = [
    ["bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden min-h-[400px]", "admin-card min-h-[400px]"],
    ["bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col overflow-hidden", "admin-card flex flex-col"],
    ["bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden", "admin-card"],
    ["bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6", "admin-card p-6"],
    ["bg-white rounded-2xl border border-slate-200/60 shadow-sm", "admin-card"],
    ["text-xl font-medium tracking-tight text-slate-900 uppercase", "admin-page-title"],
    ["text-xl font-medium text-slate-900 tracking-tight uppercase", "admin-page-title"],
    ["text-[10px] text-slate-500 font-normal uppercase tracking-widest opacity-70", "admin-page-subtitle"],
    ["text-[10px] text-slate-500 font-normal uppercase tracking-widest", "admin-page-subtitle"],
  ];

  for (const [from, to] of swaps) {
    c = c.split(from).join(to);
  }

  c = c.replace(/\buppercase\b/g, "");
  c = c.replace(/\btracking-widest\b/g, "");
  c = c.replace(/\btracking-\[0\.2em\]\b/g, "");
  c = c.replace(/\btracking-\[0\.3em\]\b/g, "");
  c = c.replace(/\btracking-tighter\b/g, "");
  c = c.replace(/\btext-\[9px\]\b/g, "text-xs");
  c = c.replace(/\btext-\[10px\]\b/g, "text-xs");
  c = c.replace(/\btext-\[11px\]\b/g, "text-sm");
  c = c.replace(/\brounded-2xl\b/g, "rounded-xl");
  c = c.replace(/\bshadow-lg shadow-primary\/25\b/g, "");
  c = c.replace(/\bshadow-lg shadow-primary\/20\b/g, "");
  c = c.replace(/\bshadow-lg shadow-primary\/30\b/g, "");
  c = c.replace(/\bshadow-lg shadow-secondary\/30\b/g, "");
  c = c.replace(/\bgroup-hover:scale-110\b/g, "");
  c = c.replace(/\bgroup-hover:scale-105\b/g, "");
  c = c.replace(/\bgroup-hover:scale-x-105\b/g, "");
  c = c.replace(/\bhover:shadow-xl hover:shadow-primary\/5\b/g, "");
  c = c.replace(/\banimate-pulse\b/g, "");
  c = c.replace(/\banimate-ping\b/g, "");
  c = c.replace(/\s+/g, " ").trim();
  return c;
}

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, "utf8");
  content = content.replace(/className="([^"]*)"/g, (_, classes) => {
    return `className="${refineClasses(classes)}"`;
  });
  content = content.replace(/className=\{`([^`]*)`\}/g, (match, classes) => {
    return match;
  });
  fs.writeFileSync(file, content);
  console.log("Updated", path.relative(root, file));
}
