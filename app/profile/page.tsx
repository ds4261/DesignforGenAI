import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ProfileForm from './ProfileForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, avatar_url')
    .eq('id', user.id)
    .single()

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        padding: '2rem',
      }}
    >
      <h1>Your Profile</h1>
      <ProfileForm
        userId={user.id}
        firstName={profile?.first_name ?? ''}
        lastName={profile?.last_name ?? ''}
        avatarUrl={profile?.avatar_url ?? ''}
      />
    </main>
  )
}