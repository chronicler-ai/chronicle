import { useEffect, useRef } from 'react'
import { Mic, Square } from 'lucide-react'
import { useSimpleAudioRecording } from '../../hooks/useSimpleAudioRecording'

export default function HeaderRecordButton() {
  const recording = useSimpleAudioRecording()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()

  // Waveform visualization
  useEffect(() => {
    if (!recording.isRecording || !recording.analyser || !canvasRef.current) {
      // Clear animation when not recording
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      // Clear canvas
      if (canvasRef.current) {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
      }
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const analyser = recording.analyser
    analyser.fftSize = 32 // Smaller for compact visualization
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw)

      analyser.getByteFrequencyData(dataArray)

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const barWidth = canvas.width / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8

        // Gradient color based on intensity
        const intensity = dataArray[i] / 255
        const r = Math.floor(59 + intensity * 40)
        const g = Math.floor(130 + intensity * 70)
        const b = Math.floor(246 - intensity * 50)

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight)

        x += barWidth
      }
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [recording.isRecording, recording.analyser])

  const handleClick = async () => {
    if (recording.isRecording) {
      recording.stopRecording()
    } else {
      await recording.startRecording()
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`
        relative flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-all duration-200
        ${recording.isRecording
          ? 'bg-error-500 hover:bg-error-600 text-white shadow-md'
          : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
        }
      `}
      title={recording.isRecording ? 'Stop Recording' : 'Start Recording'}
    >
      {/* Icon */}
      {recording.isRecording ? (
        <Square className="h-4 w-4 fill-current" />
      ) : (
        <Mic className="h-4 w-4" />
      )}

      {/* Waveform Canvas (only visible when recording) */}
      {recording.isRecording && (
        <canvas
          ref={canvasRef}
          width={48}
          height={20}
          className="rounded"
        />
      )}

      {/* Status Text */}
      <span className="text-sm hidden sm:inline">
        {recording.isRecording ? 'Recording' : 'Record'}
      </span>

      {/* Recording pulse indicator */}
      {recording.isRecording && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-error-500"></span>
        </span>
      )}
    </button>
  )
}
