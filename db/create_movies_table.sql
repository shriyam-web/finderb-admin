-- Create movies table
CREATE TABLE IF NOT EXISTS movies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    finderb_rating DECIMAL(3, 1),
    release_date DATE,
    poster_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all access for now (or restrict as needed)
CREATE POLICY "Allow all access to movies" ON movies FOR ALL USING (true);
