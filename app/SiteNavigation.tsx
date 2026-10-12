"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function SiteNavigation() {
  const [user, setUser] = useState<User | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => { if (active) setUser(data.user); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return (
    <nav className="site-nav" aria-label="Main navigation">
      <div className="nav-links">
        <Link href="/" aria-current={pathname === "/" || pathname === "/gallery" ? "page" : undefined}>Gallery</Link>
        <Link href="/captions" aria-current={pathname === "/captions" ? "page" : undefined}>Generate</Link>
        <Link href="/my-captions" aria-current={pathname === "/my-captions" ? "page" : undefined}>My captions</Link>
      </div>
      <div className="nav-links nav-account">
        {user ? <>
          <Link href="/profile" aria-current={pathname === "/profile" ? "page" : undefined}>Profile</Link>
          <button type="button" className="nav-signout" onClick={async () => {
            await supabase.auth.signOut(); setUser(null); router.refresh();
          }}>Sign out</button>
        </> : <Link href="/sign-in" className="nav-signout">Sign in</Link>}
      </div>
    </nav>
  );
}
