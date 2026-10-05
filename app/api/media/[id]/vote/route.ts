import { createClient } from "@/lib/supabase-server";

async function vote(request: Request, context: { params: Promise<{ id: string }> }, remove: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in to vote." }, { status: 401 });
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Choose a caption and reaction." }, { status: 400 }); }
  const index = body?.captionIndex;
  const direction = body?.direction;
  if (!Number.isInteger(index) || index < 0 || index > 2 || (!remove && direction !== 1 && direction !== -1)) {
    return Response.json({ error: "Choose a valid caption and reaction." }, { status: 400 });
  }
  const { id } = await context.params;
  const { data: media, error: mediaError } = await supabase.from("nyc_caption_media")
    .select("id, selected_indices").eq("id", id).eq("published", true).maybeSingle();
  if (mediaError) return Response.json({ error: "Could not load this caption." }, { status: 503 });
  if (!media || !media.selected_indices.includes(index)) return Response.json({ error: "This caption is unavailable." }, { status: 404 });
  const result = remove
    ? await supabase.from("nyc_caption_votes").delete().eq("media_id", id).eq("caption_index", index).eq("user_id", user.id)
    : await supabase.from("nyc_caption_votes").upsert({ media_id: id, caption_index: index, user_id: user.id, direction }, { onConflict: "media_id,caption_index,user_id" });
  if (result.error) return Response.json({ error: "Could not save your reaction. Please try again." }, { status: 503 });
  const [hearts, downvotes] = await Promise.all([1, -1].map((value) => supabase.from("nyc_caption_votes")
    .select("media_id", { count: "exact", head: true }).eq("media_id", id).eq("caption_index", index).eq("direction", value)));
  if (hearts.error || downvotes.error) return Response.json({ error: "Your reaction was saved, but counts could not be loaded. Refresh the gallery." }, { status: 503 });
  return Response.json({ reaction: remove ? 0 : direction, hearts: hearts.count ?? 0, downvotes: downvotes.count ?? 0 });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) { return vote(request, context, false); }
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { return vote(request, context, true); }
