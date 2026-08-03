import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helpers
export const signUp = async (email, password, displayName) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      }
    }
  })

  // If signup succeeded, make sure a public.users row exists.
  // (A trigger normally handles this, but we do it again for safety.)
  if (data?.user && !error) {
    await ensureUserProfile(data.user)
  }

  return { data, error }
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

export const resetPassword = async (email) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })
  return { data, error }
}

// Profile helpers
export const getUserProfile = async (userId) => {
  if (!userId) return null
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) return null
  return data
}

// Upsert the public profile row so role / display_name are always in sync.
export const ensureUserProfile = async (user, extra = {}) => {
  if (!user) return null

  const profile = {
    id: user.id,
    email: user.email || '',
    display_name: user.user_metadata?.display_name || null,
    avatar_url: user.user_metadata?.avatar_url || extra.avatar_url || null,
    ...extra,
  }

  const { data, error } = await supabase
    .from('users')
    .upsert(profile, { onConflict: 'id' })
    .select()
    .single()

  if (error) return null
  return data
}

// Is the current (or given) user an admin?
export const isAdmin = async (userId) => {
  const profile = await getUserProfile(userId)
  return profile?.role === 'admin'
}