import { createClient } from "../../utils/supabase/client";

export type MerchantAuditChanges = Record<
  string,
  { from: unknown; to: unknown }
>;

export type MerchantAuditActor = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
};

export type MerchantAuditEntry = {
  id: string;
  merchant_id: string;
  actor_admin_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  summary: string;
  changes: MerchantAuditChanges | null;
  created_at: string;
};

const SENSITIVE_KEYS = new Set([
  "password",
  "panNumber",
  "aadharNumber",
  "aadharUrl",
  "panUrl",
  "msmeGstUrl",
  "bankAccountNumber",
  "bankIfsc",
  "upiId",
]);

export function sanitizeAuditValue(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) {
        out[key] = nested == null || nested === "" ? nested : "[redacted]";
      } else {
        out[key] = sanitizeAuditValue(nested);
      }
    }
    return out;
  }
  return value;
}

export function diffAuditChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  keys?: string[],
): MerchantAuditChanges {
  const fields =
    keys ??
    Array.from(
      new Set([
        ...Object.keys(before || {}),
        ...Object.keys(after || {}),
      ]),
    );

  const changes: MerchantAuditChanges = {};
  for (const key of fields) {
    if (SENSITIVE_KEYS.has(key)) continue;
    const from = before?.[key];
    const to = after?.[key];
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    changes[key] = {
      from: sanitizeAuditValue(from),
      to: sanitizeAuditValue(to),
    };
  }
  return changes;
}

/** Best-effort audit insert. Never throws — mutations must still succeed. */
export async function logMerchantAudit(input: {
  merchantId: string;
  actor: MerchantAuditActor | null | undefined;
  action: string;
  summary: string;
  changes?: MerchantAuditChanges | null;
}): Promise<void> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("merchant_audit_logs").insert({
      merchant_id: input.merchantId,
      actor_admin_id: input.actor?.id || null,
      actor_email: input.actor?.email || null,
      actor_role: input.actor?.role || null,
      action: input.action,
      summary: input.summary,
      changes: input.changes && Object.keys(input.changes).length
        ? input.changes
        : null,
    });
    if (error) {
      console.warn("merchant audit log failed:", error.message);
    }
  } catch (error) {
    console.warn("merchant audit log failed:", error);
  }
}

export async function fetchMerchantAuditLogs(
  merchantId: string,
  limit = 40,
): Promise<MerchantAuditEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("merchant_audit_logs")
    .select(
      "id, merchant_id, actor_admin_id, actor_email, actor_role, action, summary, changes, created_at",
    )
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as MerchantAuditEntry[];
}
