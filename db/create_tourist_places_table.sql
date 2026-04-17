-- Create tourist_places table
CREATE TABLE IF NOT EXISTS tourist_places (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    location TEXT NOT NULL, -- City, State
    category TEXT, -- e.g., Historical, Nature, Adventure
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE tourist_places ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all access for now (or restrict as needed)
CREATE POLICY "Allow all access to tourist_places" ON tourist_places FOR ALL USING (true);
