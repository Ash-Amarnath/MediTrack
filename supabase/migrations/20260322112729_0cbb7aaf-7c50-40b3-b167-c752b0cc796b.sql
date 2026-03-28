
ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

INSERT INTO storage.buckets (id, name, public) VALUES ('medical-attachments', 'medical-attachments', false) ON CONFLICT DO NOTHING;

CREATE POLICY "Users can upload own attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'medical-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'medical-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'medical-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
