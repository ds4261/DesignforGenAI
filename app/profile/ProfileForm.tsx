'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'

export default function ProfileForm({
  userId,
  firstName,
  lastName,
  avatarUrl,
}: {
  userId: string
  firstName: string
  lastName: string
  avatarUrl: string
}) {
  const [first, setFirst] = useState(firstName)
  const [last, setLast] = useState(lastName)
  const [preview, setPreview] = useState(avatarUrl)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setSaving(true)
    setError('')

    const fileExt = file.name.split('.').pop()
    const filePath = `${userId}/avatar.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      setError(uploadError.message)
      setSaving(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}` // cache-bust

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setPreview(publicUrl)
    }
    setSaving(false)
  }

  async function saveNames() {
    if (!first.trim() || !last.trim()) {
      setError('Please fill in both names.')
      return
    }
    setSaving(true)
    setError('')

    const { error } = await supabase
      .from('profiles')
      .update({ first_name: first.trim(), last_name: last.trim() })
      .eq('id', userId)

    if (error) {
      setError(error.message)
    } else {
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '280px' }}>
      {preview && (
        <img
          src={preview}
          alt="Profile photo"
          style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' }}
        />
      )}

      <label>
        Change photo:
        <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={saving} />
      </label>

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
      <button onClick={saveNames} disabled={saving}>
        {saving ? 'Saving...' : 'Save name'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}