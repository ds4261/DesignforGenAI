'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function NameForm({
  userId,
  firstName,
  lastName,
}: {
  userId: string
  firstName: string
  lastName: string
}) {
  const [first, setFirst] = useState(firstName)
  const [last, setLast] = useState(lastName)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function save() {
    if (!first.trim() || !last.trim()) {
      setError('Please fill in both names.')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ first_name: first.trim(), last_name: last.trim() })
      .eq('id', userId)

    if (error) {
      setError(error.message)
      setSaving(false)
    } else {
      router.refresh()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <input
        placeholder="First name"
        value={first}
        onChange={(e) => setFirst(e.target.value)}
      />
      <input
        placeholder="Last name"
        value={last}
        onChange={(e) => setLast(e.target.value)}
      />
      <button onClick={save} disabled={saving}>
        {saving ? 'Saving...' : 'Save'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}