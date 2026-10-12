import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import VoteButton from "./VoteButton";
import DeleteCaptionButton from "@/app/my-captions/DeleteCaptionButton";

export default async function CaptionCollection({ mine = false }: { mine?: boolean; requestedPage?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const title = mine ? "My captions" : "Caption gallery";
  if (!user) return (
    <main className="gallery-page"><div className="page-shell gallery-board gallery-studio">
      <h1 className="text-3xl font-bold mb-4">{title}</h1>
      <Link href="/" className="button-primary">Sign in to {mine ? "view your captions" : "view and vote"}</Link>
    </div></main>
  );
  const ownerId = user.id;
  async function loadBatch(offset: number) {
    const base = supabase.from("nyc_caption_media")
      .select("id, photo_path, captions, selected_indices, published");
    const filtered = mine ? base.eq("user_id", ownerId).eq("published", true) : base.eq("published", true);
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
      <nav className="nav-links gallery-navigation">
        <Link href="/" className="hover:underline">Home</Link>
        <Link href="/captions" className="hover:underline">Generate captions</Link>
        <Link href={mine ? "/gallery" : "/my-captions"} className="hover:underline">{mine ? "Gallery" : "My captions"}</Link>
      </nav>
      <div className="page-shell gallery-board gallery-studio">
      <h1 className="gallery-pennant">
        <span className="sr-only">{title}</span>
        <svg aria-hidden="true" viewBox="0 0 560 200" className="cloth-pennant">
          <defs>
            <pattern id="pennant-weave" width="4" height="4" patternUnits="userSpaceOnUse">
              <path d="M0 1h4M1 0v4" stroke="var(--paper)" strokeOpacity=".1" strokeWidth=".5" />
            </pattern>
            <linearGradient id="pennant-fold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--paper)" stopOpacity=".16" />
              <stop offset=".45" stopColor="var(--paper)" stopOpacity="0" />
              <stop offset="1" stopColor="#43303d" stopOpacity=".2" />
            </linearGradient>
          </defs>
          <path d="M8 48H552L526 100L552 152H8L34 100Z" fill="var(--pond-blue)" stroke="var(--paper)" strokeWidth="8" strokeLinejoin="round" />
          <path d="M8 48H552L526 100L552 152H8L34 100Z" fill="url(#pennant-weave)" />
          <path d="M8 48H552L526 100L552 152H8L34 100Z" fill="url(#pennant-fold)" />
          <path d="M26 60H533L513 100L533 140H26L47 100Z" fill="none" stroke="var(--paper)" strokeOpacity=".8" strokeWidth="1.5" strokeDasharray="3 4" />
          <text x="280" y="110" textAnchor="middle" fill="var(--voodoo)" fontFamily="Georgia, serif" fontSize="30" fontStyle="italic">{title}</text>
        </svg>
      </h1>
      {mine && <p className="page-description">Your saved photos and captions.</p>}
      {error ? <p role="alert">Captions could not be loaded. Please check the latest caption database setup and try again.</p> : (
        <>
          {cards.length === 0 && <p>No captions here yet. <Link href="/captions" className="underline">Generate some!</Link></p>}
          <div className="gallery-polaroids gallery-board-photos polaroid-board">
            {cards.map((item) => (
              <article key={item.key} className="gallery-polaroid">
                <span className="push-pin" aria-hidden="true" />
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
                      <VoteButton id={item.id} captionIndex={item.entry.index} initialHearts={item.entry.hearts} initialDownvotes={item.entry.downvotes} initialReaction={item.entry.reaction} />
                    )}
                    {mine && <DeleteCaptionButton id={item.id} captionIndex={item.entry.index} />}
                    </div>
                  </section>
                )}
              </article>
            ))}
          </div>

        </>
      )}
    </div></main>
  );
}
