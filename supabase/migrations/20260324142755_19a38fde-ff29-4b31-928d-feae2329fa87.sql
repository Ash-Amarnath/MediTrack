-- Add recording_url column to appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS recording_url text;

-- Create storage bucket for appointment recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('appointment-recordings', 'appointment-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for recordings bucket
CREATE POLICY "Users can upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'appointment-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'appointment-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'appointment-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);