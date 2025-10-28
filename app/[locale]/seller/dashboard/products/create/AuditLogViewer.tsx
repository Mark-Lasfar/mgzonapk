'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { getCurrentDateTime } from '@/lib/utils/date'

// Types
interface AuditLog {
  timestamp: string
  user: string
  action: string
  details: any
}

// Constants
const INTERVAL = 5000 // 5 seconds for auto-refresh

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const { data: session } = useSession()

  // Fetch logs function
  const fetchLogs = async () => {
    try {
      const currentDateTime = getCurrentDateTime().slice(0, 19).replace('T', ' ')
      const currentUser = session?.user?.name || 'unknown'
      
      const response = await fetch('/api/audit-logs', {
        headers: {
          'X-User': currentUser,
          'X-Timestamp': currentDateTime
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch logs')
      }

      const data = await response.json()
      setLogs(data)
      setLastUpdate(currentDateTime)
      setLoading(false)

    } catch (error) {
      console.error('Error fetching logs:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch audit logs'
      })
    }
  }

  // Auto-refresh setup
  useEffect(() => {
    fetchLogs() // Initial fetch
    
    const interval = setInterval(() => {
      fetchLogs()
    }, INTERVAL)

    return () => clearInterval(interval)
  }, [])

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  // Filter logs by current user
  const filterByCurrentUser = () => {
    const currentUser = session?.user?.name
    return logs.filter(log => log.user === currentUser)
  }

  const { toast } = useToast()

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Audit Logs</h2>
        <div className="text-sm text-gray-500">
          Last updated: {formatTimestamp(lastUpdate)}
        </div>
      </div>

      <div className="flex gap-2">
        <Button 
          onClick={fetchLogs}
          disabled={loading}
        >
          Refresh
        </Button>
        <Button 
          variant="outline"
          onClick={() => setLogs(filterByCurrentUser())}
        >
          Show My Logs
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-4">Loading logs...</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{log.action}</p>
                    <p className="text-sm text-gray-500">By {log.user}</p>
                  </div>
                  <p className="text-sm text-gray-500">
                    {formatTimestamp(log.timestamp)}
                  </p>
                </div>
                {log.details && (
                  <pre className="mt-2 p-2 bg-gray-50 rounded text-sm overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}