// One-off: report KYC status distribution, then reset every merchant to "pending".
// Run: node scripts/reset-kyc-pending.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    /* file may not exist */
  }
}

loadEnv(".env.local");
loadEnv(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase URL or key in .env/.env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

const { data: rows, error } = await supabase
  .from("Business")
  .select("id, businessName, kycStatus, isVerified");

if (error) {
  console.error("Fetch failed:", error.message);
  process.exit(1);
}

const counts = {};
for (const row of rows) {
  const status = (row.kycStatus || "null").toLowerCase();
  counts[status] = (counts[status] || 0) + 1;
}
console.log("Current kycStatus distribution:", counts);
console.log(
  "isVerified=true count:",
  rows.filter((r) => r.isVerified === true).length,
);

const offenders = rows.filter(
  (r) => (r.kycStatus || "").toLowerCase() !== "pending" || r.isVerified,
);

if (offenders.length === 0) {
  console.log("All merchants already have kycStatus=pending and isVerified=false. Nothing to do.");
  process.exit(0);
}

console.log(`Resetting ${offenders.length} merchant(s)...`);
for (const row of offenders) {
  console.log(` - ${row.businessName || row.id}: kycStatus=${row.kycStatus}, isVerified=${row.isVerified}`);
}

const { error: updateError, count } = await supabase
  .from("Business")
  .update({ kycStatus: "pending", isVerified: false })
  .in(
    "id",
    offenders.map((r) => r.id),
  )
  .select("id");

if (updateError) {
  console.error("Update failed:", updateError.message);
  process.exit(1);
}

console.log(`Done. Reset ${offenders.length} merchant(s) to kycStatus=pending, isVerified=false.`);
