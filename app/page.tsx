"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const firstName =
    (user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "").split(" ")[0];

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="site-nav">
        <div className="nav-links">
          <Link href="/captions">Captions</Link>
          <Link href="/gallery">Gallery</Link>
          <Link href="/my-captions">My captions</Link>
        </div>
        {user && <div className="nav-links nav-account">
          <Link href="/profile">Profile</Link>
          <button onClick={signOut} className="nav-signout">Sign out</button>
        </div>}
      </nav>
      <div className="home-hero">
        <div>
          <p className="eyebrow">YOUR PHOTOS. A LITTLE NEW YORK ENERGY.</p>
          <h1 className="hero-title">Every photo<br />has a <span>city story.</span></h1>
          {!user && <div className="signin-bubble">
            <p className="signin-heading">Your city story starts here.</p>
            <button onClick={signIn} className="button-primary">Sign in with Google <span aria-hidden="true">→</span></button>
          </div>}
          {user && <p className="welcome-note">Welcome back{firstName ? `, ${firstName}` : ""}. What’s your next story?</p>}
          <div className="hero-actions">
            <Link href="/captions" className="button-primary">Generate captions <span aria-hidden="true">↗</span></Link>
            <Link href="/gallery" className="button-secondary">Explore the gallery</Link>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-sun" />
          <div className="art-sticker">Made for<br />city moments.</div>
          <svg className="nyc-skyline" viewBox="0 0 480 400" fill="none" preserveAspectRatio="xMidYMax meet">
            <defs>
              <pattern id="city-windows" width="14" height="18" patternUnits="userSpaceOnUse">
                <rect x="5" y="5" width="3" height="6" rx="1" fill="#faf7f2" opacity=".45" />
              </pattern>
            </defs>
            {/* Layered blocks and the tapered One World Trade Center. */}
            <path d="M0 310V226h32v-26h31v110h26V178h35v132h30V240h32v70h40V218h34v92h26V195h41v115h29V228h34v82h30V208h38v102h28V246h32v154H0Z" fill="var(--pond-blue)" opacity=".65" />
            <path d="M28 328V182h41v146M79 328V232h27v96M117 328V174l8-63h24l9 63v154Z" fill="var(--beijing-blue)" />
            <path d="M137 111V62" stroke="var(--beijing-blue)" strokeWidth="3" />
            <path d="M117 174h41M126 112l11 216 12-216" stroke="var(--pond-blue)" strokeWidth="2" />
            {/* Empire State Building: stepped setbacks and a tall antenna. */}
            <path d="M179 328V166h10v-31h9v-23h8V91h18v21h8v23h9v31h10v162Z" fill="var(--keystone)" />
            <path d="M215 91V48" stroke="var(--keystone)" strokeWidth="3" />
            <path d="M207 90V76h16v14" fill="var(--keystone)" />
            {/* Chrysler Building: tiered crown and needle. */}
            <path d="M294 328V192h7v-24h7v-16l15-25 15 25v16h7v24h7v136Z" fill="var(--starlet)" />
            <path d="M323 127V99M308 167h30M302 182h42M312 153h22" stroke="var(--starlet)" strokeWidth="3" />
            <path d="M311 167l12-14 12 14M307 183l16-15 16 15" stroke="#ead8bd" strokeWidth="2" />
            <path d="M365 328V225h31v-15h24v118M431 328V182h33v146M0 328V260h19v68" fill="var(--voodoo)" />
            <path d="M28 328V182h41v146M79 328V232h27v96M179 328V166h72v162M294 328V192h58v136M365 328V225h55v103M431 328V182h33v146" fill="url(#city-windows)" />
            {/* East River and the Brooklyn Bridge's stone Gothic towers. */}
            <path d="M0 334h480v66H0Z" fill="var(--pond-blue)" />
            <path d="M0 366h92m24 16h62m176-13h74M221 392h94" stroke="#faf7f2" strokeWidth="2" opacity=".5" />
            <path d="M-20 281Q83 324 133 207Q240 329 347 207Q403 306 500 273" stroke="var(--voodoo)" strokeWidth="3" />
            {[12, 36, 60, 84, 108, 158, 182, 206, 230, 254, 278, 302, 326, 372, 396, 420, 444, 468].map((x) => {
              const y = x < 133 ? 207 + 85 * (1 - ((x - 55) / 78) ** 2)
                : x > 347 ? 207 + 85 * (1 - ((x - 425) / 78) ** 2)
                : 207 + 61 * (1 - ((x - 240) / 107) ** 2);
              return <path key={x} d={`M${x} ${y}V332`} stroke="var(--voodoo)" strokeWidth="1" opacity=".65" />;
            })}
            <path d="M110 340V207h46v133h-10v-80q-6-20-12-24-7 4-13 24v80ZM324 340V207h46v133h-10v-80q-6-20-12-24-7 4-13 24v80Z" fill="var(--keystone)" fillRule="evenodd" />
            <path d="M106 207h54v-10h-54ZM320 207h54v-10h-54Z" fill="var(--keystone)" />
            <path d="M110 218h46M324 218h46M110 230h14m19 0h13m168 0h14m19 0h13" stroke="#ead8bd" strokeWidth="2" />
            <path d="M-10 334h500" stroke="var(--voodoo)" strokeWidth="10" />
            <path d="M0 324h480" stroke="var(--voodoo)" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </main>
  );
}
