'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

export default function PointsNotification() {
  const { toast } = useToast()
  const [points, setPoints] = useState<number | null>(null)

  useEffect(() => {
    // Simulated API call to check for new points (replace with actual API)
    const checkNewPoints = async () => {
      try {
        const response = await fetch('/api/points/recent')
        const data = await response.json()
        if (data.success && data.data.points > 0) {
          setPoints(data.data.points)
        }
      } catch (error) {
        console.error('Error checking points:', error)
      }
    }
    checkNewPoints()
  }, [])

  useEffect(() => {
    if (points) {
      toast({
        title: 'Points Earned!',
        description: `You have earned ${points} points! Check your balance.`,
      })
    }
  }, [points, toast])

  if (!points) return null

  return (
    <Card className="fixed bottom-4 right-4 z-50">
      <CardContent className="p-4">
        <p className="font-bold">New Points: +{points}</p>
        <Button variant="link" onClick={() => setPoints(null)}>
          Dismiss
        </Button>
      </CardContent>
    </Card>
  )
}