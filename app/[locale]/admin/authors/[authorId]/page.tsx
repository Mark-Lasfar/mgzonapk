'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { useState, useEffect } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

const AuthorSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  name: z.string().min(3, 'Name must be at least 3 characters'),
  bio: z.string().min(10, 'Bio must be at least 10 characters'),
  profileImageUrl: z.string().url('Invalid URL').optional().default('https://mark-elasfar.web.app/assets/img/default-avatar.png'),
  socialLinks: z.record(z.string(), z.string().url('Invalid URL').optional()).optional().default({}),
})

type AuthorFormData = z.infer<typeof AuthorSchema>

export default function AuthorForm({
  type,
  author,
  authorId,
}: {
  type: 'Create' | 'Update'
  author?: AuthorFormData
  authorId?: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [socialLinks, setSocialLinks] = useState<{ platform: string; url: string }[]>(
    author?.socialLinks
      ? Object.entries(author.socialLinks).map(([platform, url]) => ({
          platform,
          url: url || '',
        }))
      : []
  )

  const form = useForm<AuthorFormData>({
    resolver: zodResolver(AuthorSchema),
    defaultValues: author || {
      userId: '',
      name: '',
      bio: '',
      profileImageUrl: '',
      socialLinks: {},
    },
  })

  async function onSubmit(values: AuthorFormData) {
    try {
      // Convert socialLinks array back to object
      const socialLinksObj = socialLinks.reduce((acc, { platform, url }) => {
        if (platform && url) acc[platform] = url
        return acc
      }, {} as Record<string, string>)

      const response = await fetch(
        type === 'Create'
          ? 'https://mark-elasfar.web.app/api/authors'
          : `https://mark-elasfar.web.app/api/authors/${authorId}`,
        {
          method: type === 'Create' ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...values, socialLinks: socialLinksObj }),
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to ${type.toLowerCase()} author`)
      }

      toast({
        description: `Author ${type.toLowerCase()}d successfully`,
      })
      router.push('/admin/authors')
    } catch (error) {
      toast({
        variant: 'destructive',
        description: `Failed to ${type.toLowerCase()} author`,
      })
    }
  }

  const addSocialLink = () => {
    setSocialLinks([...socialLinks, { platform: '', url: '' }])
  }

  const updateSocialLink = (index: number, field: 'platform' | 'url', value: string) => {
    const updatedLinks = [...socialLinks]
    updatedLinks[index][field] = value
    setSocialLinks(updatedLinks)
  }

  const removeSocialLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index))
  }

  useEffect(() => {
    if (type === 'Update' && authorId) {
      async function fetchAuthor() {
        try {
          const response = await fetch(`https://mark-elasfar.web.app/api/authors/${authorId}`)
          if (!response.ok) {
            throw new Error('Failed to fetch author')
          }
          const data: AuthorFormData = await response.json()
          form.reset(data)
          setSocialLinks(
            Object.entries(data.socialLinks || {}).map(([platform, url]) => ({
              platform,
              url: url || '',
            }))
          )
        } catch (error) {
          toast({
            variant: 'destructive',
            description: 'Failed to load author',
          })
        }
      }
      fetchAuthor()
    }
  }, [type, authorId, form, toast])

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">{type} Author</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="userId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>User ID</FormLabel>
                <FormControl>
                  <Input placeholder="Enter user ID" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter author name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Input placeholder="Enter author bio" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="profileImageUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profile Image URL</FormLabel>
                <FormControl>
                  <Input placeholder="Enter image URL" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div>
            <FormLabel>Social Links</FormLabel>
            {socialLinks.map((link, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <Input
                  placeholder="Platform (e.g., twitter)"
                  value={link.platform}
                  onChange={(e) => updateSocialLink(index, 'platform', e.target.value)}
                />
                <Input
                  placeholder="URL"
                  value={link.url}
                  onChange={(e) => updateSocialLink(index, 'url', e.target.value)}
                />
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => removeSocialLink(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addSocialLink} className="mt-2">
              Add Social Link
            </Button>
          </div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Submitting...' : `${type} Author`}
          </Button>
        </form>
      </Form>
    </div>
  )
}