-- Track how long each admin session stayed signed in.
ALTER TABLE admin_login_logs ADD COLUMN IF NOT EXISTS logout_at TIMESTAMPTZ;
ALTER TABLE admin_login_logs ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE admin_login_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE admin_login_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_admin_login_logs_login_time ON admin_login_logs(login_time DESC);
CREATE INDEX IF NOT EXISTS idx_admin_login_logs_admin_id ON admin_login_logs(admin_id);
