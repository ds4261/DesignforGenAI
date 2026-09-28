import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import LoginButton from './LoginButton'
import SignOutButton from './SignOutButton'
import NameForm from './NameForm'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single()
    profile = data
  }

  const needsName = user && (!profile?.first_name || !profile?.last_name)

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '1rem',
        height: '100vh',
      }}
    >
      {!user && (
        <>
          <h1>Hello World</h1>
          <LoginButton />
        </>
      )}

      {user && needsName && (
        <>
          <h1>Welcome! Tell us your name</h1>
          <NameForm
            userId={user.id}
            firstName={profile?.first_name ?? ''}
            lastName={profile?.last_name ?? ''}
          />
        </>
      )}

      {user && !needsName && (
        <>
          <h1>Hello, {profile?.first_name}!</h1>
          <Link href="/profile">Edit Profile</Link>
          <SignOutButton />
        </>
      )}
    </main>
  )
}