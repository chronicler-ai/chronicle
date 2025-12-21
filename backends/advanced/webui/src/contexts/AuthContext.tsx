import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi, setupApi } from '../services/api'
import { getStorageKey } from '../utils/storage'

interface User {
  id: string
  name: string
  email: string
  is_superuser: boolean
  api_key?: string
  api_key_created_at?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<{success: boolean, error?: string, errorType?: string}>
  logout: () => void
  isLoading: boolean
  isAdmin: boolean
  setupRequired: boolean | null  // null = checking, true/false = determined
  checkSetupStatus: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem(getStorageKey('token')))
  const [isLoading, setIsLoading] = useState(true)
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null)

  // Check if user is admin
  const isAdmin = user?.is_superuser || false

  // Function to check setup status
  const checkSetupStatus = async (): Promise<boolean> => {
    try {
      const response = await setupApi.getSetupStatus()
      const required = response.data.requires_setup
      setSetupRequired(required)
      return required
    } catch (error) {
      console.error('❌ AuthContext: Failed to check setup status:', error)
      setSetupRequired(false)  // Assume setup not required on error to avoid blocking login
      return false
    }
  }

  useEffect(() => {
    const initAuth = async () => {
      console.log('🔐 AuthContext: Initializing authentication...')

      // First, check setup status
      console.log('🔐 AuthContext: Checking setup status...')
      await checkSetupStatus()

      const savedToken = localStorage.getItem(getStorageKey('token'))
      console.log('🔐 AuthContext: Saved token exists:', !!savedToken)

      if (savedToken) {
        try {
          console.log('🔐 AuthContext: Verifying token with API call...')
          // Verify token is still valid by making a request
          const response = await authApi.getMe()
          console.log('🔐 AuthContext: API call successful, user data:', response.data)
          setUser(response.data)
          setToken(savedToken)
        } catch (error) {
          console.error('❌ AuthContext: Token verification failed:', error)
          // Token is invalid, clear it
          localStorage.removeItem(getStorageKey('token'))
          setToken(null)
          setUser(null)
        }
      } else {
        console.log('🔐 AuthContext: No saved token found')
      }
      console.log('🔐 AuthContext: Initialization complete, setting isLoading to false')
      setIsLoading(false)
    }

    initAuth()
  }, [])

  const login = async (email: string, password: string): Promise<{success: boolean, error?: string, errorType?: string}> => {
    try {
      const response = await authApi.login(email, password)

      const { access_token } = response.data
      setToken(access_token)
      localStorage.setItem(getStorageKey('token'), access_token)
      // Store JWT for Mycelia auto-login (enables seamless access to Mycelia frontend)
      localStorage.setItem(getStorageKey('mycelia_jwt_token'), access_token)

      // Get user info
      const userResponse = await authApi.getMe()
      setUser(userResponse.data)

      return { success: true }
    } catch (error: any) {
      console.error('Login failed:', error)
      
      // Parse structured error response from backend
      let errorMessage = 'Login failed. Please try again.'
      let errorType = 'unknown'
      
      if (error.response?.data) {
        const errorData = error.response.data
        errorMessage = errorData.detail || errorMessage
        errorType = errorData.error_type || errorType
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Unable to connect to server. Please check your connection and try again.'
        errorType = 'connection_failure'
      }
      
      return { 
        success: false, 
        error: errorMessage,
        errorType: errorType
      }
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem(getStorageKey('token'))
    localStorage.removeItem(getStorageKey('mycelia_jwt_token'))
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, isAdmin, setupRequired, checkSetupStatus }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}