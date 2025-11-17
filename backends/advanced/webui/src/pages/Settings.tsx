import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Key, Copy, Trash2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { settingsApi } from '../services/api'

export default function Settings() {
  const { user } = useAuth()
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [apiKeyCreatedAt, setApiKeyCreatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadApiKeyInfo()
  }, [user])

  const loadApiKeyInfo = () => {
    if (user?.api_key) {
      setApiKey(user.api_key)
      setApiKeyCreatedAt(user.api_key_created_at || null)
    }
  }

  const generateApiKey = async () => {
    try {
      setLoading(true)
      setMessage(null)

      const response = await settingsApi.generateApiKey()

      setApiKey(response.data.api_key)
      setApiKeyCreatedAt(response.data.created_at)
      setMessage({ type: 'success', text: 'API key generated successfully!' })

      // Auto-hide success message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Failed to generate API key:', error)
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to generate API key' })
    } finally {
      setLoading(false)
    }
  }

  const revokeApiKey = async () => {
    if (!confirm('Are you sure you want to revoke your API key? This will break any existing integrations using this key.')) {
      return
    }

    try {
      setLoading(true)
      setMessage(null)

      await settingsApi.revokeApiKey()

      setApiKey(null)
      setApiKeyCreatedAt(null)
      setMessage({ type: 'success', text: 'API key revoked successfully' })

      // Auto-hide success message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Failed to revoke API key:', error)
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to revoke API key' })
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    if (!apiKey) return

    try {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center space-x-2 mb-6">
        <SettingsIcon className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Settings
        </h1>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
            )}
            <p className={`text-sm ${
              message.type === 'success'
                ? 'text-green-700 dark:text-green-300'
                : 'text-red-700 dark:text-red-300'
            }`}>
              {message.text}
            </p>
          </div>
        </div>
      )}

      {/* API Keys Section */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              API Keys
            </h2>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          API keys allow you to access Friend-Lite conversations via the MCP (Model Context Protocol) server.
          Use this key to connect LLM clients like Claude Desktop, Cursor, or Windsurf.
        </p>

        {/* Current API Key Display */}
        {apiKey ? (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Current API Key
                </span>
                {apiKeyCreatedAt && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Created: {formatDate(apiKeyCreatedAt)}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded font-mono text-sm text-gray-900 dark:text-gray-100 break-all">
                  {apiKey}
                </code>
                <button
                  onClick={copyToClipboard}
                  className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </button>
              </div>

              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>MCP Server URL:</strong> http://your-server:8000/mcp/conversations/sse
                  <br />
                  <strong>Authorization Header:</strong> Bearer {apiKey}
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={generateApiKey}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Regenerate Key</span>
              </button>

              <button
                onClick={revokeApiKey}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
                <span>Revoke Key</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No API key generated yet
            </p>
            <button
              onClick={generateApiKey}
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
            >
              <Key className="h-5 w-5" />
              <span>{loading ? 'Generating...' : 'Generate API Key'}</span>
            </button>
          </div>
        )}

        {/* Usage Instructions */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            How to use your API key
          </h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>1. Use the MCP inspector to test your connection: <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">http://localhost:6274</code></p>
            <p>2. Configure your MCP client with the server URL and your API key in the Authorization header</p>
            <p>3. Your API key provides access to all your conversations via the MCP protocol</p>
            <p>4. Keep your API key secure - it provides full access to your conversation data</p>
          </div>
        </div>
      </div>
    </div>
  )
}
