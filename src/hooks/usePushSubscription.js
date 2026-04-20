import { useState, useEffect, useCallback } from 'react'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
const CF_WORKER_URL    = import.meta.env.VITE_CF_WORKER_URL || 'http://localhost:8787'
const PREF_KEY         = 'rv:push_subscribed'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

/**
 * Manages Web Push subscription lifecycle with VAPID.
 * - Registers push subscription on first opt-in
 * - POSTs subscription to CF Worker /subscribe
 * - Persists subscription state in localStorage
 */
export function usePushSubscription() {
  const [isSubscribed,   setIsSubscribed]   = useState(false)
  const [isSupported,    setIsSupported]    = useState(false)
  const [permission,     setPermission]     = useState('default')
  const [isLoading,      setIsLoading]      = useState(false)
  const [error,          setError]          = useState(null)

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
    setIsSupported(supported)

    if (!supported) return

    setPermission(Notification.permission)
    setIsSubscribed(localStorage.getItem(PREF_KEY) === 'true' && Notification.permission === 'granted')
  }, [])

  const subscribe = useCallback(async () => {
    if (!isSupported) return
    setIsLoading(true)
    setError(null)

    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result !== 'granted') {
        setIsLoading(false)
        return
      }

      const registration = await navigator.serviceWorker.ready

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      // Send subscription to CF Worker
      await fetch(`${CF_WORKER_URL}/subscribe`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(subscription),
      })

      localStorage.setItem(PREF_KEY, 'true')
      setIsSubscribed(true)
    } catch (err) {
      console.error('[usePushSubscription] error:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      localStorage.removeItem(PREF_KEY)
      setIsSubscribed(false)
    } catch (err) {
      console.error('[usePushSubscription] unsubscribe error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { isSubscribed, isSupported, permission, isLoading, error, subscribe, unsubscribe }
}
