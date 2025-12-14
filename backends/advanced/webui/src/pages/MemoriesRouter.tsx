import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Memories from './Memories'

/**
 * Memories page wrapper that stores JWT for cross-origin Mycelia access.
 * Always displays Friend-Lite native Memories component (backend proxies to provider).
 */
export default function MemoriesRouter() {
  const { token } = useAuth()

  useEffect(() => {
    // Store JWT in localStorage for potential direct Mycelia access
    if (token) {
      localStorage.setItem('mycelia_jwt_token', token)
    }
  }, [token])

  // Always show the native Memories page (works for all providers)
  // Friend-Lite backend will proxy to Mycelia when needed
  return <Memories />
}
