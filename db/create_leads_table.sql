-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    category TEXT NOT NULL,
    business_id TEXT REFERENCES public."Business"(id),
    message TEXT,
    status TEXT NOT NULL DEFAULT 'New',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for category wise filtering
CREATE INDEX IF NOT EXISTS leads_category_idx ON public.leads (category);
CREATE INDEX IF NOT EXISTS leads_status_idx ON public.leads (status);
