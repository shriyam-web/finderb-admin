-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert super admin if not exists
INSERT INTO admins (email, password, role)
VALUES ('admin@finderb.com', 'finderb123', 'super_admin')
ON CONFLICT (email) DO UPDATE 
SET role = 'super_admin';
