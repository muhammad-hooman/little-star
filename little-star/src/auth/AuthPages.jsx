import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import '../components/StorePages.css'

const TITLES = {
  login: 'Welcome back',
  'admin-login': 'Admin sign in',
  register: 'Create your account',
  forgot: 'Reset your password',
  reset: 'Choose a new password'
}

function getOAuthCallbackError(message) {
  if (/unable to exchange external code/i.test(message)) {
    return 'Google sign-in could not be completed. Check that the Google client ID and client secret in Supabase belong to the same OAuth client, and that Google allows the exact Supabase callback URI shown in Supabase’s Google provider settings. Restart sign-in to request a fresh authorization code.'
  }
  return message
}

function AuthFrame({ mode, children }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" to="/">LITTLE STAR<span>Dress the Future</span></Link>
        <p className="auth-eyebrow">{mode === 'admin-login' ? 'Store administration' : 'A little something special'}</p>
        <h1>{TITLES[mode]}</h1>
        {children}
      </section>
    </main>
  )
}

function Feedback({ error, notice }) {
  if (error) return <p className="auth-feedback auth-feedback-error" role="alert">{error}</p>
  if (notice) return <p className="auth-feedback auth-feedback-success" role="status">{notice}</p>
  return null
}

export default function AuthPage({ mode }) {
  const { configured, profile, signIn, signInWithGoogle, signUp, resendVerificationEmail, sendPasswordReset, updatePassword, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [emailAddress, setEmailAddress] = useState('')
  const [verificationRequired, setVerificationRequired] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)
  const isRegistration = mode === 'register'
  const isAdminLogin = mode === 'admin-login'
  const requestedDestination = new URLSearchParams(location.search).get('next')
  const nextDestination = location.state?.from
    || (requestedDestination?.startsWith('/') && !requestedDestination.startsWith('//') ? requestedDestination : '')
    || '/account'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    const values = new FormData(event.currentTarget)
    const email = String(values.get('email') || '').trim()
    setEmailAddress(email)
    const password = String(values.get('password') || '')
    try {
      if (isRegistration) {
        const result = await signUp({
          email,
          password,
          fullName: String(values.get('fullName') || '').trim(),
          phone: String(values.get('phone') || '').trim(),
          redirectTo: nextDestination
        })
        if (result.session) {
          navigate(nextDestination, { replace: true })
        } else {
          setVerificationRequired(true)
          setNotice('Check your inbox to verify your email address before signing in.')
        }
      } else if (mode === 'forgot') {
        await sendPasswordReset(email)
        setNotice('If an account exists for that email, a password reset link is on its way.')
      } else if (mode === 'reset') {
        if (password !== String(values.get('confirmPassword') || '')) {
          throw new Error('The passwords do not match.')
        }
        await updatePassword(password)
        navigate(profile?.role === 'admin' ? '/admin' : '/account', { replace: true })
      } else {
        const accountProfile = await signIn(email, password)
        setVerificationRequired(false)
        if (isAdminLogin && accountProfile.role !== 'admin') {
          await signOut()
          throw new Error('This account does not have administrator access.')
        }
        if (!isAdminLogin && accountProfile.role === 'admin') {
          navigate('/admin', { replace: true })
          return
        }
        navigate(isAdminLogin ? '/admin' : nextDestination, { replace: true })
      }
    } catch (submitError) {
      const message = submitError.message || 'That request could not be completed. Please try again.'
      if (/email not confirmed|email address.*confirm/i.test(message)) {
        setVerificationRequired(true)
        setNotice('Verify your email address before signing in. You can request a new verification link below.')
      } else {
        setError(message)
      }
    } finally {
      setBusy(false)
    }
  }

  const handleResendVerification = async () => {
    setError('')
    setNotice('')
    setResendBusy(true)
    try {
      await resendVerificationEmail(emailAddress, nextDestination)
      setNotice('A new verification email has been requested. Check your inbox and spam folder.')
    } catch (resendError) {
      setError(resendError.message || 'The verification email could not be requested.')
    } finally {
      setResendBusy(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await signInWithGoogle(nextDestination)
    } catch (signInError) {
      setError(signInError.message || 'Google sign-in could not be started. Please try again.')
      setBusy(false)
    }
  }

  return (
    <AuthFrame mode={mode}>
      {!configured && (
        <p className="auth-feedback auth-feedback-error" role="alert">
          Supabase is not configured yet. Add the public project URL and anon key to your local environment file.
        </p>
      )}
      <Feedback error={error} notice={notice} />
      <form className="auth-form" onSubmit={handleSubmit}>
        {isRegistration && (
          <>
            <label>Full name<input name="fullName" type="text" autoComplete="name" required /></label>
            <label>Phone number <span className="auth-optional">Optional</span><input name="phone" type="tel" autoComplete="tel" /></label>
          </>
        )}
        {(mode === 'login' || isRegistration || mode === 'forgot') && (
          <label>Email address<input name="email" type="email" autoComplete="email" required defaultValue={emailAddress} onChange={(event) => setEmailAddress(event.target.value.trim())} /></label>
        )}
        {(mode === 'login' || isRegistration || mode === 'admin-login' || mode === 'reset') && (
          <label>{mode === 'reset' ? 'New password' : 'Password'}
            <input
              name="password"
              type="password"
              autoComplete={mode === 'reset' || isRegistration ? 'new-password' : 'current-password'}
              minLength="8"
              required
            />
          </label>
        )}
        {mode === 'reset' && (
          <label>Confirm new password
            <input name="confirmPassword" type="password" autoComplete="new-password" minLength="8" required
              onChange={(event) => {
                const password = event.currentTarget.form.elements.password.value
                event.currentTarget.setCustomValidity(event.currentTarget.value === password ? '' : 'Passwords do not match.')
              }}
            />
          </label>
        )}
        <button className="auth-submit" type="submit" disabled={!configured || busy}>
          {busy ? 'Please wait…' : isRegistration ? 'Create account' : mode === 'forgot' ? 'Send reset link' : mode === 'reset' ? 'Update password' : 'Sign in'}
        </button>
      </form>
      {verificationRequired && (
        <button
          className="auth-google-button"
          type="button"
          onClick={handleResendVerification}
          disabled={!configured || resendBusy || !emailAddress}
        >
          {resendBusy ? 'Requesting email…' : 'Resend verification email'}
        </button>
      )}
      {(mode === 'login' || isRegistration) && (
        <>
          <div className="auth-divider"><span>OR</span></div>
          <button
            className="auth-google-button"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={!configured || busy}
          >
            <svg aria-hidden="true" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z" />
              <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.5H5.8v5.2A20 20 0 0 0 24 44Z" />
              <path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4v-5.2H5.8a20 20 0 0 0 0 17.8l6.8-5.2Z" />
              <path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 15.1l6.8 5.2c1.6-4.9 6.1-8.5 11.4-8.5Z" />
            </svg>
            {busy ? 'Connecting to Google…' : 'Continue with Google'}
          </button>
        </>
      )}
      <nav className="auth-links" aria-label="Account actions">
        {mode === 'login' && <>
          <Link to="/forgot-password">Forgot password?</Link>
          <span>New to LITTLE STAR? <Link to={`/register${location.search}`}>Create an account</Link></span>
        </>}
        {isRegistration && <span>Already have an account? <Link to={`/login${location.search}`}>Sign in</Link></span>}
        {isAdminLogin && <Link to="/login">Customer sign in</Link>}
        {(mode === 'forgot' || mode === 'reset') && <Link to="/login">Back to sign in</Link>}
      </nav>
    </AuthFrame>
  )
}

