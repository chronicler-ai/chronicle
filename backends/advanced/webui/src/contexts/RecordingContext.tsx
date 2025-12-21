import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { getStorageKey } from '../utils/storage'

export type RecordingMode = 'streaming' | 'batch'
export type RecordingStep = 'idle' | 'mic' | 'websocket' | 'audio-start' | 'streaming' | 'stopping' | 'error'

interface RecordingState {
  isRecording: boolean
  mode: RecordingMode
  duration: number
  currentStep: RecordingStep
  error: string | null
}

interface RecordingContextType extends RecordingState {
  startRecording: (mode: RecordingMode) => void
  stopRecording: () => void
  setMode: (mode: RecordingMode) => void
  setRecordingDuration: (duration: number) => void
  setCurrentStep: (step: RecordingStep) => void
  setError: (error: string | null) => void
  resetRecording: () => void
}

const STORAGE_KEY = getStorageKey('recording_state')

const defaultState: RecordingState = {
  isRecording: false,
  mode: 'streaming',
  duration: 0,
  currentStep: 'idle',
  error: null,
}

const RecordingContext = createContext<RecordingContextType | undefined>(undefined)

export function RecordingProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage
  const [state, setState] = useState<RecordingState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse recording state from localStorage:', e)
      }
    }
    return defaultState
  })

  // Persist to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  // Listen for storage events to sync across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const newState = JSON.parse(e.newValue)
          setState(newState)
        } catch (error) {
          console.error('Failed to parse recording state from storage event:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const startRecording = useCallback((mode: RecordingMode) => {
    setState(prev => ({
      ...prev,
      isRecording: true,
      mode,
      duration: 0,
      currentStep: 'mic',
      error: null,
    }))
  }, [])

  const stopRecording = useCallback(() => {
    setState(prev => ({
      ...prev,
      isRecording: false,
      currentStep: 'stopping',
    }))
  }, [])

  const setMode = useCallback((mode: RecordingMode) => {
    setState(prev => ({ ...prev, mode }))
  }, [])

  const setRecordingDuration = useCallback((duration: number) => {
    setState(prev => ({ ...prev, duration }))
  }, [])

  const setCurrentStep = useCallback((currentStep: RecordingStep) => {
    setState(prev => ({ ...prev, currentStep }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }))
  }, [])

  const resetRecording = useCallback(() => {
    setState(defaultState)
  }, [])

  const value: RecordingContextType = {
    ...state,
    startRecording,
    stopRecording,
    setMode,
    setRecordingDuration,
    setCurrentStep,
    setError,
    resetRecording,
  }

  return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>
}

export function useRecording() {
  const context = useContext(RecordingContext)
  if (context === undefined) {
    throw new Error('useRecording must be used within a RecordingProvider')
  }
  return context
}
