import { useState, useEffect, useRef } from 'react'
import { Calendar, RefreshCw, AlertCircle, ZoomIn, ZoomOut } from 'lucide-react'
import Gantt from 'frappe-gantt'
import { memoriesApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

interface TimeRange {
  start: string
  end: string
  name?: string
}

interface MemoryWithTimeRange {
  id: string
  content: string
  created_at: string
  metadata?: {
    name?: string
    timeRanges?: TimeRange[]
    isPerson?: boolean
    isEvent?: boolean
    isPlace?: boolean
  }
}

interface GanttTask {
  id: string
  name: string
  start: string
  end: string
  progress: number
  custom_class?: string
}

export default function FrappeGanttTimeline() {
  const [memories, setMemories] = useState<MemoryWithTimeRange[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useDemoData, setUseDemoData] = useState(false)
  const [currentViewMode, setCurrentViewMode] = useState<string>('Week')
  const [zoomScale, setZoomScale] = useState(1) // CSS transform scale: 0.5 = 50%, 1 = 100%, 2 = 200%
  const ganttContainerRef = useRef<HTMLDivElement>(null)
  const ganttInstance = useRef<any>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)
  const { user } = useAuth()

  // HTML escape function to prevent XSS attacks
  const escapeHtml = (unsafe: string): string => {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  // Demo data for testing the Timeline visualization - spans multiple years
  const getDemoMemories = (): MemoryWithTimeRange[] => {
    return [
      {
        id: 'demo-graduation',
        content: 'College graduation ceremony and celebration dinner with family.',
        created_at: '2024-05-20T14:00:00',
        metadata: {
          name: 'College Graduation',
          isEvent: true,
          timeRanges: [
            {
              name: 'Graduation Ceremony',
              start: '2024-05-20T14:00:00',
              end: '2024-05-20T17:00:00'
            },
            {
              name: 'Celebration Dinner',
              start: '2024-05-20T19:00:00',
              end: '2024-05-20T22:00:00'
            }
          ]
        }
      },
      {
        id: 'demo-wedding',
        content: "Sarah and Tom's wedding was a beautiful celebration. The ceremony started at 3 PM, followed by a reception that lasted until midnight.",
        created_at: '2025-06-15T15:00:00',
        metadata: {
          name: "Sarah & Tom's Wedding",
          isEvent: true,
          timeRanges: [
            {
              name: 'Wedding Ceremony',
              start: '2025-06-15T15:00:00',
              end: '2025-06-15T16:30:00'
            },
            {
              name: 'Reception',
              start: '2025-06-15T18:00:00',
              end: '2025-06-16T00:00:00'
            }
          ]
        }
      },
      {
        id: 'demo-conference',
        content: 'Tech conference with keynote presentations and networking sessions throughout the day.',
        created_at: '2025-09-20T09:00:00',
        metadata: {
          name: 'Tech Conference 2025',
          isEvent: true,
          timeRanges: [
            {
              name: 'Morning Keynote',
              start: '2025-09-20T09:00:00',
              end: '2025-09-20T11:00:00'
            },
            {
              name: 'Workshops',
              start: '2025-09-20T13:00:00',
              end: '2025-09-20T17:00:00'
            }
          ]
        }
      },
      {
        id: 'demo-vacation',
        content: 'Week-long vacation at the beach house with family.',
        created_at: '2026-07-01T14:00:00',
        metadata: {
          name: 'Summer Vacation 2026',
          isPlace: true,
          timeRanges: [
            {
              name: 'Beach House Stay',
              start: '2026-07-01T14:00:00',
              end: '2026-07-07T12:00:00'
            }
          ]
        }
      },
      {
        id: 'demo-reunion',
        content: 'Family reunion at the old homestead with extended family gathering.',
        created_at: '2026-12-25T12:00:00',
        metadata: {
          name: 'Family Reunion',
          isEvent: true,
          timeRanges: [
            {
              name: 'Christmas Gathering',
              start: '2026-12-25T12:00:00',
              end: '2026-12-25T20:00:00'
            }
          ]
        }
      }
    ]
  }

  const loadMemories = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      setError(null)
      const response = await memoriesApi.getAll(user.id)

      // Extract memories from response
      const memoriesData = response.data.memories || response.data || []

      // Filter memories that have timeRanges
      const memoriesWithTime = memoriesData.filter((m: MemoryWithTimeRange) =>
        m.metadata?.timeRanges && m.metadata.timeRanges.length > 0
      )

      console.log('📅 Timeline: Total memories:', memoriesData.length)
      console.log('📅 Timeline: Memories with timeRanges:', memoriesWithTime.length)
      if (memoriesWithTime.length > 0) {
        console.log('📅 Timeline: First memory with timeRange:', memoriesWithTime[0])
      }

      setMemories(memoriesWithTime)
    } catch (err: any) {
      console.error('❌ Timeline loading error:', err)
      setError(err.message || 'Failed to load timeline data')
    } finally {
      setLoading(false)
    }
  }

  const convertMemoriesToGanttTasks = (memories: MemoryWithTimeRange[]): GanttTask[] => {
    const tasks: GanttTask[] = []

    memories.forEach((memory) => {
      const timeRanges = memory.metadata?.timeRanges || []

      timeRanges.forEach((range, index) => {
        // Get the task name from the range name, memory metadata name, or content preview
        const taskName = range.name ||
                        memory.metadata?.name ||
                        memory.content.substring(0, 50) + (memory.content.length > 50 ? '...' : '')

        // Determine custom class based on memory type
        let customClass = 'default'
        if (memory.metadata?.isEvent) customClass = 'event'
        else if (memory.metadata?.isPerson) customClass = 'person'
        else if (memory.metadata?.isPlace) customClass = 'place'

        tasks.push({
          id: `${memory.id}-${index}`,
          name: taskName,
          start: range.start,
          end: range.end,
          progress: 100, // All memories are completed events
          custom_class: customClass
        })
      })
    })

    return tasks
  }

  useEffect(() => {
    if (!useDemoData) {
      loadMemories()
    } else {
      setMemories(getDemoMemories())
    }
  }, [user?.id, useDemoData])

  useEffect(() => {
    const displayMemories = useDemoData ? getDemoMemories() : memories

    if (!ganttContainerRef.current || displayMemories.length === 0) {
      return
    }

    // Convert memories to Gantt tasks
    const tasks = convertMemoriesToGanttTasks(displayMemories)

    if (tasks.length === 0) {
      return
    }

    console.log('📊 Creating Gantt chart with tasks:', tasks)

    try {
      // Clear existing Gantt instance
      if (ganttInstance.current) {
        ganttContainerRef.current.innerHTML = ''
      }

      // Create new Gantt instance with type assertion for custom_popup_html
      ganttInstance.current = new Gantt(ganttContainerRef.current, tasks, {
        view_mode: currentViewMode,
        bar_height: 30,
        bar_corner_radius: 3,
        arrow_curve: 5,
        padding: 18,
        date_format: 'YYYY-MM-DD',
        language: 'en',
        custom_popup_html: (task: any) => {
          // Extract memoryId from task.id (format: "memoryId-index")
          // Use lastIndexOf to handle memory IDs that contain dashes (e.g., UUIDs)
          const lastDashIndex = task.id.lastIndexOf('-')
          const memoryId = lastDashIndex !== -1 ? task.id.slice(0, lastDashIndex) : task.id

          // Find memory using exact equality instead of prefix matching
          const memory = displayMemories.find(m => m.id === memoryId)
          const startDate = new Date(task._start)
          const endDate = new Date(task._end)
          const formatOptions: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }
          return `
            <div class="popup-wrapper" style="background: white; padding: 12px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); min-width: 250px;">
              <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${escapeHtml(task.name)}</h3>
              <p style="margin: 4px 0; font-size: 12px; color: #666;">
                <strong>Start:</strong> ${startDate.toLocaleDateString('en-US', formatOptions)}
              </p>
              <p style="margin: 4px 0; font-size: 12px; color: #666;">
                <strong>End:</strong> ${endDate.toLocaleDateString('en-US', formatOptions)}
              </p>
              ${memory?.content ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #333; border-top: 1px solid #eee; padding-top: 8px;">${escapeHtml(memory.content)}</p>` : ''}
            </div>
          `
        }
      } as any)

      console.log('✅ Gantt chart created successfully')

      // Add year labels to the timeline header
      setTimeout(() => {
        try {
          const container = ganttContainerRef.current?.querySelector('.gantt-container')
          if (!container) return

          // Find all unique years from tasks
          const years = new Set<number>()
          tasks.forEach(task => {
            const startYear = new Date(task.start).getFullYear()
            const endYear = new Date(task.end).getFullYear()
            years.add(startYear)
            if (startYear !== endYear) years.add(endYear)
          })

          const sortedYears = Array.from(years).sort()
          if (sortedYears.length <= 1) return // No need for year labels if single year

          // Get the upper header div element (HTML, not SVG)
          const upperHeader = container.querySelector('.upper-header')
          if (!upperHeader) return

          // Add year labels as HTML divs in a simple row at the top
          sortedYears.forEach((year, index) => {
            const yearLabel = document.createElement('div')
            yearLabel.className = 'year-label'
            yearLabel.textContent = String(year)
            yearLabel.style.position = 'absolute'
            yearLabel.style.left = `${20 + (index * 70)}px` // Simple horizontal spacing
            yearLabel.style.top = '2px'
            yearLabel.style.fontSize = '18px'
            yearLabel.style.fontWeight = '700'
            yearLabel.style.color = '#2563eb' // Blue color
            yearLabel.style.padding = '2px 8px'
            yearLabel.style.backgroundColor = '#eff6ff'
            yearLabel.style.borderRadius = '4px'
            yearLabel.style.zIndex = '10'

            upperHeader.appendChild(yearLabel)
          })

        } catch (error) {
          console.warn('Failed to add year labels:', error)
        }
      }, 150) // Small delay to ensure DOM is fully rendered
    } catch (err) {
      console.error('❌ Error creating Gantt chart:', err)
      setError('Failed to create timeline visualization')
    }

    return () => {
      if (ganttInstance.current && ganttContainerRef.current) {
        ganttContainerRef.current.innerHTML = ''
        ganttInstance.current = null
      }
    }
  }, [memories, useDemoData, currentViewMode])

  // Drag-to-scroll functionality
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleMouseDown = (e: MouseEvent) => {
      // Only start drag if not clicking on interactive elements
      const target = e.target as HTMLElement
      if (target.closest('.bar-wrapper') || target.closest('button')) {
        return
      }

      isDragging.current = true
      startX.current = e.pageX
      scrollLeft.current = container.scrollLeft
      container.style.cursor = 'grabbing'
      e.preventDefault()
    }

    const handleMouseLeave = () => {
      isDragging.current = false
      container.style.cursor = 'grab'
    }

    const handleMouseUp = () => {
      isDragging.current = false
      container.style.cursor = 'grab'
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      e.preventDefault()
      const x = e.pageX
      const walk = (x - startX.current) * 1.5 // Scroll speed multiplier
      container.scrollLeft = scrollLeft.current - walk
    }

    // Add event listeners with capture phase for better control
    container.addEventListener('mousedown', handleMouseDown, true)
    container.addEventListener('mouseleave', handleMouseLeave)
    container.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('mousemove', handleMouseMove)

    return () => {
      container.removeEventListener('mousedown', handleMouseDown, true)
      container.removeEventListener('mouseleave', handleMouseLeave)
      container.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  // Mousewheel zoom functionality
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const viewModeOrder = ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month']

    const handleWheel = (e: WheelEvent) => {
      // Only zoom when Ctrl or Cmd is pressed
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopPropagation()

        const currentIndex = viewModeOrder.indexOf(currentViewMode)

        if (e.deltaY < 0) {
          // Zoom in (scroll up = more detailed view)
          if (currentIndex > 0) {
            setCurrentViewMode(viewModeOrder[currentIndex - 1])
          }
        } else if (e.deltaY > 0) {
          // Zoom out (scroll down = less detailed view)
          if (currentIndex < viewModeOrder.length - 1) {
            setCurrentViewMode(viewModeOrder[currentIndex + 1])
          }
        }
      }
      // If no modifier keys, let the browser handle normal horizontal scrolling
    }

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [currentViewMode])

  const viewModes = [
    { value: 'Quarter Day', label: 'Quarter Day' },
    { value: 'Half Day', label: 'Half Day' },
    { value: 'Day', label: 'Day' },
    { value: 'Week', label: 'Week' },
    { value: 'Month', label: 'Month' }
  ]

  const changeViewMode = (mode: string) => {
    setCurrentViewMode(mode)
  }

  const zoomIn = () => {
    setZoomScale(prev => {
      const newScale = Math.min(prev + 0.25, 3) // Max 300%
      // Store scroll position ratio before zoom
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current
        const scrollRatio = (container.scrollLeft + container.clientWidth / 2) / container.scrollWidth

        // After state update, restore relative scroll position
        setTimeout(() => {
          if (scrollContainerRef.current) {
            const newScrollLeft = scrollRatio * scrollContainerRef.current.scrollWidth - container.clientWidth / 2
            scrollContainerRef.current.scrollLeft = newScrollLeft
          }
        }, 0)
      }
      return newScale
    })
  }

  const zoomOut = () => {
    setZoomScale(prev => {
      const newScale = Math.max(prev - 0.25, 0.5) // Min 50%
      // Store scroll position ratio before zoom
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current
        const scrollRatio = (container.scrollLeft + container.clientWidth / 2) / container.scrollWidth

        // After state update, restore relative scroll position
        setTimeout(() => {
          if (scrollContainerRef.current) {
            const newScrollLeft = scrollRatio * scrollContainerRef.current.scrollWidth - container.clientWidth / 2
            scrollContainerRef.current.scrollLeft = newScrollLeft
          }
        }, 0)
      }
      return newScale
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Timeline</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3 text-gray-500 dark:text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading timeline data...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Timeline</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3 text-red-500">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      </div>
    )
  }

  if (memories.length === 0 && !useDemoData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Timeline</h1>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setUseDemoData(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Calendar className="h-4 w-4" />
              <span>Show Demo</span>
            </button>
            <button
              onClick={loadMemories}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Calendar className="h-16 w-16 text-gray-300 dark:text-gray-600" />
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Timeline Events</h3>
            <p className="text-gray-500 dark:text-gray-400">
              No memories with time information found. Create memories with dates and times to see them on the timeline.
            </p>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Click "Show Demo" to see how the timeline works with sample data.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Timeline (Frappe Gantt) {useDemoData && <span className="text-sm font-normal text-green-600 dark:text-green-400">(Demo Mode)</span>}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {useDemoData ? getDemoMemories().length : memories.length} {(useDemoData ? getDemoMemories().length : memories.length) === 1 ? 'event' : 'events'} with time information
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Demo mode toggle */}
          {useDemoData ? (
            <button
              onClick={() => setUseDemoData(false)}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Calendar className="h-4 w-4" />
              <span>Show Real Data</span>
            </button>
          ) : (
            <button
              onClick={() => setUseDemoData(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Calendar className="h-4 w-4" />
              <span>Show Demo</span>
            </button>
          )}
          {/* Zoom controls */}
          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={zoomIn}
              disabled={zoomScale >= 3}
              className="px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="px-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-medium min-w-[3.5rem] text-center">
              {Math.round(zoomScale * 100)}%
            </div>
            <button
              onClick={zoomOut}
              disabled={zoomScale <= 0.5}
              className="px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
          </div>
          {/* View mode selector */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">View:</label>
            <select
              onChange={(e) => changeViewMode(e.target.value)}
              value={currentViewMode}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {viewModes.map(mode => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={loadMemories}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Gantt Chart Container */}
      <div className="space-y-4">
        {/* Scrollable Gantt Chart */}
        <div
          ref={scrollContainerRef}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 overflow-auto"
          style={{
            cursor: 'grab',
            minHeight: `${Math.min(200 * zoomScale, 500)}px`,
            maxHeight: '600px'
          }}
        >
          <div
            ref={ganttContainerRef}
            style={{
              transform: `scale(${zoomScale})`,
              transformOrigin: 'top left',
              transition: 'transform 0.2s ease-out'
            }}
          />
        </div>

        {/* Instructions - Fixed, not scrolling */}
        <div className="flex items-center justify-center space-x-6 text-xs text-gray-500 dark:text-gray-400">
          <span>💡 Drag to scroll horizontally</span>
          <span>🔍 Hold Ctrl/Cmd + Scroll to zoom in/out</span>
        </div>

        {/* Legend - Fixed, not scrolling */}
        <div className="flex items-center justify-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">Event</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">Person</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">Place</span>
          </div>
        </div>
      </div>

      {/* Add custom styles for Gantt chart colors */}
      <style>{`
        .gantt .bar-wrapper .bar.event {
          fill: #3b82f6;
        }
        .gantt .bar-wrapper .bar.person {
          fill: #10b981;
        }
        .gantt .bar-wrapper .bar.place {
          fill: #f97316;
        }
        .gantt .bar-wrapper .bar.default {
          fill: #6b7280;
        }
        /* Dark mode adjustments */
        .dark .gantt {
          background: #1f2937;
        }
        .dark .gantt .grid-row {
          fill: transparent;
        }
        .dark .gantt .grid-row:nth-child(even) {
          fill: rgba(255, 255, 255, 0.02);
        }
        .dark .gantt .row-line {
          stroke: #374151;
        }
        .dark .gantt .tick {
          stroke: #374151;
        }
        .dark .gantt .today-highlight {
          fill: rgba(59, 130, 246, 0.1);
        }
        .dark .gantt text {
          fill: #d1d5db;
        }
      `}</style>
    </div>
  )
}