export function AuthCallback() {
  const { user, profile, loading, profileError } = useAuth()
  const navigate = useNavigate()
  const requestedDestination = new URLSearchParams(window.location.search).get('next')
  const nextDestination = requestedDestination?.startsWith('/') && !requestedDestination.startsWith('//')
    ? requestedDestination
    : ''
  const [callbackError] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const error = params.get('error') || hashParams.get('error')
    const description = params.get('error_description') || hashParams.get('error_description')
    return error
      ? getOAuthCallbackError(description || error.replaceAll('_', ' '))
      : ''
  })

  useEffect(() => {
    if (!callbackError && !loading && user && profile) {
      navigate(profile.role === 'admin' ? '/admin' : nextDestination || '/account', { replace: true })
    }
  }, [callbackError, loading, user, profile, navigate, nextDestination])

  if (loading && !callbackError) return <main className="auth-loading" role="status">Completing secure sign-in…</main>

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" to="/">LITTLE STAR<span>Dress the Future</span></Link>
        <h1>{callbackError ? 'Google sign-in was not completed' : profileError ? 'Account setup needs attention' : user ? 'Finishing sign-in' : 'Sign-in could not be completed'}</h1>
        {(callbackError || profileError) && (
          <p className="auth-feedback auth-feedback-error" role="alert">
            {callbackError || getOAuthCallbackError(profileError)}
          </p>
        )}
        {!callbackError && !profileError && (
          <p className="auth-copy">Your secure sign-in is being completed. If it does not continue, return to the sign-in page and try again.</p>
        )}
        <Link className="auth-submit auth-button-link" to="/login">Continue to sign in</Link>
      </section>
    </main>
  )
}

