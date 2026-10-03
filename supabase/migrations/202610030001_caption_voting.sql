-- Dedicated NYC caption tables preserve any existing caption_media or caption_votes tables.
-- This setup can be rerun; it only replaces policies owned by this feature.
begin;

create table if not exists public.nyc_caption_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_path text not null unique,
  captions text[] not null check (cardinality(captions) = 3),
  selected_index integer not null default 0 check (selected_index between 0 and 2),
  system_prompt text not null,
  user_prompt text not null,
  model text not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  check (split_part(photo_path, '/', 1) = user_id::text)
);

create table if not exists public.nyc_caption_votes (
  media_id uuid not null references public.nyc_caption_media(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (media_id, user_id)
);

create index if not exists nyc_caption_media_gallery on public.nyc_caption_media(created_at desc) where published;
create index if not exists nyc_caption_media_owner on public.nyc_caption_media(user_id);
create index if not exists nyc_caption_votes_user on public.nyc_caption_votes(user_id);
alter table public.nyc_caption_media enable row level security;
alter table public.nyc_caption_votes enable row level security;
revoke all on public.nyc_caption_media, public.nyc_caption_votes from anon, authenticated;
grant select, insert on public.nyc_caption_media to authenticated;
grant update (selected_index, published) on public.nyc_caption_media to authenticated;
grant select, insert, delete on public.nyc_caption_votes to authenticated;

drop policy if exists "NYC captions: Read published media or own drafts" on public.nyc_caption_media;
create policy "NYC captions: Read published media or own drafts" on public.nyc_caption_media
  for select to authenticated using (published or user_id = (select auth.uid()));
drop policy if exists "NYC captions: Create own caption drafts" on public.nyc_caption_media;
create policy "NYC captions: Create own caption drafts" on public.nyc_caption_media
  for insert to authenticated with check (user_id = (select auth.uid()) and not published);
drop policy if exists "NYC captions: Publish own draft once" on public.nyc_caption_media;
create policy "NYC captions: Publish own draft once" on public.nyc_caption_media
  for update to authenticated using (user_id = (select auth.uid()) and not published)
  with check (user_id = (select auth.uid()) and published);

drop policy if exists "NYC captions: Read votes on published media" on public.nyc_caption_votes;
create policy "NYC captions: Read votes on published media" on public.nyc_caption_votes
  for select to authenticated using (exists (
    select 1 from public.nyc_caption_media m where m.id = media_id and m.published
  ));
drop policy if exists "NYC captions: Vote once on published media" on public.nyc_caption_votes;
create policy "NYC captions: Vote once on published media" on public.nyc_caption_votes
  for insert to authenticated with check (user_id = (select auth.uid()) and exists (
    select 1 from public.nyc_caption_media m where m.id = media_id and m.published
  ));
drop policy if exists "NYC captions: Remove own vote" on public.nyc_caption_votes;
create policy "NYC captions: Remove own vote" on public.nyc_caption_votes
  for delete to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nyc-caption-photos', 'nyc-caption-photos', false, 4194304,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "NYC captions: Upload own caption photos" on storage.objects;
create policy "NYC captions: Upload own caption photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'nyc-caption-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "NYC captions: Read own or published caption photos" on storage.objects;
create policy "NYC captions: Read own or published caption photos" on storage.objects
  for select to authenticated using (bucket_id = 'nyc-caption-photos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or exists (
      select 1 from public.nyc_caption_media m where m.photo_path = name and m.published
    )
  ));
drop policy if exists "NYC captions: Clean up unreferenced own photos" on storage.objects;
create policy "NYC captions: Clean up unreferenced own photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'nyc-caption-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.nyc_caption_media m where m.photo_path = name)
  );
commit;
