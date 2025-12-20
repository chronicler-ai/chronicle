import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BACKEND_URL } from '../services/api'
import { Brain, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { user, login } = useAuth()

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Pre-flight connection check
    try {
      const healthUrl = BACKEND_URL ? `${BACKEND_URL}/api/auth/health` : '/api/auth/health'
      const healthResponse = await fetch(healthUrl)
      if (!healthResponse.ok) {
        throw new Error('Health check failed')
      }
    } catch (healthError) {
      setError('Unable to connect to server. Please check your connection and try again.')
      setIsLoading(false)
      return
    }

    const result = await login(email, password)
    if (!result.success) {
      // Show specific error message based on error type
      if (result.errorType === 'connection_failure') {
        setError('Unable to connect to server. Please check your connection and try again.')
      } else if (result.errorType === 'authentication_failure') {
        setError('Invalid email or password')
      } else {
        setError(result.error || 'Login failed. Please try again.')
      }
    }
    setIsLoading(false)
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
            Chronicle
          </h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 font-medium">
            AI-Powered Personal Audio System
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
            Sign in to access your dashboard
          </p>
        </div>

        {/* Login Form */}
        <div className="card shadow-xl backdrop-blur-sm bg-white/90 dark:bg-neutral-800/90 p-8 space-y-6 animate-slide-up">
          <form className="space-y-5" onSubmit={handleSubmit}>
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
                className="input"
                placeholder="you@example.com"
              />
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
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Enter your password"
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
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Additional Info */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <p className="text-xs text-center text-neutral-500 dark:text-neutral-400">
              Protected by enterprise-grade security
            </p>
          </div>
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