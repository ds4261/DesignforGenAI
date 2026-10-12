"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type PreviewCard = { key: string; caption: string; photo: string | null };

export default function HomeGalleryWindow() {
  const [cards, setCards] = useState<PreviewCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        // The public preview only reads published captions and photos, never prompts or drafts.
        const { data, error: loadError } = await supabase.from("nyc_caption_media")
          .select("id, photo_path, captions, selected_indices")
          .eq("published", true).order("created_at", { ascending: false }).order("id").limit(24);
        if (loadError) throw new Error("The gallery preview could not be loaded. Please try again.");
        const entries = await Promise.all((data ?? []).map(async (item) => {
          const { data: photo } = await supabase.storage.from("nyc-caption-photos").createSignedUrl(item.photo_path, 3600);
          return (item.selected_indices as number[]).map((index) => ({
            key: `${item.id}-${index}`, caption: (item.captions as string[])[index], photo: photo?.signedUrl ?? null,
          }));
        }));
        if (active) setCards(entries.flat());
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : "The gallery preview could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  return (
    <section className="home-gallery" aria-labelledby="window-title">
      <div className="window-heading"><span className="eyebrow">A WINDOW INTO THE CITY</span><h2 id="window-title" className="sr-only">Gallery preview</h2></div>
      <div className="nyc-window">
        <Link href="/gallery" className="window-transom" aria-label="Open the caption gallery"><span /><span /><span /></Link>
        <div className="window-feed" tabIndex={0} role="region" aria-label="Scroll through recent gallery captions" aria-busy={loading}>
          {loading && <p className="window-message" role="status">Opening the window…</p>}
          {!loading && error && <div className="window-message" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="button-primary mt-4">Try again</button></div>}
          {!loading && !error && cards.length === 0 && <p className="window-message">The city’s next story could be yours. Create a caption to add it here.</p>}
          {!loading && !error && cards.map((card) => (
            <Link href="/gallery" className="window-polaroid" key={card.key} aria-label={`Open gallery: ${card.caption}`}>
              {card.photo ? (
                // Private storage photos use expiring signed URLs.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.photo} alt="Photo shared with an NYC-inspired caption" loading="lazy" />
              ) : <div className="window-photo-missing">Photo unavailable</div>}
              <p>{card.caption}</p>
            </Link>
          ))}
        </div>
        <Link href="/gallery" className="window-sill" aria-label="Open the caption gallery" />
      </div>
      <p className="window-note">Scroll for city stories. Sign in to vote for your favorites.</p>
    </section>
  );
}
