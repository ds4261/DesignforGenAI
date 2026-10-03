import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import VoteButton from "./VoteButton";

export default async function GalleryPage({ searchParams }: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-4">Caption gallery</h1>
      <Link href="/" className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-white">Sign in to view and vote</Link>
    </main>
  );
  const requestedPage = Number((await searchParams).page ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const size = 12;
  const { data: media, error, count } = await supabase.from("nyc_caption_media")
    .select("id, photo_path, captions, selected_index", { count: "exact" })
    .eq("published", true).order("created_at", { ascending: false }).order("id")
    .range((page - 1) * size, page * size - 1);

  const cards = await Promise.all((media ?? []).map(async (item) => {
    const [{ data: photo, error: photoError }, { count: votes, error: voteError }, { data: ownVote, error: ownError }] = await Promise.all([
      supabase.storage.from("nyc-caption-photos").createSignedUrl(item.photo_path, 3600),
      supabase.from("nyc_caption_votes").select("media_id", { count: "exact", head: true }).eq("media_id", item.id),
      supabase.from("nyc_caption_votes").select("media_id").eq("media_id", item.id).eq("user_id", user.id).maybeSingle(),
    ]);
    return { ...item, photo: photo?.signedUrl, votes: votes ?? 0, voted: !!ownVote, failed: !!(photoError || voteError || ownError) };
  }));

  return (
    <main className="max-w-4xl mx-auto w-full px-6 py-8">
      <nav className="flex gap-5"><Link href="/" className="hover:underline">Home</Link><Link href="/captions" className="hover:underline">Create captions</Link></nav>
      <h1 className="text-3xl font-bold mt-6 mb-3">Caption gallery</h1>
      <p className="mb-6">Vote for your favorite.</p>
      {error ? <p role="alert">The gallery could not be loaded. Please check the caption database setup and try again.</p> : (
        <>
          {cards.length === 0 && <p>No captions here yet. <Link href="/captions" className="underline">Create and share one!</Link></p>}
          <div className="grid gap-6 md:grid-cols-2">
            {cards.map((item) => (
              <article key={item.id} className="rounded-2xl border p-5">
                {item.photo && (
                  // Signed storage URLs expire; a plain image displays the private photo.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.photo} alt="Photo shared with an AI-generated caption" className="h-64 w-full rounded-xl object-contain" />
                )}
                <p className="mt-4 text-lg font-medium">{item.captions[item.selected_index]}</p>
                {item.failed ? <p role="alert" className="mt-4">Some details could not be loaded. Refresh to try again.</p> : (
                  <VoteButton id={item.id} initialVotes={item.votes} initialVoted={item.voted} />
                )}
              </article>
            ))}
          </div>
          <nav aria-label="Gallery pages" className="mt-6 flex gap-5">
            {page > 1 && <Link href={`/gallery?page=${page - 1}`} className="underline">Previous</Link>}
            {page * size < (count ?? 0) && <Link href={`/gallery?page=${page + 1}`} className="underline">Next</Link>}
          </nav>
        </>
      )}
    </main>
  );
}
