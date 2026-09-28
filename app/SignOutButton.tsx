'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut()
        router.refresh()
      }}
    >
      Sign out
    </button>
  )
}