"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import HomeGalleryWindow from "../HomeGalleryWindow";
import CitySkyline from "../CitySkyline";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = () =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

  const firstName =
    (user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "").split(" ")[0];

  return (
    <main className="min-h-screen flex flex-col">

      <div className="home-hero home-window-layout">
        <div className="home-intro">
        <div className="hero-art" aria-hidden="true">
          <div className="art-sun" />
          <div className="art-sticker">Every photo<br />has a city story.</div>
          <CitySkyline />
        </div>
        <div className="home-intro-copy">
          <h1 className="home-tagline">Your photos.<br /><span>An AI generated NYC caption.</span></h1>
          {!user && <div className="signin-bubble">
            <p className="signin-heading">Your city story starts here.</p>
            <button onClick={signIn} className="button-primary">Sign in with Google <span aria-hidden="true">→</span></button>
          </div>}
          {user && <p className="welcome-note">Welcome back{firstName ? `, ${firstName}` : ""}. What’s your next story?</p>}
          <div className="hero-actions">
            <Link href="/captions" className="button-primary">Generate captions <span aria-hidden="true">↗</span></Link>
            {user ? <Link href="/gallery" className="button-secondary">Explore the gallery</Link> : <button onClick={signIn} className="button-secondary">Explore the gallery</button>}
          </div>
        </div>
        </div>
        <HomeGalleryWindow />
      </div>
    </main>
  );
}
