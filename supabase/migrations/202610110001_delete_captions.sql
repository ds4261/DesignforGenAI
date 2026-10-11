-- Run after the multiple-caption migration. No existing captions are deleted by this setup.
begin;

create or replace function public.delete_own_nyc_caption(
  p_media_id uuid,
  p_caption_index integer default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  media public.nyc_caption_media%rowtype;
  remaining integer[];
begin
  if auth.uid() is null then
    raise exception 'Sign in to delete captions' using errcode = '42501';
  end if;

  -- Lock the generation so simultaneous deletes preserve the remaining choices.
  select * into media from public.nyc_caption_media
    where id = p_media_id and user_id = auth.uid() for update;
  if not found then return null; end if;

  if not media.published then
    if p_caption_index is not null then
      raise exception 'Delete the draft as a whole' using errcode = '22023';
    end if;
    delete from public.nyc_caption_media where id = media.id;
    return media.photo_path;
  end if;

  if p_caption_index is null or p_caption_index not between 0 and 2 then
    raise exception 'Choose a caption to delete' using errcode = '22023';
  end if;
  if not (p_caption_index = any(media.selected_indices)) then return null; end if;

  remaining := array_remove(media.selected_indices, p_caption_index);
  if cardinality(remaining) = 0 then
    -- The foreign key deletes the generation's votes as well.
    delete from public.nyc_caption_media where id = media.id;
    return media.photo_path;
  end if;

  delete from public.nyc_caption_votes
    where media_id = media.id and caption_index = p_caption_index;
  update public.nyc_caption_media
    set selected_indices = remaining, selected_index = remaining[1]
    where id = media.id;
  return null;
end;
$$;

revoke all on function public.delete_own_nyc_caption(uuid, integer) from public, anon;
grant execute on function public.delete_own_nyc_caption(uuid, integer) to authenticated;
notify pgrst, 'reload schema';
commit;
