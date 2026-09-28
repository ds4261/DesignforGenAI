"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [user, setUser] = useState<any>(null);

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

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const firstName =
    (user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "").split(" ")[0];

  return (
    <main className="min-h-screen flex flex-col">
      {/* Top nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b">
        <Link href="/books" className="text-lg font-medium hover:underline">
          Jokes
        </Link>

        {user && (
          <div className="flex items-center gap-4">
            <Link href="/profile" className="text-lg font-medium hover:underline">
              Profile
            </Link>
            <button
              onClick={signOut}
              className="px-4 py-2 rounded-md border font-medium hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        )}
      </nav>

      {/* Center content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-4 text-center">
        <div className="rounded-3xl bg-gradient-to-r from-sky-200 to-green-200 px-12 py-8 shadow-md">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-800">
            {user ? `Hi ${firstName}` : "Hello World"}
          </h1>
        </div>

        {!user && (
          <button
            onClick={signIn}
            className="px-12 py-6 text-2xl font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700"
          >
            Sign in with Google
          </button>
        )}
      </div>
    </main>
  );
}