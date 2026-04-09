-- Create the job-photos storage bucket and RLS policies
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New Query

-- 1. Create bucket (or ensure it's public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload job photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'job-photos');

-- 3. Allow anyone to view photos (public bucket)
CREATE POLICY "Anyone can view job photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'job-photos');

-- 4. Allow authenticated users to update photos
CREATE POLICY "Authenticated users can update job photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'job-photos');

-- 5. Allow authenticated users to delete photos
CREATE POLICY "Authenticated users can delete job photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'job-photos');
