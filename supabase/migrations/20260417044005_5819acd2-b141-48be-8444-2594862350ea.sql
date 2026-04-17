INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Question images are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'question-images');

CREATE POLICY "Admins can upload question images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'question-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update question images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'question-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete question images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'question-images' AND has_role(auth.uid(), 'admin'::app_role));