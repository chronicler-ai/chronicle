import { useState } from 'react'
import Conversations from './Conversations'
import ConversationsTimeline from './ConversationsTimeline'

export default function ConversationsRouter() {
  const [activeTab, setActiveTab] = useState<'classic' | 'timeline'>('classic')

  return (
    <div>
      {/* Content */}
      {activeTab === 'classic' ? (
        <Conversations activeTab={activeTab} setActiveTab={setActiveTab} />
      ) : (
        <ConversationsTimeline activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
    </div>
  )
}
