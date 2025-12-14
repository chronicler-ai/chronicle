import { useState } from 'react'
import { Calendar } from 'lucide-react'
import FrappeGanttTimeline from './FrappeGanttTimeline'
import MyceliaTimeline from './MyceliaTimeline'

type TimelineImplementation = 'frappe' | 'mycelia'

export default function TimelineRouter() {
  const [activeImplementation, setActiveImplementation] = useState<TimelineImplementation>('frappe')

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="w-8 h-8" />
            Timeline
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Visualize your memories on an interactive timeline
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8" aria-label="Timeline implementations">
          <button
            onClick={() => setActiveImplementation('frappe')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeImplementation === 'frappe'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            Frappe Gantt
            <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              Default
            </span>
          </button>
          <button
            onClick={() => setActiveImplementation('mycelia')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeImplementation === 'mycelia'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            Mycelia D3
            <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded">
              New
            </span>
          </button>
        </nav>
      </div>

      {/* Timeline Implementation */}
      <div>
        {activeImplementation === 'frappe' && <FrappeGanttTimeline />}
        {activeImplementation === 'mycelia' && <MyceliaTimeline />}
      </div>
    </div>
  )
}
