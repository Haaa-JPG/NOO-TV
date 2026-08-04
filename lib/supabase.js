import { createClient } from '@supabase/supabase-js'

let _supabase = null

function getSupabase() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    _supabase = createClient(url, key)
  }
  return _supabase
}

export const supabase = new Proxy({}, {
  get(_, prop) {
    return getSupabase()[prop]
  }
})

// Auth helpers
export const signUp = async (email, password, displayName) => {
  const client = getSupabase()
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      }
    }
  })

  if (data?.user && !error) {
    await ensureUserProfile(data.user)
  }

  return { data, error }
}

export const signIn = async (email, password) => {
  const client = getSupabase()
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export const signInWithGoogle = async () => {
  const client = getSupabase()
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
  return { data, error }
}

export const signOut = async () => {
  const client = getSupabase()
  const { error } = await client.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  const client = getSupabase()
  const { data: { user }, error } = await client.auth.getUser()
  return { user, error }
}

export const resetPassword = async (email) => {
  const client = getSupabase()
  const { data, error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })
  return { data, error }
}

// Profile helpers
export const getUserProfile = async (userId) => {
  if (!userId) return null
  const client = getSupabase()
  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) return null
  return data
}

export const ensureUserProfile = async (user, extra = {}) => {
  if (!user) return null
  const client = getSupabase()

  const profile = {
    id: user.id,
    email: user.email || '',
    display_name: user.user_metadata?.display_name || null,
    avatar_url: user.user_metadata?.avatar_url || extra.avatar_url || null,
    ...extra,
  }

  const { data, error } = await client
    .from('users')
    .upsert(profile, { onConflict: 'id' })
    .select()
    .single()

  if (error) return null
  return data
}

export const isAdmin = async (userId) => {
  const profile = await getUserProfile(userId)
  return profile?.role === 'admin'
}
