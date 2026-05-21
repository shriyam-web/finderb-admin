-- Create admin_login_logs table
CREATE TABLE IF NOT EXISTS admin_login_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
    admin_email TEXT NOT NULL,
    login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster querying
CREATE INDEX IF NOT EXISTS idx_admin_login_logs_login_time ON admin_login_logs(login_time DESC);
