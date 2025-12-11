import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  Key,
  Copy,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Save,
  Server,
  MessageSquare,
  Mic,
  Database,
  Settings2,
  Shield,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { settingsApi } from '../services/api'

type Tab = 'core-infra' | 'api-keys' | 'mcp-key' | 'memory' | 'speech' | 'conversations' | 'other'

interface Message {
  type: 'success' | 'error'
  text: string
}

export default function Settings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('core-infra')

  // MCP Key state
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [apiKeyCreatedAt, setApiKeyCreatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Infrastructure status state
  const [infraStatus, setInfraStatus] = useState<any>(null)
  const [infraLoading, setInfraLoading] = useState(false)

  // API Keys status state
  const [apiKeysStatus, setApiKeysStatus] = useState<any>(null)
  const [apiKeysLoading, setApiKeysLoading] = useState(false)

  // Application settings state
  const [appSettings, setAppSettings] = useState<any>(null)
  const [appSettingsLoading, setAppSettingsLoading] = useState(false)

  const [message, setMessage] = useState<Message | null>(null)

  useEffect(() => {
    loadApiKeyInfo()
  }, [user])

  useEffect(() => {
    if (activeTab === 'core-infra' && !infraStatus) {
      loadInfrastructureStatus()
    } else if (activeTab === 'api-keys' && !apiKeysStatus) {
      loadApiKeysStatus()
    } else if (['memory', 'speech', 'conversations', 'other'].includes(activeTab) && !appSettings) {
      loadApplicationSettings()
    }
  }, [activeTab])

  const loadApiKeyInfo = () => {
    if (user?.api_key) {
      setApiKey(user.api_key)
      setApiKeyCreatedAt(user.api_key_created_at || null)
    }
  }

  const loadInfrastructureStatus = async () => {
    try {
      setInfraLoading(true)
      const response = await settingsApi.getInfrastructureStatus()
      setInfraStatus(response.data)
    } catch (error: any) {
      console.error('Failed to load infrastructure status:', error)
      showMessage('error', 'Failed to load infrastructure status')
    } finally {
      setInfraLoading(false)
    }
  }

  const loadApiKeysStatus = async () => {
    try {
      setApiKeysLoading(true)
      const response = await settingsApi.getApiKeysStatus()
      setApiKeysStatus(response.data)
    } catch (error: any) {
      console.error('Failed to load API keys status:', error)
      showMessage('error', 'Failed to load API keys status')
    } finally {
      setApiKeysLoading(false)
    }
  }

  const loadApplicationSettings = async () => {
    try {
      setAppSettingsLoading(true)
      const response = await settingsApi.getAllSettings()
      setAppSettings(response.data)
    } catch (error: any) {
      console.error('Failed to load application settings:', error)
      showMessage('error', 'Failed to load application settings')
    } finally {
      setAppSettingsLoading(false)
    }
  }

  const generateApiKey = async () => {
    try {
      setLoading(true)
      setMessage(null)

      const response = await settingsApi.generateApiKey()

      setApiKey(response.data.api_key)
      setApiKeyCreatedAt(response.data.created_at)
      showMessage('success', 'MCP API key generated successfully!')
    } catch (error: any) {
      console.error('Failed to generate MCP API key:', error)
      showMessage('error', error.response?.data?.detail || 'Failed to generate MCP API key')
    } finally {
      setLoading(false)
    }
  }

  const revokeApiKey = async () => {
    if (
      !confirm(
        'Are you sure you want to revoke your MCP API key? This will break any existing MCP client integrations.'
      )
    ) {
      return
    }

    try {
      setLoading(true)
      setMessage(null)

      await settingsApi.revokeApiKey()

      setApiKey(null)
      setApiKeyCreatedAt(null)
      showMessage('success', 'MCP API key revoked successfully')
    } catch (error: any) {
      console.error('Failed to revoke MCP API key:', error)
      showMessage('error', error.response?.data?.detail || 'Failed to revoke MCP API key')
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

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const updateCategorySettings = async (category: string, categorySettings: any) => {
    try {
      setAppSettingsLoading(true)
      setMessage(null)

      const updateMethods: Record<string, (settings: any) => Promise<any>> = {
        speech_detection: settingsApi.updateSpeechDetection,
        conversation: settingsApi.updateConversation,
        audio_processing: settingsApi.updateAudioProcessing,
        diarization: settingsApi.updateDiarization,
        llm: settingsApi.updateLLM,
        providers: settingsApi.updateProviders,
        network: settingsApi.updateNetwork,
        misc: settingsApi.updateMisc,
      }

      const updateMethod = updateMethods[category]
      if (!updateMethod) {
        throw new Error(`Unknown category: ${category}`)
      }

      await updateMethod(categorySettings)
      await loadApplicationSettings()

      showMessage('success', `Settings updated successfully!`)
    } catch (error: any) {
      console.error(`Failed to update ${category} settings:`, error)
      showMessage(
        'error',
        error.response?.data?.detail || `Failed to update ${category} settings`
      )
    } finally {
      setAppSettingsLoading(false)
    }
  }

  const renderSettingsField = (
    category: string,
    key: string,
    value: any,
    label: string,
    description?: string,
    type: 'number' | 'boolean' | 'text' | 'select' = 'text',
    options?: { value: string; label: string }[]
  ) => {
    const fieldId = `${category}_${key}`

    const handleChange = (newValue: any) => {
      setAppSettings((prev: any) => ({
        ...prev,
        [category]: {
          ...prev[category],
          [key]: newValue,
        },
      }))
    }

    if (type === 'boolean') {
      return (
        <div key={fieldId} className="flex items-start space-x-3 py-3">
          <input
            type="checkbox"
            id={fieldId}
            checked={value}
            onChange={(e) => handleChange(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          <div className="flex-1">
            <label
              htmlFor={fieldId}
              className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              {label}
            </label>
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
            )}
          </div>
        </div>
      )
    }

    if (type === 'select') {
      return (
        <div key={fieldId} className="py-3">
          <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label}
          </label>
          {description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{description}</p>}
          <select
            id={fieldId}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )
    }

    return (
      <div key={fieldId} className="py-3">
        <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
        {description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{description}</p>}
        <input
          type={type}
          id={fieldId}
          value={value}
          onChange={(e) => handleChange(type === 'number' ? parseFloat(e.target.value) : e.target.value)}
          step={type === 'number' ? 'any' : undefined}
          className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>
    )
  }

  const tabs = [
    { id: 'core-infra' as Tab, label: 'Core Infra', icon: Server, adminOnly: false },
    { id: 'api-keys' as Tab, label: 'API Keys', icon: Shield, adminOnly: true },
    { id: 'mcp-key' as Tab, label: 'MCP Key', icon: Key, adminOnly: false },
    { id: 'memory' as Tab, label: 'Memory', icon: Database, adminOnly: true },
    { id: 'speech' as Tab, label: 'Speech', icon: Mic, adminOnly: true },
    { id: 'conversations' as Tab, label: 'Conversations', icon: MessageSquare, adminOnly: true },
    { id: 'other' as Tab, label: 'Other', icon: Settings2, adminOnly: true },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center space-x-2 mb-6">
        <SettingsIcon className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
      </div>

      {/* Message Display */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-center">
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
            )}
            <p
              className={`text-sm ${
                message.type === 'success'
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              }`}
            >
              {message.text}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-4 overflow-x-auto">
          {tabs.map((tab) => {
            // Hide admin-only tabs for non-admins
            if (tab.adminOnly && !user?.is_superuser) return null

            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {/* Core Infrastructure */}
        {activeTab === 'core-infra' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Core Infrastructure
              </h2>
              <button
                onClick={loadInfrastructureStatus}
                disabled={infraLoading}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <RefreshCw className={`h-4 w-4 ${infraLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {infraLoading && !infraStatus ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Loading infrastructure status...</p>
              </div>
            ) : infraStatus ? (
              <div className="space-y-4">
                {Object.entries(infraStatus).map(([service, info]: [string, any]) => (
                  <div
                    key={service}
                    className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {service}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          info.connected
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}
                      >
                        {info.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      {info.url && (
                        <p>
                          <span className="font-medium">URL:</span>{' '}
                          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                            {info.url}
                          </code>
                        </p>
                      )}
                      {info.host && (
                        <p>
                          <span className="font-medium">Host:</span> {info.host}
                        </p>
                      )}
                      {info.database && (
                        <p>
                          <span className="font-medium">Database:</span> {info.database}
                        </p>
                      )}
                      {info.user && (
                        <p>
                          <span className="font-medium">User:</span> {info.user}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Failed to load infrastructure status
                </p>
                <button
                  onClick={loadInfrastructureStatus}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

        {/* API Keys */}
        {activeTab === 'api-keys' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              External Service API Keys
            </h2>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Note:</strong> API keys are configured via environment variables and require
                a server restart to change. This page shows which keys are currently configured.
              </p>
            </div>

            {apiKeysLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Loading API keys status...</p>
              </div>
            ) : apiKeysStatus ? (
              <div className="space-y-3">
                {Object.entries(apiKeysStatus).map(([key, info]: [string, any]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">{info.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                          {info.env_var}
                        </code>
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        info.configured
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                      }`}
                    >
                      {info.configured ? 'Configured' : 'Not Set'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Failed to load API keys status</p>
              </div>
            )}
          </div>
        )}

        {/* MCP Key */}
        {activeTab === 'mcp-key' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              MCP API Key
            </h2>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Generate an API key for Model Context Protocol (MCP) clients like Claude Desktop,
              Cursor, or Windsurf to access your conversations.
            </p>

            {apiKey ? (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Current MCP API Key
                    </span>
                    {apiKeyCreatedAt && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Created: {formatDate(apiKeyCreatedAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded font-mono text-sm text-gray-900 dark:text-gray-100 break-all">
                      {apiKey}
                    </code>
                    <button
                      onClick={copyToClipboard}
                      className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
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
                      <strong>MCP Server URL:</strong>{' '}
                      <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">
                        http://your-server:8000/mcp/conversations/sse
                      </code>
                      <br />
                      <strong>Authorization:</strong> Bearer {apiKey}
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
                <p className="text-gray-500 dark:text-gray-400 mb-4">No MCP API key generated yet</p>
                <button
                  onClick={generateApiKey}
                  disabled={loading}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
                >
                  <Key className="h-5 w-5" />
                  <span>{loading ? 'Generating...' : 'Generate MCP API Key'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Memory Settings */}
        {activeTab === 'memory' && appSettings && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Memory Settings
            </h2>

            <div className="space-y-4">
              {renderSettingsField(
                'providers',
                'memory_provider',
                appSettings.providers.memory_provider,
                'Memory Provider',
                'Choose where memories are stored and processed',
                'select',
                [
                  { value: 'chronicle', label: 'Chronicle (Default)' },
                  { value: 'openmemory_mcp', label: 'OpenMemory MCP' },
                  { value: 'mycelia', label: 'Mycelia' },
                ]
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={() => updateCategorySettings('providers', appSettings.providers)}
                disabled={appSettingsLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>Save Memory Settings</span>
              </button>
            </div>
          </div>
        )}

        {/* Speech Settings */}
        {activeTab === 'speech' && appSettings && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Speech & Audio Settings
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Speech Detection
                </h3>
                <div className="space-y-2">
                  {renderSettingsField(
                    'speech_detection',
                    'min_words',
                    appSettings.speech_detection.min_words,
                    'Minimum Words',
                    'Minimum words required to create a conversation',
                    'number'
                  )}
                  {renderSettingsField(
                    'speech_detection',
                    'min_confidence',
                    appSettings.speech_detection.min_confidence,
                    'Minimum Confidence',
                    'Word confidence threshold (0.0-1.0)',
                    'number'
                  )}
                  {renderSettingsField(
                    'speech_detection',
                    'min_duration',
                    appSettings.speech_detection.min_duration,
                    'Minimum Duration (seconds)',
                    'Minimum speech duration in seconds',
                    'number'
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Audio Processing
                </h3>
                <div className="space-y-2">
                  {renderSettingsField(
                    'audio_processing',
                    'audio_cropping_enabled',
                    appSettings.audio_processing.audio_cropping_enabled,
                    'Enable Audio Cropping',
                    'Automatically remove silence from audio',
                    'boolean'
                  )}
                  {renderSettingsField(
                    'audio_processing',
                    'min_speech_segment_duration',
                    appSettings.audio_processing.min_speech_segment_duration,
                    'Min Speech Segment Duration',
                    'Minimum duration for speech segments (seconds)',
                    'number'
                  )}
                  {renderSettingsField(
                    'audio_processing',
                    'cropping_context_padding',
                    appSettings.audio_processing.cropping_context_padding,
                    'Context Padding',
                    'Padding around speech segments (0.0-1.0)',
                    'number'
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Transcription Provider
                </h3>
                {renderSettingsField(
                  'providers',
                  'transcription_provider',
                  appSettings.providers.transcription_provider,
                  'Transcription Service',
                  'Choose which service to use for speech-to-text',
                  'select',
                  [
                    { value: 'auto', label: 'Auto-detect' },
                    { value: 'deepgram', label: 'Deepgram' },
                    { value: 'mistral', label: 'Mistral' },
                    { value: 'parakeet', label: 'Parakeet (Local)' },
                  ]
                )}
              </div>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={async () => {
                  await updateCategorySettings('speech_detection', appSettings.speech_detection)
                  await updateCategorySettings('audio_processing', appSettings.audio_processing)
                  await updateCategorySettings('providers', appSettings.providers)
                }}
                disabled={appSettingsLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>Save Speech Settings</span>
              </button>
            </div>
          </div>
        )}

        {/* Conversations Settings */}
        {activeTab === 'conversations' && appSettings && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Conversation Settings
            </h2>

            <div className="space-y-2">
              {renderSettingsField(
                'conversation',
                'transcription_buffer_seconds',
                appSettings.conversation.transcription_buffer_seconds,
                'Transcription Buffer (seconds)',
                'Trigger transcription every N seconds',
                'number'
              )}
              {renderSettingsField(
                'conversation',
                'speech_inactivity_threshold',
                appSettings.conversation.speech_inactivity_threshold,
                'Speech Inactivity Threshold (seconds)',
                'Close conversation after N seconds of silence',
                'number'
              )}
              {renderSettingsField(
                'conversation',
                'new_conversation_timeout_minutes',
                appSettings.conversation.new_conversation_timeout_minutes,
                'New Conversation Timeout (minutes)',
                'Timeout for creating new conversations',
                'number'
              )}
              {renderSettingsField(
                'conversation',
                'record_only_enrolled_speakers',
                appSettings.conversation.record_only_enrolled_speakers,
                'Record Only Enrolled Speakers',
                'Only create conversations when enrolled speakers are detected',
                'boolean'
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={() => updateCategorySettings('conversation', appSettings.conversation)}
                disabled={appSettingsLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>Save Conversation Settings</span>
              </button>
            </div>
          </div>
        )}

        {/* Other Settings */}
        {activeTab === 'other' && appSettings && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Other Settings
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Speaker Diarization
                </h3>
                <div className="space-y-2">
                  {renderSettingsField(
                    'diarization',
                    'diarization_source',
                    appSettings.diarization.diarization_source,
                    'Diarization Source',
                    'Service to use for speaker identification',
                    'select',
                    [
                      { value: 'pyannote', label: 'PyAnnote' },
                      { value: 'deepgram', label: 'Deepgram' },
                    ]
                  )}
                  {renderSettingsField(
                    'diarization',
                    'min_speakers',
                    appSettings.diarization.min_speakers,
                    'Minimum Speakers',
                    'Minimum number of speakers to detect',
                    'number'
                  )}
                  {renderSettingsField(
                    'diarization',
                    'max_speakers',
                    appSettings.diarization.max_speakers,
                    'Maximum Speakers',
                    'Maximum number of speakers to detect',
                    'number'
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  LLM Configuration
                </h3>
                <div className="space-y-2">
                  {renderSettingsField(
                    'llm',
                    'llm_provider',
                    appSettings.llm.llm_provider,
                    'LLM Provider',
                    'Language model provider for memory extraction',
                    'select',
                    [
                      { value: 'openai', label: 'OpenAI' },
                      { value: 'ollama', label: 'Ollama' },
                    ]
                  )}
                  {renderSettingsField(
                    'llm',
                    'openai_model',
                    appSettings.llm.openai_model,
                    'OpenAI Model',
                    'Model to use for OpenAI requests',
                    'text'
                  )}
                  {renderSettingsField(
                    'llm',
                    'chat_temperature',
                    appSettings.llm.chat_temperature,
                    'Chat Temperature',
                    'Temperature for chat responses (0.0-2.0)',
                    'number'
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Network & System
                </h3>
                <div className="space-y-2">
                  {renderSettingsField(
                    'network',
                    'host_ip',
                    appSettings.network.host_ip,
                    'Host IP',
                    'Public IP or hostname for browser access',
                    'text'
                  )}
                  {renderSettingsField(
                    'network',
                    'backend_public_port',
                    appSettings.network.backend_public_port,
                    'Backend Port',
                    'Public port for backend API',
                    'number'
                  )}
                  {renderSettingsField(
                    'misc',
                    'langfuse_enable_telemetry',
                    appSettings.misc.langfuse_enable_telemetry,
                    'Enable Langfuse Telemetry',
                    'Enable telemetry for Langfuse',
                    'boolean'
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={async () => {
                  await updateCategorySettings('diarization', appSettings.diarization)
                  await updateCategorySettings('llm', appSettings.llm)
                  await updateCategorySettings('network', appSettings.network)
                  await updateCategorySettings('misc', appSettings.misc)
                }}
                disabled={appSettingsLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>Save Other Settings</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading state for settings tabs */}
        {['memory', 'speech', 'conversations', 'other'].includes(activeTab) &&
          appSettingsLoading &&
          !appSettings && (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading settings...</p>
            </div>
          )}
      </div>
    </div>
  )
}
