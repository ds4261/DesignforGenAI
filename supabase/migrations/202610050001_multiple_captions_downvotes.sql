-- Run after 202610030001_caption_voting.sql. Existing captions and hearts are preserved.
begin;
alter table public.nyc_caption_media add column if not exists selected_indices integer[];
update public.nyc_caption_media set selected_indices = array[selected_index] where selected_indices is null;
alter table public.nyc_caption_media alter column selected_indices set default array[0];
alter table public.nyc_caption_media alter column selected_indices set not null;
alter table public.nyc_caption_media drop constraint if exists nyc_caption_media_choices_check;
alter table public.nyc_caption_media add constraint nyc_caption_media_choices_check check (
  cardinality(selected_indices) between 1 and 3
  and selected_indices <@ array[0,1,2]
  and array_position(selected_indices, null) is null
  and selected_index = selected_indices[1]
);
grant update (selected_indices) on public.nyc_caption_media to authenticated;

alter table public.nyc_caption_votes add column if not exists caption_index integer;
update public.nyc_caption_votes v set caption_index = m.selected_index
  from public.nyc_caption_media m where v.media_id = m.id and v.caption_index is null;
alter table public.nyc_caption_votes alter column caption_index set not null;
alter table public.nyc_caption_votes add column if not exists direction smallint not null default 1;
alter table public.nyc_caption_votes drop constraint if exists nyc_caption_votes_pkey;
alter table public.nyc_caption_votes add primary key (media_id, caption_index, user_id);
alter table public.nyc_caption_votes drop constraint if exists nyc_caption_votes_reaction_check;
alter table public.nyc_caption_votes add constraint nyc_caption_votes_reaction_check
  check (caption_index between 0 and 2 and direction in (-1, 1));
-- Upserts include their primary key columns; RLS restricts both old and new rows.
grant update on public.nyc_caption_votes to authenticated;
drop policy if exists "NYC captions: Vote once on published media" on public.nyc_caption_votes;
create policy "NYC captions: Vote once on published media" on public.nyc_caption_votes
  for insert to authenticated with check (user_id = (select auth.uid()) and exists (
    select 1 from public.nyc_caption_media m where m.id = media_id and m.published
      and caption_index = any(m.selected_indices)
  ));
drop policy if exists "NYC captions: Change own reaction" on public.nyc_caption_votes;
create policy "NYC captions: Change own reaction" on public.nyc_caption_votes
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.nyc_caption_media m where m.id = media_id and m.published
      and caption_index = any(m.selected_indices)
  ));
notify pgrst, 'reload schema';
commit;
