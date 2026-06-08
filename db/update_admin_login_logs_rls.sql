-- Enable RLS and allow admin panel client access (anon key) for login logs
ALTER TABLE admin_login_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to admin_login_logs" ON admin_login_logs;
CREATE POLICY "Allow all access to admin_login_logs" ON admin_login_logs FOR ALL USING (true) WITH CHECK (true);
