import { createClient } from "@/lib/supabase-server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in to save captions." }, { status: 401 });
  const { id } = await context.params;
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Choose a caption to save." }, { status: 400 }); }
  const choices = body?.selectedIndices ?? [body?.selectedIndex ?? 0];
  if (!Array.isArray(choices) || choices.length > 3 || choices.some((index) => !Number.isInteger(index) || index < 0 || index > 2)) {
    return Response.json({ error: "Choose from the three generated captions." }, { status: 400 });
  }
  const indices = [...new Set<number>(choices.length ? choices : [0])].sort();
  const { data, error } = await supabase.from("nyc_caption_media")
    .update({ selected_index: indices[0], selected_indices: indices, published: true })
    .eq("id", id).eq("user_id", user.id).eq("published", false).select("id").maybeSingle();
  if (error) return Response.json({ error: "Could not save the caption. Please try again." }, { status: 503 });
  if (!data) {
    const { data: existing } = await supabase.from("nyc_caption_media").select("selected_indices, published")
      .eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!existing?.published || JSON.stringify(existing.selected_indices) !== JSON.stringify(indices)) {
      return Response.json({ error: "This caption is unavailable or has already been saved with a different choice." }, { status: 409 });
    }
  }
  return Response.json({ saved: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in to delete captions." }, { status: 401 });
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Choose a caption to delete." }, { status: 400 }); }
  const index = body?.captionIndex;
  if (index !== null && (!Number.isInteger(index) || index < 0 || index > 2)) {
    return Response.json({ error: "Choose a valid caption to delete." }, { status: 400 });
  }
  const { id } = await context.params;
  const { data: media, error: loadError } = await supabase.from("nyc_caption_media")
    .select("id, published").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (loadError) return Response.json({ error: "Could not load this caption. Please try again." }, { status: 503 });
  if (!media) return Response.json({ error: "This caption is unavailable or does not belong to you." }, { status: 404 });
  if (media.published !== (index !== null)) {
    return Response.json({ error: "Choose a saved caption or delete the private draft." }, { status: 400 });
  }
  const { data: photoPath, error } = await supabase.rpc("delete_own_nyc_caption", {
    p_media_id: id, p_caption_index: index,
  });
  if (error) return Response.json({ error: "Could not delete this caption. Check that the latest database setup is applied and try again." }, { status: 503 });
  let warning;
  if (photoPath) {
    const { error: cleanupError } = await supabase.storage.from("nyc-caption-photos").remove([photoPath]);
    if (cleanupError) warning = "The captions were deleted from both pages, but the photo file could not be removed from storage.";
  }
  return Response.json({ deleted: true, ...(warning ? { warning } : {}) });
}