export function CustomerAccount() {
  const { profile, user, signOut, resendVerificationEmail } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(Boolean(supabase))
  const [ordersError, setOrdersError] = useState(supabase ? '' : 'Supabase is not configured.')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [resendNotice, setResendNotice] = useState('')
  const [resending, setResending] = useState(false)
  const selectedOrderId = location.pathname.match(/^\/account\/orders\/([^/]+)/)?.[1]
  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
  const emailVerified = Boolean(user?.email_confirmed_at || user?.confirmed_at)

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    supabase
      .from('orders')
      .select('*, order_items(*), order_events(id,event_type,from_status,to_status,note,created_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (queryError) throw queryError
        if (active) setOrders(data || [])
      })
      .catch((queryError) => {
        if (active) setOrdersError(queryError.message || 'Your order history could not be loaded.')
      })
      .finally(() => {
        if (active) setOrdersLoading(false)
      })
    return () => { active = false }
  }, [user.id, refreshVersion])

  const handleSignOut = async () => {
    setError('')
    setBusy(true)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (signOutError) {
      setError(signOutError.message || 'You could not be signed out.')
    } finally {
      setBusy(false)
    }
  }

  const handleCancelOrder = async (order) => {
    setBusy(true)
    setError('')
    try {
      const { error: cancelError } = await supabase.rpc('customer_cancel_order', { p_order_id: order.id })
      if (cancelError) throw cancelError
      setOrdersError('')
      setOrdersLoading(true)
      setRefreshVersion((version) => version + 1)
    } catch (cancelError) {
      setError(cancelError.message || 'This order could not be cancelled.')
    } finally {
      setBusy(false)
    }
  }

  const handleResendVerification = async () => {
    setError('')
    setResendNotice('')
    setResending(true)
    try {
      await resendVerificationEmail(user.email, '/account')
      setResendNotice('A verification email has been requested. Check your inbox and spam folder.')
    } catch (resendError) {
      setError(resendError.message || 'The verification email could not be requested.')
    } finally {
      setResending(false)
    }
  }

  const formatDate = (value) => new Date(value).toLocaleString()
  const getOrderStatus = (status) => status === 'pending' ? 'Awaiting confirmation' : status.replaceAll('_', ' ')
  const getPaymentStatus = (status) => ['pending', 'unpaid'].includes(status) ? 'Unpaid' : status.replaceAll('_', ' ')
  const renderOrder = (order, detail = false) => (
    <article className="store-customer-order" key={order.id}>
      <header>
        <div><strong>Order #{order.order_number}</strong><p>{formatDate(order.created_at)}</p></div>
        <span className="store-customer-order-status">{getOrderStatus(order.status)}<br />{order.payment_method?.toUpperCase()} · {getPaymentStatus(order.payment_status)}</span>
      </header>
      <div className="store-customer-order-items">
        {(order.order_items || []).map((item) => (
          <p key={item.id}>
            <span>{item.product_name} · {item.selected_size || 'Size not specified'} {item.selected_color && `· ${item.selected_color}`} × {item.quantity}</span>
            <strong>PKR {Number(item.line_total).toLocaleString()}</strong>
          </p>
        ))}
      </div>
      {detail && (
        <>
          <p className="store-customer-order-address">
            Delivery to: {order.shipping_address?.full_name}<br />
            {order.shipping_address?.phone}{order.shipping_address?.alternate_phone && ` · ${order.shipping_address.alternate_phone}`}<br />
            {order.shipping_address?.house_landmark && `${order.shipping_address.house_landmark}, `}
            {order.shipping_address?.address_line1}<br />
            {order.shipping_address?.area}, {order.shipping_address?.city}, {order.shipping_address?.province}
            {order.shipping_address?.delivery_instructions && <><br />Instructions: {order.shipping_address.delivery_instructions}</>}
          </p>
          <div className="store-customer-order-items">
            <p><span>Subtotal</span><strong>PKR {Number(order.subtotal).toLocaleString()}</strong></p>
            <p><span>Delivery</span><strong>PKR {Number(order.shipping_total).toLocaleString()}</strong></p>
            {Number(order.discount_total) > 0 && <p><span>Discount</span><strong>− PKR {Number(order.discount_total).toLocaleString()}</strong></p>}
            <p><span>Total</span><strong>PKR {Number(order.total).toLocaleString()}</strong></p>
          </div>
          <section className="store-customer-order-history">
            <h3>Order history</h3>
            {(order.order_events || []).map((event) => (
              <p key={event.id}><strong>{event.to_status ? getOrderStatus(event.to_status) : event.event_type.replaceAll('_', ' ')}</strong> · {formatDate(event.created_at)}{event.note && <><br />{event.note}</>}</p>
            ))}
          </section>
        </>
      )}
      <div className="store-customer-order-actions">
        {!detail && <Link to={`/account/orders/${order.id}`}>View order details</Link>}
        {order.status === 'pending' && <button type="button" disabled={busy} onClick={() => handleCancelOrder(order)}>Cancel order</button>}
      </div>
    </article>
  )

  return (
    <main className="customer-account">
      <header className="customer-account-header">
        <Link className="auth-brand" to="/">LITTLE STAR<span>Dress the Future</span></Link>
        <Link to="/">Continue shopping</Link>
      </header>
      <section className="customer-account-content">
        <p className="auth-eyebrow">Your LITTLE STAR account</p>
        <h1>Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}</h1>
        <p>Signed in as {profile?.email || user?.email}</p>
        {error && <Feedback error={error} />}
        {!emailVerified && (
          <div className="store-account-notice">
            <p>Your email address must be verified before checkout.</p>
            <button className="auth-submit" type="button" onClick={handleResendVerification} disabled={resending}>
              {resending ? 'Requesting email…' : 'Resend verification email'}
            </button>
            {resendNotice && <p role="status">{resendNotice}</p>}
          </div>
        )}
        {resendNotice && emailVerified && <p className="store-account-notice" role="status">{resendNotice}</p>}
        <div className="customer-account-actions">
          <Link to="/#/wishlist">Your wishlist</Link>
          <Link to="/#/cart">Your shopping bag</Link>
          <Link to="/account">Order history</Link>
          <button type="button" disabled={busy} onClick={handleSignOut}>{busy ? 'Signing out…' : 'Sign out'}</button>
        </div>
        {location.state?.orderReceived && selectedOrder && <p className="store-account-notice" role="status">Order #{selectedOrder.order_number} received. It is awaiting store confirmation; payment is still unpaid until collected.</p>}
        <section className="store-customer-orders" aria-live="polite">
          <h2>{selectedOrderId ? 'Order details' : 'Your orders'}</h2>
          {ordersLoading && <p role="status">Loading your orders…</p>}
          {ordersError && <Feedback error={ordersError} />}
          {!ordersLoading && !ordersError && selectedOrderId && !selectedOrder && <p>That order could not be found in your account.</p>}
          {!ordersLoading && !ordersError && selectedOrder && renderOrder(selectedOrder, true)}
          {!ordersLoading && !ordersError && !selectedOrderId && orders.length === 0 && <p>You have not placed any orders yet.</p>}
          {!ordersLoading && !ordersError && !selectedOrderId && orders.map((order) => renderOrder(order))}
          {selectedOrderId && <Link to="/account">← Back to order history</Link>}
        </section>
      </section>
    </main>
  )
}
