-- Allow a read-only homepage preview of published captions for signed-out visitors.
-- Prompts, owner details, private drafts, votes and write permissions stay restricted.
begin;
grant select (id, photo_path, captions, selected_indices, published, created_at)
  on public.nyc_caption_media to anon;
drop policy if exists "NYC captions: Public homepage preview" on public.nyc_caption_media;
create policy "NYC captions: Public homepage preview" on public.nyc_caption_media
  for select to anon using (published);
drop policy if exists "NYC captions: Public preview photos" on storage.objects;
create policy "NYC captions: Public preview photos" on storage.objects
  for select to anon using (
    bucket_id = 'nyc-caption-photos' and exists (
      select 1 from public.nyc_caption_media m where m.photo_path = name and m.published
    )
  );
notify pgrst, 'reload schema';
commit;
