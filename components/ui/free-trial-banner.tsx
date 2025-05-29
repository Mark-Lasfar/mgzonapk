'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

export default function FreeTrialBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const hasSeenBanner = localStorage.getItem('hasSeenTrialBanner')
    if (!hasSeenBanner) {
      setIsVisible(true)
      localStorage.setItem('hasSeenTrialBanner', 'true')
    }
  }, [])

  const handleTryNow = () => {
    setIsVisible(false)
    router.push('/sign-in?redirect=/seller/register')
  }

  if (!isVisible) return null

  return (
    <Card className="fixed bottom-4 right-4 max-w-md z-50">
      <CardContent className="p-4">
        <h2 className="text-xl font-bold">Try Selling for Free!</h2>
        <p>Start with a 5-day free trial, then just $1/month for the first 3 months. Join our platform now!</p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setIsVisible(false)}>Dismiss</Button>
        <Button onClick={handleTryNow}>Try Now</Button>
      </CardFooter>
    </Card>
  )
}