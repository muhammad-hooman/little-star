import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext } from './auth-context'

async function getProfileForUser(userId) {
  if (!supabase) throw new Error('Authentication is not configured.')

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Multiple profiles were returned for this account. Contact the store administrator to repair the profiles table.')
    }
    throw error
  }

  if (!data) {
    throw new Error('No profile exists for this authenticated account. Your access has not been granted. Ask the store administrator to run the missing-profile repair SQL from the project README.')
  }

  return data
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    if (!supabase) return undefined

    let active = true
    let latestProfileRequest = 0

    const loadProfile = async (userId) => {
      const requestId = ++latestProfileRequest
      try {
        const data = await getProfileForUser(userId)
        if (active && requestId === latestProfileRequest) {
          setProfile(data)
          setProfileError('')
        }
      } catch (error) {
        if (active && requestId === latestProfileRequest) {
          setProfile(null)
          setProfileError(error.message || 'Your account profile could not be loaded.')
        }
      } finally {
        if (active && requestId === latestProfileRequest) setLoading(false)
      }
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setProfileError('')
      if (nextSession?.user) {
        setLoading(true)
        window.setTimeout(() => {
          if (active) void loadProfile(nextSession.user.id)
        }, 0)
      } else {
        latestProfileRequest += 1
        setProfile(null)
        setLoading(false)
      }
    })

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) {
        setProfileError(error.message)
        setLoading(false)
        return
      }
      setSession(data.session)
      if (data.session?.user) void loadProfile(data.session.user.id)
      else setLoading(false)
    }).catch((error) => {
      if (!active) return
      setProfileError(error.message || 'Your session could not be restored.')
      setLoading(false)
    })

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Authentication is not configured. Add the Supabase environment variables and restart the app.')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const accountProfile = await getProfileForUser(data.user.id)
    setSession(data.session)
    setProfile(accountProfile)
    setProfileError('')
    return accountProfile
  }, [])

  const signInWithGoogle = useCallback(async (redirectTo = '/account') => {
    if (!supabase) throw new Error('Authentication is not configured. Add the Supabase environment variables and restart the app.')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}` }
    })
    if (error) throw error
  }, [])

  const signUp = useCallback(async ({ email, password, fullName, phone, redirectTo }) => {
    if (!supabase) throw new Error('Authentication is not configured. Add the Supabase environment variables and restart the app.')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo || '/account')}`,
        data: { full_name: fullName, phone }
      }
    })
    if (error) throw error
    return data
  }, [])

  const resendVerificationEmail = useCallback(async (email, redirectTo) => {
    if (!supabase) throw new Error('Authentication is not configured. Add the Supabase environment variables and restart the app.')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo || '/account')}`
      }
    })
    if (error) throw error
  }, [])

  const sendPasswordReset = useCallback(async (email) => {
    if (!supabase) throw new Error('Authentication is not configured. Add the Supabase environment variables and restart the app.')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password) => {
    if (!supabase) throw new Error('Authentication is not configured. Add the Supabase environment variables and restart the app.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) throw new Error('Authentication is not configured.')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo(() => ({
    user: session?.user ?? null,
    session,
    profile,
    loading,
    profileError,
    configured: Boolean(supabase),
    signIn,
    signInWithGoogle,
    signUp,
    resendVerificationEmail,
    sendPasswordReset,
    updatePassword,
    signOut
  }), [session, profile, loading, profileError, signIn, signInWithGoogle, signUp, resendVerificationEmail, sendPasswordReset, updatePassword, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
