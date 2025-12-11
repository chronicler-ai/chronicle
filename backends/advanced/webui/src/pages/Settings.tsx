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
  Shield,
  Brain,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { settingsApi } from '../services/api'

type Tab = 'core-infra' | 'api-keys' | 'mcp-key' | 'memory' | 'llm' | 'speech' | 'conversations'

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

  // Infrastructure settings state
  const [infraSettings, setInfraSettings] = useState<any>(null)
  const [infraSettingsOriginal, setInfraSettingsOriginal] = useState<any>(null)
  const [infraSettingsLoading, setInfraSettingsLoading] = useState(false)
  const [infraSettingsSaving, setInfraSettingsSaving] = useState(false)

  // API Keys settings state
  const [apiKeysSettings, setApiKeysSettings] = useState<any>(null)
  const [apiKeysSettingsOriginal, setApiKeysSettingsOriginal] = useState<any>(null)
  const [apiKeysSettingsLoading, setApiKeysSettingsLoading] = useState(false)
  const [apiKeysSettingsSaving, setApiKeysSettingsSaving] = useState(false)

  // API Keys visibility state
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({
    openai_api_key: false,
    deepgram_api_key: false,
    mistral_api_key: false,
    hf_token: false,
    langfuse_public_key: false,
    langfuse_secret_key: false,
    ngrok_authtoken: false,
  })

  // API Keys save options
  const [saveToFile, setSaveToFile] = useState(true)
  const [saveToDatabase, setSaveToDatabase] = useState(true)
  const [apiKeysFilePath, setApiKeysFilePath] = useState('.env.api-keys')
  const [loadingFromFile, setLoadingFromFile] = useState(false)

  // Application settings state
  const [appSettings, setAppSettings] = useState<any>(null)
  const [appSettingsLoading, setAppSettingsLoading] = useState(false)

  const [message, setMessage] = useState<Message | null>(null)

  useEffect(() => {
    loadApiKeyInfo()
  }, [user])

  useEffect(() => {
    if (activeTab === 'core-infra') {
      if (!infraStatus) loadInfrastructureStatus()
      if (!infraSettings) loadInfrastructureSettings()
      if (!appSettings) loadApplicationSettings() // Load for network & misc settings
    } else if (activeTab === 'api-keys') {
      if (!apiKeysSettings) loadApiKeysSettings()
    } else if (['memory', 'llm', 'speech', 'conversations'].includes(activeTab) && !appSettings) {
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

  const loadInfrastructureSettings = async () => {
    try {
      setInfraSettingsLoading(true)
      const response = await settingsApi.getInfrastructure()
      setInfraSettings(response.data)
      setInfraSettingsOriginal(response.data)
    } catch (error: any) {
      console.error('Failed to load infrastructure settings:', error)
      showMessage('error', 'Failed to load infrastructure settings')
    } finally {
      setInfraSettingsLoading(false)
    }
  }

  const saveInfrastructureSettings = async () => {
    try {
      setInfraSettingsSaving(true)
      await settingsApi.updateInfrastructure(infraSettings)
      setInfraSettingsOriginal(infraSettings)
      showMessage('success', 'Infrastructure settings saved successfully')
      // Reload status to reflect new settings
      loadInfrastructureStatus()
    } catch (error: any) {
      console.error('Failed to save infrastructure settings:', error)
      showMessage('error', error.response?.data?.detail || 'Failed to save infrastructure settings')
    } finally {
      setInfraSettingsSaving(false)
    }
  }

  const resetInfrastructureSettings = () => {
    setInfraSettings({ ...infraSettingsOriginal })
  }

  const loadApiKeysSettings = async () => {
    try {
      setApiKeysSettingsLoading(true)
      const response = await settingsApi.getApiKeys()
      setApiKeysSettings(response.data)
      setApiKeysSettingsOriginal(response.data)
    } catch (error: any) {
      console.error('Failed to load API keys settings:', error)
      showMessage('error', 'Failed to load API keys settings')
    } finally {
      setApiKeysSettingsLoading(false)
    }
  }

  const saveApiKeysSettings = async () => {
    try {
      setApiKeysSettingsSaving(true)
      const response = await settingsApi.saveApiKeys(apiKeysSettings, saveToFile, saveToDatabase)

      if (response.data.success) {
        setApiKeysSettingsOriginal(apiKeysSettings)
        const savedTo: string[] = []
        if (response.data.saved_to.file) savedTo.push('file')
        if (response.data.saved_to.database) savedTo.push('database')
        showMessage('success', `API keys saved to ${savedTo.join(' and ')}`)
      } else {
        showMessage('error', response.data.errors.join(', ') || 'Failed to save API keys')
      }
    } catch (error: any) {
      console.error('Failed to save API keys:', error)
      showMessage('error', error.response?.data?.detail || 'Failed to save API keys')
    } finally {
      setApiKeysSettingsSaving(false)
    }
  }

  const resetApiKeysSettings = () => {
    setApiKeysSettings({ ...apiKeysSettingsOriginal })
  }

  // Toggle API key visibility
  const toggleApiKeyVisibility = (keyName: string) => {
    setShowApiKeys(prev => ({ ...prev, [keyName]: !prev[keyName] }))
  }

  // Load API keys from file
  const loadApiKeysFromFile = async () => {
    try {
      setLoadingFromFile(true)
      const response = await settingsApi.loadApiKeysFromFile(apiKeysFilePath)

      if (response.data) {
        setApiKeysSettings(response.data)
        setApiKeysSettingsOriginal(response.data)
        showMessage('success', `API keys loaded from ${apiKeysFilePath}`)
      }
    } catch (error: any) {
      console.error('Failed to load API keys from file:', error)
      showMessage('error', error.response?.data?.detail || 'Failed to load API keys from file')
    } finally {
      setLoadingFromFile(false)
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
    { id: 'llm' as Tab, label: 'LLM', icon: Brain, adminOnly: true },
    { id: 'speech' as Tab, label: 'Speech', icon: Mic, adminOnly: true },
    { id: 'conversations' as Tab, label: 'Conversations', icon: MessageSquare, adminOnly: true },
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
              <div className="flex items-center gap-2">
                <button
                  onClick={loadInfrastructureStatus}
                  disabled={infraLoading}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-2"
                  title="Refresh connection status"
                >
                  <RefreshCw className={`h-4 w-4 ${infraLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {infraSettingsLoading && !infraSettings ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Loading infrastructure settings...</p>
              </div>
            ) : infraSettings ? (
              <div className="space-y-6">
                {/* MongoDB */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">MongoDB</h3>
                    {infraStatus?.mongodb && (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          infraStatus.mongodb.connected
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}
                      >
                        {infraStatus.mongodb.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        MongoDB URI
                      </label>
                      <input
                        type="text"
                        value={infraSettings.mongodb_uri || ''}
                        onChange={(e) => setInfraSettings({ ...infraSettings, mongodb_uri: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="mongodb://mongo:27017"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Database Name
                      </label>
                      <input
                        type="text"
                        value={infraSettings.mongodb_database || ''}
                        onChange={(e) => setInfraSettings({ ...infraSettings, mongodb_database: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="friend-lite"
                      />
                    </div>
                  </div>
                </div>

                {/* Redis */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">Redis</h3>
                    {infraStatus?.redis && (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          infraStatus.redis.connected
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}
                      >
                        {infraStatus.redis.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Redis URL
                    </label>
                    <input
                      type="text"
                      value={infraSettings.redis_url || ''}
                      onChange={(e) => setInfraSettings({ ...infraSettings, redis_url: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      placeholder="redis://localhost:6379/0"
                    />
                  </div>
                </div>

                {/* Qdrant */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">Qdrant</h3>
                    {infraStatus?.qdrant && (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          infraStatus.qdrant.connected
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}
                      >
                        {infraStatus.qdrant.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Base URL
                      </label>
                      <input
                        type="text"
                        value={infraSettings.qdrant_base_url || ''}
                        onChange={(e) => setInfraSettings({ ...infraSettings, qdrant_base_url: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="qdrant"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Port
                      </label>
                      <input
                        type="text"
                        value={infraSettings.qdrant_port || ''}
                        onChange={(e) => setInfraSettings({ ...infraSettings, qdrant_port: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="6333"
                      />
                    </div>
                  </div>
                </div>

                {/* Neo4j */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">Neo4j</h3>
                    {infraStatus?.neo4j && (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          infraStatus.neo4j.connected
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}
                      >
                        {infraStatus.neo4j.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Host
                      </label>
                      <input
                        type="text"
                        value={infraSettings.neo4j_host || ''}
                        onChange={(e) => setInfraSettings({ ...infraSettings, neo4j_host: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="neo4j-mem0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        User
                      </label>
                      <input
                        type="text"
                        value={infraSettings.neo4j_user || ''}
                        onChange={(e) => setInfraSettings({ ...infraSettings, neo4j_user: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="neo4j"
                      />
                    </div>
                  </div>
                </div>

                {/* Network Settings */}
                {appSettings && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Network & Public Access</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Host IP/Hostname
                        </label>
                        <input
                          type="text"
                          value={appSettings.network.host_ip || ''}
                          onChange={(e) => setAppSettings({
                            ...appSettings,
                            network: { ...appSettings.network, host_ip: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          placeholder="localhost"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Public IP or hostname for browser access
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Backend Public Port
                          </label>
                          <input
                            type="number"
                            value={appSettings.network.backend_public_port || ''}
                            onChange={(e) => setAppSettings({
                              ...appSettings,
                              network: { ...appSettings.network, backend_public_port: parseInt(e.target.value) }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            placeholder="8000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            WebUI Port
                          </label>
                          <input
                            type="number"
                            value={appSettings.network.webui_port || ''}
                            onChange={(e) => setAppSettings({
                              ...appSettings,
                              network: { ...appSettings.network, webui_port: parseInt(e.target.value) }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            placeholder="5173"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* System Settings */}
                {appSettings && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">System</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Debug Directory
                        </label>
                        <input
                          type="text"
                          value={appSettings.misc.debug_dir || ''}
                          onChange={(e) => setAppSettings({
                            ...appSettings,
                            misc: { ...appSettings.misc, debug_dir: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          placeholder="./data/debug_dir"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Directory for debug files
                        </p>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="langfuse_telemetry"
                          checked={appSettings.misc.langfuse_enable_telemetry || false}
                          onChange={(e) => setAppSettings({
                            ...appSettings,
                            misc: { ...appSettings.misc, langfuse_enable_telemetry: e.target.checked }
                          })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="langfuse_telemetry" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                          Enable Langfuse Telemetry
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Save and Reset buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <button
                    onClick={() => {
                      resetInfrastructureSettings()
                      if (appSettings) {
                        loadApplicationSettings()
                      }
                    }}
                    disabled={infraSettingsSaving || appSettingsLoading}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reset
                  </button>
                  <button
                    onClick={async () => {
                      await saveInfrastructureSettings()
                      if (appSettings) {
                        await updateCategorySettings('network', appSettings.network)
                        await updateCategorySettings('misc', appSettings.misc)
                      }
                    }}
                    disabled={infraSettingsSaving || appSettingsLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {infraSettingsSaving || appSettingsLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Failed to load infrastructure settings
                </p>
                <button
                  onClick={loadInfrastructureSettings}
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
                <strong>Note:</strong> API keys are stored securely and take effect immediately after saving.
                Leave fields empty to keep existing keys unchanged.
              </p>
            </div>

            {/* Load from File Section */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600 mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Load API Keys from File
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={apiKeysFilePath}
                  onChange={(e) => setApiKeysFilePath(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                  placeholder=".env.api-keys"
                />
                <button
                  onClick={loadApiKeysFromFile}
                  disabled={loadingFromFile || !apiKeysFilePath}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loadingFromFile ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Load from File
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Load API keys from a file on the server. Default: .env.api-keys in project root.
              </p>
            </div>

            {apiKeysSettingsLoading && !apiKeysSettings ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Loading API keys...</p>
              </div>
            ) : apiKeysSettings ? (
              <div className="space-y-6">
                {/* OpenAI */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    OpenAI API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKeys.openai_api_key ? 'text' : 'password'}
                      value={apiKeysSettings.openai_api_key || ''}
                      onChange={(e) => setApiKeysSettings({ ...apiKeysSettings, openai_api_key: e.target.value })}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
                      placeholder="sk-..."
                    />
                    <button
                      type="button"
                      onClick={() => toggleApiKeyVisibility('openai_api_key')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      title={showApiKeys.openai_api_key ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKeys.openai_api_key ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    For GPT models and embeddings
                  </p>
                </div>

                {/* Deepgram */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Deepgram API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKeys.deepgram_api_key ? 'text' : 'password'}
                      value={apiKeysSettings.deepgram_api_key || ''}
                      onChange={(e) => setApiKeysSettings({ ...apiKeysSettings, deepgram_api_key: e.target.value })}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
                      placeholder="Enter Deepgram API key"
                    />
                    <button
                      type="button"
                      onClick={() => toggleApiKeyVisibility('deepgram_api_key')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      title={showApiKeys.deepgram_api_key ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKeys.deepgram_api_key ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    For speech-to-text transcription
                  </p>
                </div>

                {/* Mistral */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Mistral API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKeys.mistral_api_key ? 'text' : 'password'}
                      value={apiKeysSettings.mistral_api_key || ''}
                      onChange={(e) => setApiKeysSettings({ ...apiKeysSettings, mistral_api_key: e.target.value })}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
                      placeholder="Enter Mistral API key"
                    />
                    <button
                      type="button"
                      onClick={() => toggleApiKeyVisibility('mistral_api_key')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      title={showApiKeys.mistral_api_key ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKeys.mistral_api_key ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    For Mistral/Voxtral transcription
                  </p>
                </div>

                {/* HuggingFace */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    HuggingFace Token
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKeys.hf_token ? 'text' : 'password'}
                      value={apiKeysSettings.hf_token || ''}
                      onChange={(e) => setApiKeysSettings({ ...apiKeysSettings, hf_token: e.target.value })}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
                      placeholder="hf_..."
                    />
                    <button
                      type="button"
                      onClick={() => toggleApiKeyVisibility('hf_token')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      title={showApiKeys.hf_token ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKeys.hf_token ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    For accessing HuggingFace models
                  </p>
                </div>

                {/* Langfuse */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 mt-6">
                    Langfuse (Observability)
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Public Key
                      </label>
                      <div className="relative">
                        <input
                          type={showApiKeys.langfuse_public_key ? 'text' : 'password'}
                          value={apiKeysSettings.langfuse_public_key || ''}
                          onChange={(e) => setApiKeysSettings({ ...apiKeysSettings, langfuse_public_key: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
                          placeholder="pk-lf-..."
                        />
                        <button
                          type="button"
                          onClick={() => toggleApiKeyVisibility('langfuse_public_key')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          title={showApiKeys.langfuse_public_key ? 'Hide API key' : 'Show API key'}
                        >
                          {showApiKeys.langfuse_public_key ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Secret Key
                      </label>
                      <div className="relative">
                        <input
                          type={showApiKeys.langfuse_secret_key ? 'text' : 'password'}
                          value={apiKeysSettings.langfuse_secret_key || ''}
                          onChange={(e) => setApiKeysSettings({ ...apiKeysSettings, langfuse_secret_key: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
                          placeholder="sk-lf-..."
                        />
                        <button
                          type="button"
                          onClick={() => toggleApiKeyVisibility('langfuse_secret_key')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          title={showApiKeys.langfuse_secret_key ? 'Hide API key' : 'Show API key'}
                        >
                          {showApiKeys.langfuse_secret_key ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ngrok */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ngrok Auth Token
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKeys.ngrok_authtoken ? 'text' : 'password'}
                      value={apiKeysSettings.ngrok_authtoken || ''}
                      onChange={(e) => setApiKeysSettings({ ...apiKeysSettings, ngrok_authtoken: e.target.value })}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
                      placeholder="Enter Ngrok auth token"
                    />
                    <button
                      type="button"
                      onClick={() => toggleApiKeyVisibility('ngrok_authtoken')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      title={showApiKeys.ngrok_authtoken ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKeys.ngrok_authtoken ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    For public URL tunneling
                  </p>
                </div>

                {/* Save Options */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Save Options
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveToFile}
                        onChange={(e) => setSaveToFile(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Save to .env.api-keys file
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveToDatabase}
                        onChange={(e) => setSaveToDatabase(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Save to database
                      </span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    You can save to file only, database only, or both for redundancy.
                  </p>
                </div>

                {/* Save and Reset buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <button
                    onClick={resetApiKeysSettings}
                    disabled={apiKeysSettingsSaving}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reset
                  </button>
                  <button
                    onClick={saveApiKeysSettings}
                    disabled={apiKeysSettingsSaving || (!saveToFile && !saveToDatabase)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {apiKeysSettingsSaving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save API Keys
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Failed to load API keys
                </p>
                <button
                  onClick={loadApiKeysSettings}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
              Speech & Audio Settings
            </h2>

            <div className="space-y-6">
              {/* Transcription */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Transcription
                </h3>
                <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-800">
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

              {/* Speech Detection */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Speech Detection
                </h3>
                <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-800 space-y-2">
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

              {/* Diarization */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Speaker Diarization
                </h3>
                <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-800 space-y-2">
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

              {/* Audio Processing */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Audio Processing
                </h3>
                <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-800 space-y-2">
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
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={async () => {
                  await updateCategorySettings('providers', appSettings.providers)
                  await updateCategorySettings('speech_detection', appSettings.speech_detection)
                  await updateCategorySettings('diarization', appSettings.diarization)
                  await updateCategorySettings('audio_processing', appSettings.audio_processing)
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

        {/* LLM Settings */}
        {activeTab === 'llm' && appSettings && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              LLM Configuration
            </h2>

            <div className="space-y-6">
              {/* Provider Selection */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 border-b border-gray-200 dark:border-gray-600 pb-2">
                  Provider
                </h3>
                <div className="space-y-2">
                  {renderSettingsField(
                    'llm',
                    'llm_provider',
                    appSettings.llm.llm_provider,
                    'LLM Provider',
                    'Language model provider for memory extraction and chat',
                    'select',
                    [
                      { value: 'openai', label: 'OpenAI' },
                      { value: 'ollama', label: 'Ollama' },
                    ]
                  )}
                </div>
              </div>

              {/* OpenAI Settings */}
              {appSettings.llm.llm_provider === 'openai' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 border-b border-gray-200 dark:border-gray-600 pb-2">
                    OpenAI Settings
                  </h3>
                  <div className="space-y-2">
                    {renderSettingsField(
                      'llm',
                      'openai_model',
                      appSettings.llm.openai_model,
                      'OpenAI Model',
                      'Model to use for general tasks',
                      'text'
                    )}
                    {renderSettingsField(
                      'llm',
                      'chat_llm_model',
                      appSettings.llm.chat_llm_model || '',
                      'Chat Model (Optional)',
                      'Specific model for chat (defaults to OpenAI model if not set)',
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
              )}

              {/* Ollama Settings */}
              {appSettings.llm.llm_provider === 'ollama' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 border-b border-gray-200 dark:border-gray-600 pb-2">
                    Ollama Settings
                  </h3>
                  <div className="space-y-2">
                    {renderSettingsField(
                      'llm',
                      'ollama_model',
                      appSettings.llm.ollama_model || '',
                      'Ollama Model',
                      'Model name for Ollama',
                      'text'
                    )}
                    {renderSettingsField(
                      'llm',
                      'ollama_embedder_model',
                      appSettings.llm.ollama_embedder_model || '',
                      'Ollama Embedder Model',
                      'Embedder model name for Ollama',
                      'text'
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={async () => {
                  await updateCategorySettings('llm', appSettings.llm)
                }}
                disabled={appSettingsLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>Save LLM Settings</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading state for settings tabs */}
        {['memory', 'llm', 'speech', 'conversations'].includes(activeTab) &&
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
