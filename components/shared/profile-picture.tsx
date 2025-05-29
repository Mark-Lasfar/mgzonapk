'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function ProfilePicture() {
  const [image, setImage] = useState<string | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="profile-picture">
      {image ? (
        <img src={image} alt="Profile" className="w-32 h-32 rounded-full" />
      ) : (
        <div className="w-32 h-32 bg-gray-300 rounded-full flex items-center justify-center">
          No Image
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="mt-2"
      />
      <Button variant="outline" className="mt-2">
        Upload
      </Button>
    </div>
  )
}