import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Tag, Trash2, RefreshCw } from 'lucide-react'
import { memoriesApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

interface Memory {
  id: string
  memory: string
  category?: string
  created_at: string
  updated_at: string
  user_id: string
  score?: number
  metadata?: {
    name?: string
    timeRanges?: Array<{
      start: string
      end: string
      name?: string
    }>
    isPerson?: boolean
    isEvent?: boolean
    isPlace?: boolean
    extractedWith?: {
      model: string
      timestamp: string
    }
    [key: string]: any
  }
  hash?: string
  role?: string
}

export default function MemoryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [memory, setMemory] = useState<Memory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMemory = async () => {
    if (!user?.id || !id) {
      console.log('⏭️ MemoryDetail: Missing user or id', { userId: user?.id, memoryId: id })
      return
    }

    try {
      console.log('🔍 MemoryDetail: Loading memory', id)
      setLoading(true)
      setError(null)
      const response = await memoriesApi.getById(id, user.id)
      const memoryData = response.data.memory
      console.log('📦 MemoryDetail: Loaded memory', memoryData?.id)

      if (memoryData) {
        setMemory(memoryData)
      } else {
        setError('Memory not found')
      }
    } catch (err: any) {
      console.error('❌ Failed to load memory:', err)
      if (err.response?.status === 404) {
        setError('Memory not found')
      } else {
        setError(err.message || 'Failed to load memory')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!memory || !id) return

    const confirmed = window.confirm('Are you sure you want to delete this memory?')
    if (!confirmed) return

    try {
      await memoriesApi.delete(id)
      navigate('/memories')
    } catch (err: any) {
      console.error('❌ Failed to delete memory:', err)
      alert('Failed to delete memory: ' + (err.message || 'Unknown error'))
    }
  }

  useEffect(() => {
    loadMemory()
  }, [id, user?.id])

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const getMemoryTypeIcon = () => {
    if (memory?.metadata?.isEvent) return '📅'
    if (memory?.metadata?.isPerson) return '👤'
    if (memory?.metadata?.isPlace) return '📍'
    return '🧠'
  }

  const getMemoryTypeLabel = () => {
    if (memory?.metadata?.isEvent) return 'Event'
    if (memory?.metadata?.isPerson) return 'Person'
    if (memory?.metadata?.isPlace) return 'Place'
    return 'Memory'
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/memories')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
        </div>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading memory...</span>
        </div>
      </div>
    )
  }

  if (error || !memory) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/memories')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
        </div>
        <div className="border border-red-200 dark:border-red-800 rounded-lg p-8 text-center bg-red-50 dark:bg-red-900/20">
          <p className="text-red-600 dark:text-red-400">
            {error || 'Memory not found'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/memories')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Memories
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Memory Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Memory Card */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-3xl">{getMemoryTypeIcon()}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                    {getMemoryTypeLabel()}
                  </span>
                  {memory.category && (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {memory.category}
                    </span>
                  )}
                </div>
                {memory.metadata?.name && (
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                    {memory.metadata.name}
                  </h1>
                )}
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {memory.memory}
                </p>
              </div>
            </div>
          </div>

          {/* Time Ranges */}
          {memory.metadata?.timeRanges && memory.metadata.timeRanges.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Time Ranges
              </h2>
              <div className="space-y-3">
                {memory.metadata.timeRanges.map((range, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <Calendar className="w-4 h-4 mt-1 text-blue-600 dark:text-blue-400" />
                    <div className="flex-1">
                      {range.name && (
                        <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                          {range.name}
                        </div>
                      )}
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <div><strong>Start:</strong> {formatDate(range.start)}</div>
                        <div><strong>End:</strong> {formatDate(range.end)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Metadata */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
              Metadata
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between items-start">
                <dt className="text-gray-600 dark:text-gray-400">Created:</dt>
                <dd className="text-gray-900 dark:text-gray-100 text-right">
                  {formatDate(memory.created_at)}
                </dd>
              </div>
              <div className="flex justify-between items-start">
                <dt className="text-gray-600 dark:text-gray-400">Updated:</dt>
                <dd className="text-gray-900 dark:text-gray-100 text-right">
                  {formatDate(memory.updated_at)}
                </dd>
              </div>
              {memory.score !== undefined && memory.score !== null && (
                <div className="flex justify-between items-start">
                  <dt className="text-gray-600 dark:text-gray-400">Score:</dt>
                  <dd className="text-gray-900 dark:text-gray-100">
                    {memory.score.toFixed(3)}
                  </dd>
                </div>
              )}
              {memory.hash && (
                <div className="flex justify-between items-start">
                  <dt className="text-gray-600 dark:text-gray-400">Hash:</dt>
                  <dd className="font-mono text-xs text-gray-900 dark:text-gray-100 truncate max-w-[150px]" title={memory.hash}>
                    {memory.hash.substring(0, 12)}...
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Extraction Metadata */}
          {memory.metadata?.extractedWith && (
            <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                Extraction
              </h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between items-start">
                  <dt className="text-gray-600 dark:text-gray-400">Model:</dt>
                  <dd className="font-mono text-xs text-gray-900 dark:text-gray-100">
                    {memory.metadata.extractedWith.model}
                  </dd>
                </div>
                <div className="flex justify-between items-start">
                  <dt className="text-gray-600 dark:text-gray-400">Time:</dt>
                  <dd className="text-gray-900 dark:text-gray-100 text-right">
                    {formatDate(memory.metadata.extractedWith.timestamp)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Additional Metadata */}
          {memory.metadata && Object.keys(memory.metadata).filter(key =>
            !['name', 'timeRanges', 'isPerson', 'isEvent', 'isPlace', 'extractedWith'].includes(key)
          ).length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                Additional Data
              </h3>
              <dl className="space-y-2 text-sm">
                {Object.entries(memory.metadata)
                  .filter(([key]) => !['name', 'timeRanges', 'isPerson', 'isEvent', 'isPlace', 'extractedWith'].includes(key))
                  .map(([key, value]) => (
                    <div key={key} className="flex justify-between items-start gap-2">
                      <dt className="text-gray-600 dark:text-gray-400 capitalize">{key}:</dt>
                      <dd className="text-gray-900 dark:text-gray-100 text-right truncate max-w-[150px]" title={String(value)}>
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
