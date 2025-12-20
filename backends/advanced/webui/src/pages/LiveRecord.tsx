import { Radio, Zap, Archive } from 'lucide-react'
import { useSimpleAudioRecording } from '../hooks/useSimpleAudioRecording'
import SimplifiedControls from '../components/audio/SimplifiedControls'
import StatusDisplay from '../components/audio/StatusDisplay'
import AudioVisualizer from '../components/audio/AudioVisualizer'
import SimpleDebugPanel from '../components/audio/SimpleDebugPanel'

export default function LiveRecord() {
  const recording = useSimpleAudioRecording()

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <Radio className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Live Audio Recording
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Record audio in real-time with streaming or batch processing
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => recording.setMode('streaming')}
            disabled={recording.isRecording}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
              ${recording.mode === 'streaming'
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600'
              }
              ${recording.isRecording ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <Zap className="h-4 w-4" />
            <span>Streaming</span>
          </button>
          <button
            onClick={() => recording.setMode('batch')}
            disabled={recording.isRecording}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
              ${recording.mode === 'batch'
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600'
              }
              ${recording.isRecording ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <Archive className="h-4 w-4" />
            <span>Batch</span>
          </button>
        </div>
      </div>

      {/* Mode Description */}
      <div className="mb-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3">
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {recording.mode === 'streaming' ? (
            <>
              <strong>Streaming Mode:</strong> Audio is sent in real-time chunks and processed immediately.
              Transcription starts while you're still speaking.
            </>
          ) : (
            <>
              <strong>Batch Mode:</strong> Audio is accumulated and sent as a complete file when you stop recording.
              Transcription begins after recording ends.
            </>
          )}
        </p>
      </div>

      {/* Main Controls - Single START button */}
      <SimplifiedControls recording={recording} />

      {/* Status Display - Shows setup progress */}
      <StatusDisplay recording={recording} />

      {/* Audio Visualizer - Shows waveform when recording */}
      <AudioVisualizer 
        isRecording={recording.isRecording}
        analyser={recording.analyser}
      />

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
          📝 How it Works
        </h3>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• <strong>Choose your mode:</strong> Streaming for real-time or Batch for complete file processing</li>
          <li>• <strong>One-click recording:</strong> Single button handles complete setup automatically</li>
          <li>• <strong>Sequential process:</strong> Mic access → WebSocket connection → Audio session → Recording</li>
          <li>• <strong>Mode-based processing:</strong>
            {recording.mode === 'streaming'
              ? 'Real-time chunks sent as you speak'
              : 'Complete audio sent after you stop'
            }
          </li>
          <li>• <strong>Wyoming protocol:</strong> Structured communication ensures reliable data transmission</li>
          <li>• <strong>High quality audio:</strong> 16kHz mono with noise suppression and echo cancellation</li>
          <li>• <strong>View results:</strong> Check Conversations page for transcribed content and memories</li>
        </ul>
      </div>

      {/* Debug Information Panel */}
      <SimpleDebugPanel recording={recording} />
    </div>
  )
}