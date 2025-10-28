'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Author {
  _id: string
  userId: string
  name: string
  bio: string
  profileImageUrl: string
  socialLinks: Record<string, string>
}

export default function AuthorsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [authors, setAuthors] = useState<Author[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAuthors() {
      try {
        const response = await fetch('https://mark-elasfar.web.app/api/authors')
        if (!response.ok) {
          throw new Error('Failed to fetch authors')
        }
        const data = await response.json()
        setAuthors(data)
        setLoading(false)
      } catch (error) {
        toast({
          variant: 'destructive',
          description: 'Failed to load authors',
        })
        setLoading(false)
      }
    }
    fetchAuthors()
  }, [toast])

  const handleDelete = async (authorId: string) => {
    try {
      const response = await fetch(`https://mark-elasfar.web.app/api/authors/${authorId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete author')
      }
      setAuthors(authors.filter((author) => author._id !== authorId))
      toast({
        description: 'Author deleted successfully',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        description: 'Failed to delete author',
      })
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Manage Authors</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Bio</TableHead>
              <TableHead>Profile Image</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {authors.map((author) => (
              <TableRow key={author._id}>
                <TableCell>{author.name}</TableCell>
                <TableCell>{author.bio}</TableCell>
                <TableCell>
                  <img src={author.profileImageUrl} alt={author.name} className="w-12 h-12 object-cover" />
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    className="mr-2"
                    onClick={() => router.push(`/admin/authors/${author._id}`)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(author._id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Button
        className="mt-4"
        onClick={() => router.push('/admin/authors/create')}
      >
        Add Author
      </Button>
    </div>
  )
}