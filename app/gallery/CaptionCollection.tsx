import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import VoteButton from "./VoteButton";
import DraftPublisher from "@/app/captions/DraftPublisher";

export default async function CaptionCollection({ mine = false, requestedPage }: { mine?: boolean; requestedPage?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const title = mine ? "My captions" : "Caption gallery";
  if (!user) return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-4">{title}</h1>
      <Link href="/" className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-white">Sign in to {mine ? "view your captions" : "view and vote"}</Link>
    </main>
  );
  const parsedPage = Number(requestedPage ?? 1);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10000) : 1;
  const size = 12;
  const base = supabase.from("nyc_caption_media")
    .select("id, photo_path, captions, selected_indices, published", { count: "exact" });
  const filtered = mine ? base.eq("user_id", user.id) : base.eq("published", true);
  const { data: media, error, count } = await filtered.order("created_at", { ascending: false }).order("id")
    .range((page - 1) * size, page * size - 1);

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
  type CaptionCard = Generation & { entry: Generation["reactions"][number] | null; key: string };
  const cards = generations.flatMap<CaptionCard>((item) => item.published
    ? item.reactions.map((entry) => ({ ...item, entry, key: `${item.id}-${entry.index}` }))
    : [{ ...item, entry: null, key: `${item.id}-draft` }]);
  const path = mine ? "/my-captions" : "/gallery";

  return (
    <main className="max-w-4xl mx-auto w-full px-6 py-8">
      <nav className="flex flex-wrap gap-5">
        <Link href="/" className="hover:underline">Home</Link>
        <Link href="/captions" className="hover:underline">Generate captions</Link>
        <Link href={mine ? "/gallery" : "/my-captions"} className="hover:underline">{mine ? "Gallery" : "My captions"}</Link>
      </nav>
      <h1 className="text-3xl font-bold mt-6 mb-3">{title}</h1>
      <p className="mb-6">{mine ? "Your photos and captions, including private drafts." : "Vote for your favorite."}</p>
      {error ? <p role="alert">Captions could not be loaded. Please check the latest caption database setup and try again.</p> : (
        <>
          {cards.length === 0 && <p>No captions here yet. <Link href="/captions" className="underline">Generate some!</Link></p>}
          <div className="grid gap-6 md:grid-cols-2">
            {cards.map((item) => (
              <article key={item.key} className="rounded-2xl border p-5">
                {item.photo && (
                  // Signed storage URLs expire; a plain image displays the private photo.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.photo} alt="Photo with AI-generated captions" className="h-64 w-full rounded-xl object-contain" />
                )}
                {item.photoFailed && <p role="alert">The photo could not be loaded. Refresh to try again.</p>}
                {item.entry ? (
                  <section className="pt-4" aria-label={`Caption ${item.entry.index + 1}`}>
                    <p className="text-lg font-medium">{item.captions[item.entry.index]}</p>
                    {item.entry.failed ? <p role="alert" className="mt-4">Reactions could not be loaded. Refresh to try again.</p> : (
                      <VoteButton id={item.id} captionIndex={item.entry.index} initialHearts={item.entry.hearts} initialDownvotes={item.entry.downvotes} initialReaction={item.entry.reaction} />
                    )}
                  </section>
                ) : <DraftPublisher id={item.id} captions={item.captions} />}
              </article>
            ))}
          </div>
          <nav aria-label="Caption pages" className="mt-6 flex gap-5">
            {page > 1 && <Link href={`${path}?page=${page - 1}`} className="underline">Previous</Link>}
            {page * size < (count ?? 0) && <Link href={`${path}?page=${page + 1}`} className="underline">Next</Link>}
          </nav>
        </>
      )}
    </main>
  );
}
