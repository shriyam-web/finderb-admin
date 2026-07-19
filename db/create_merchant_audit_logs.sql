-- Merchant mutation audit trail (append-only, pragmatic client writes)
CREATE TABLE IF NOT EXISTS public.merchant_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT NOT NULL,
  actor_admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_audit_logs_merchant_created
  ON public.merchant_audit_logs (merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_merchant_audit_logs_action_created
  ON public.merchant_audit_logs (action, created_at DESC);

ALTER TABLE public.merchant_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to merchant_audit_logs" ON public.merchant_audit_logs;
CREATE POLICY "Allow all access to merchant_audit_logs"
  ON public.merchant_audit_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);
