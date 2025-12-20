-- Add status column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available' 
CHECK (status IN ('available', 'on-leave', 'unavailable'));