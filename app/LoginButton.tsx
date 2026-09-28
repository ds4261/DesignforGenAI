'use client'
import { createClient } from '@/lib/supabase-browser'

export default function LoginButton() {
  const supabase = createClient()

  return (
    <button
      onClick={() =>
        supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${location.origin}/auth/callback` },
        })
      }
    >
      Sign in with Google
    </button>
  )
}