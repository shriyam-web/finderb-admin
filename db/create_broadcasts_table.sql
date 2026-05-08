-- Create broadcasts table
CREATE TABLE IF NOT EXISTS broadcasts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT,
    message TEXT NOT NULL,
    target_audience TEXT[] NOT NULL, -- Array of audiences (e.g., ['Users', 'Merchants'])
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all access for now (consistent with other tables in this project)
CREATE POLICY "Allow all access to broadcasts" ON broadcasts FOR ALL USING (true);
