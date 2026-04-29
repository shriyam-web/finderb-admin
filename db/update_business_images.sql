ALTER TABLE public."Business" 
ADD COLUMN IF NOT EXISTS "images" text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "profilePictureUrl" text;
