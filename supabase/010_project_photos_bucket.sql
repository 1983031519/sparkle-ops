-- Create project-photos storage bucket + RLS policies
-- Run in Supabase SQL Editor

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-photos', 'project-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Authenticated users can upload project photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-photos');

CREATE POLICY "Anyone can view project photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'project-photos');

CREATE POLICY "Authenticated users can update project photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'project-photos');

CREATE POLICY "Authenticated users can delete project photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-photos');
