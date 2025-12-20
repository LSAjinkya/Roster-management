-- Enable realtime for leave_requests table
ALTER TABLE public.leave_requests REPLICA IDENTITY FULL;

-- Add table to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'leave_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
  END IF;
END $$;