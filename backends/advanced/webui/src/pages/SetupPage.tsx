import React, { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { setupApi } from '../services/api'
import { Brain, Eye, EyeOff } from 'lucide-react'

export default function SetupPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const { user, login, checkSetupStatus } = useAuth()
  const navigate = useNavigate()

  // Check setup status on mount
  useEffect(() => {
    const checkInitialSetupStatus = async () => {
      try {
        const response = await setupApi.getSetupStatus()
        if (!response.data.requires_setup) {
          // Setup already completed, redirect to login
          navigate('/login', { replace: true })
        }
      } catch (err) {
        setError('Unable to check setup status. Please refresh the page.')
      } finally {
        setIsCheckingStatus(false)
      }
    }

    checkInitialSetupStatus()
  }, [navigate])

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/" replace />
  }

  // Show loading while checking setup status
  if (isCheckingStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
          <span className="text-neutral-700 dark:text-neutral-300">Checking setup status...</span>
        </div>
      </div>
    )
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!displayName.trim()) {
      errors.displayName = 'Name is required'
    }

    if (!email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Invalid email format'
    }

    if (!password) {
      errors.password = 'Password is required'
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password'
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setFieldErrors({})

    // Client-side validation
    if (!validateForm()) {
      setIsLoading(false)
      return
    }

    try {
      // Create admin user
      await setupApi.createAdmin({
        display_name: displayName,
        email,
        password,
        confirm_password: confirmPassword,
      })

      // Auto-login with the credentials
      const loginResult = await login(email, password)
      if (loginResult.success) {
        // Refresh setup status (setup is now complete)
        await checkSetupStatus()

        // Stop loading before navigation
        setIsLoading(false)

        // Navigate to dashboard
        navigate('/', { replace: true })
      } else {
        setIsLoading(false)
        setError('Admin created successfully, but auto-login failed. Please login manually.')
        setTimeout(() => navigate('/login', { replace: true }), 2000)
      }
    } catch (err: any) {
      setIsLoading(false)

      // Handle different error responses
      if (err.response?.status === 409) {
        setError('Setup has already been completed by another user. Redirecting to login...')
        setTimeout(() => navigate('/login', { replace: true }), 2000)
      } else if (err.response?.status === 400) {
        const detail = err.response?.data?.detail
        if (typeof detail === 'string') {
          setError(detail)
        } else {
          setError('Validation error. Please check your inputs.')
        }
      } else if (err.message?.includes('Network') || err.code === 'ERR_NETWORK') {
        setError('Unable to connect to server. Please check your connection and try again.')
      } else {
        setError('Setup failed. Please try again.')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-400/20 dark:bg-primary-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-300/20 dark:bg-primary-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Logo & Header */}
        <div className="text-center animate-fade-in">
          <div className="mx-auto h-20 w-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg mb-6 transform transition-transform hover:scale-105">
            <Brain className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-4xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Welcome to Chronicle
          </h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 font-medium">
            First-Time Setup
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
            Create your administrator account to get started
          </p>
        </div>

        {/* Setup Form */}
        <div className="card shadow-xl backdrop-blur-sm bg-white/90 dark:bg-neutral-800/90 p-8 space-y-6 animate-slide-up">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Display Name Input */}
            <div className="space-y-2">
              <label htmlFor="displayName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Your Name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={`input ${fieldErrors.displayName ? 'border-error-500 dark:border-error-500' : ''}`}
                placeholder="Administrator"
              />
              {fieldErrors.displayName && (
                <p className="text-xs text-error-600 dark:text-error-400">{fieldErrors.displayName}</p>
              )}
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`input ${fieldErrors.email ? 'border-error-500 dark:border-error-500' : ''}`}
                placeholder="admin@example.com"
              />
              {fieldErrors.email && (
                <p className="text-xs text-error-600 dark:text-error-400">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`input pr-10 ${fieldErrors.password ? 'border-error-500 dark:border-error-500' : ''}`}
                  placeholder="Minimum 8 characters"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-error-600 dark:text-error-400">{fieldErrors.password}</p>
              )}
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`input pr-10 ${fieldErrors.confirmPassword ? 'border-error-500 dark:border-error-500' : ''}`}
                  placeholder="Re-enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-xs text-error-600 dark:text-error-400">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-3 animate-slide-down">
                <p className="text-sm text-error-700 dark:text-error-300 text-center">
                  {error}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 text-base font-semibold shadow-md hover:shadow-lg transform transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Creating account...</span>
                </div>
              ) : (
                'Complete Setup'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-500">
            Chronicle Dashboard v1.0
          </p>
        </div>
      </div>
    </div>
  )
}
