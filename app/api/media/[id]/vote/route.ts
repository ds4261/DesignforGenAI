import { createClient } from "@/lib/supabase-server";

async function vote(context: { params: Promise<{ id: string }> }, add: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in to vote." }, { status: 401 });
  const { id } = await context.params;
  const { data: media, error: mediaError } = await supabase.from("nyc_caption_media")
    .select("id").eq("id", id).eq("published", true).maybeSingle();
  if (mediaError) return Response.json({ error: "Could not load this caption." }, { status: 503 });
  if (!media) return Response.json({ error: "This caption is unavailable." }, { status: 404 });
  const result = add
    ? await supabase.from("nyc_caption_votes").upsert({ media_id: id, user_id: user.id }, { onConflict: "media_id,user_id", ignoreDuplicates: true })
    : await supabase.from("nyc_caption_votes").delete().eq("media_id", id).eq("user_id", user.id);
  if (result.error) return Response.json({ error: "Could not save your vote. Please try again." }, { status: 503 });
  const { count, error } = await supabase.from("nyc_caption_votes").select("media_id", { count: "exact", head: true }).eq("media_id", id);
  if (error) return Response.json({ error: "Your vote was saved, but the count could not be loaded. Refresh the gallery." }, { status: 503 });
  return Response.json({ voted: add, votes: count ?? 0 });
}

export async function PUT(_request: Request, context: { params: Promise<{ id: string }> }) { return vote(context, true); }
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) { return vote(context, false); }
