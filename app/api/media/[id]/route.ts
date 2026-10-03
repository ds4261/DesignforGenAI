import { createClient } from "@/lib/supabase-server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in to save captions." }, { status: 401 });
  const { id } = await context.params;
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Choose a caption to save." }, { status: 400 }); }
  const index = body?.selectedIndex ?? 0;
  if (!Number.isInteger(index) || index < 0 || index > 2) {
    return Response.json({ error: "Choose one of the three captions." }, { status: 400 });
  }
  const { data, error } = await supabase.from("nyc_caption_media")
    .update({ selected_index: index, published: true })
    .eq("id", id).eq("user_id", user.id).eq("published", false).select("id").maybeSingle();
  if (error) return Response.json({ error: "Could not save the caption. Please try again." }, { status: 503 });
  if (!data) {
    const { data: existing } = await supabase.from("nyc_caption_media").select("selected_index, published")
      .eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!existing?.published || existing.selected_index !== index) {
      return Response.json({ error: "This caption is unavailable or has already been saved with a different choice." }, { status: 409 });
    }
  }
  return Response.json({ saved: true });
}
