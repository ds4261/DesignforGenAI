"use client";

import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export default function SignInButton({ children, className = "button-primary" }: { children: ReactNode; className?: string }) {
  return <button type="button" className={className} onClick={() => supabase.auth.signInWithOAuth({
    provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` },
  })}>{children}</button>;
}
