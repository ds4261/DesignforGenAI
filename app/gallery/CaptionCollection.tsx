import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import VoteButton from "./VoteButton";
import DeleteCaptionButton from "@/app/my-captions/DeleteCaptionButton";
import CitySkyline from "../CitySkyline";
import SignInButton from "../SignInButton";

export default async function CaptionCollection({ mine = false }: { mine?: boolean; requestedPage?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const title = mine ? "My captions" : "Caption gallery";
  if (mine && !user) return (
    <main className="gallery-page"><div className="page-shell city-gallery">
      <h1 className="text-3xl font-bold mb-4">{title}</h1>
      <SignInButton>Sign in to view your captions</SignInButton>
    </div></main>
  );
  const ownerId = user?.id;
  async function loadBatch(offset: number) {
    const base = supabase.from("nyc_caption_media")
      .select("id, photo_path, captions, selected_indices, published");
    const filtered = mine ? base.eq("user_id", ownerId!).eq("published", true) : base.eq("published", true);
    return filtered.order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
  }
  const first = await loadBatch(0);
  const media = [...(first.data ?? [])];
  let error = first.error;
  let batchLength = first.data?.length ?? 0;
  while (!error && batchLength === 500) {
    const batch = await loadBatch(media.length);
    error = batch.error;
    media.push(...(batch.data ?? []));
    batchLength = batch.data?.length ?? 0;
  }

  const generations = await Promise.all((media ?? []).map(async (item) => {
    const { data: photo, error: photoError } = await supabase.storage.from("nyc-caption-photos").createSignedUrl(item.photo_path, 3600);
    const captions = item.captions as string[];
    const indices = item.selected_indices as number[];
    const reactions = item.published ? await Promise.all(indices.map(async (index) => {
      if (!user) return { index, hearts: 0, downvotes: 0, reaction: 0, failed: false };
      const [hearts, downvotes, own] = await Promise.all([
        supabase.from("nyc_caption_votes").select("media_id", { count: "exact", head: true }).eq("media_id", item.id).eq("caption_index", index).eq("direction", 1),
        supabase.from("nyc_caption_votes").select("media_id", { count: "exact", head: true }).eq("media_id", item.id).eq("caption_index", index).eq("direction", -1),
        supabase.from("nyc_caption_votes").select("direction").eq("media_id", item.id).eq("caption_index", index).eq("user_id", user.id).maybeSingle(),
      ]);
      return { index, hearts: hearts.count ?? 0, downvotes: downvotes.count ?? 0, reaction: own.data?.direction ?? 0, failed: !!(hearts.error || downvotes.error || own.error) };
    })) : [];
    return { ...item, captions, indices, photo: photo?.signedUrl, photoFailed: !!photoError, reactions };
  }));
  type Generation = (typeof generations)[number];
  type CaptionCard = Generation & { entry: Generation["reactions"][number]; key: string };
  const cards = generations.flatMap<CaptionCard>((item) =>
    item.reactions.map((entry) => ({ ...item, entry, key: `${item.id}-${entry.index}` })));

  return (
    <main className="gallery-page">
      <div className="gallery-skyline-background" aria-hidden="true"><CitySkyline className="gallery-city-art" /></div>
      <div className="gallery-intro page-shell">
        <p className="eyebrow">YOUR PHOTOS. AN AI GENERATED NYC CAPTION.</p>
        <Link href="/captions" className="button-primary">Create your own caption <span aria-hidden="true">↗</span></Link>
        {!user && <p className="palette-muted mt-3 text-sm">Browse the city’s stories. Sign in to vote for your favorites.</p>}
      </div>
      <div className="page-shell city-gallery">
      <h1 className="sr-only">{title}</h1>
      {mine && <div className="subway-platform-heading">
        <span className="subway-line-marker" aria-hidden="true">M</span>
        <div><h1>My captions</h1><p>Your own little line through the city. Scroll sideways to explore.</p></div>
      </div>}
      {error ? <p role="alert">Captions could not be loaded. Please check the latest caption database setup and try again.</p> : (
        <>
          {cards.length === 0 && <p>No captions here yet. <Link href="/captions" className="underline">Generate some!</Link></p>}
          <div className={mine ? "caption-subway-car" : ""}>
          {mine && <div className="subway-car-sign"><span>NEW YORK CITY TRANSIT</span><span>MY CAPTIONS · LOCAL</span></div>}
          <div className={mine ? "subway-caption-scroll" : "gallery-polaroids city-photo-wall"}
            tabIndex={mine ? 0 : undefined} role={mine ? "region" : undefined}
            aria-label={mine ? "Scroll horizontally through your captions" : undefined}>
            {cards.map((item) => (
              <article key={item.key} className={mine ? "gallery-polaroid subway-caption-window" : "gallery-polaroid"}>
                {item.photo && (
                  // Signed storage URLs expire; a plain image displays the private photo.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.photo} alt="Photo with AI-generated captions" className="gallery-polaroid-photo" />
                )}
                {item.photoFailed && <p role="alert">The photo could not be loaded. Refresh to try again.</p>}
                {(
                  <section className="pt-4" aria-label={`Caption ${item.entry.index + 1}`}>
                    <p className="gallery-caption">{item.captions[item.entry.index]}</p>
                    <div className="mt-4 flex items-start justify-between gap-3">
                    {item.entry.failed ? <p role="alert" className="mt-4">Reactions could not be loaded. Refresh to try again.</p> : (
                      <VoteButton id={item.id} captionIndex={item.entry.index} initialHearts={item.entry.hearts} initialDownvotes={item.entry.downvotes} initialReaction={item.entry.reaction} signedIn={!!user} />
                    )}
                    {mine && <DeleteCaptionButton id={item.id} captionIndex={item.entry.index} />}
                    </div>
                  </section>
                )}
              </article>
            ))}
          </div>
          {mine && <div className="subway-car-base" aria-hidden="true"><span /><span /></div>}
          </div>
        </>
      )}
    </div></main>
  );
}
