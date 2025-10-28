'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { useState, useEffect } from 'react'
import { z } from 'zod'
import MdEditor from 'react-markdown-editor-lite'
import ReactMarkdown from 'react-markdown'
import 'react-markdown-editor-lite/lib/index.css'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { createNewsArticle, updateNewsArticle } from '@/lib/actions/news.actions'
import { INewsArticle } from '@/lib/db/models/news.model'
import { NewsArticleInputSchema, NewsArticleUpdateSchema } from '@/lib/validator'
import { Checkbox } from '@/components/ui/checkbox'
import { toSlug } from '@/lib/utils'

const newsArticleDefaultValues =
  process.env.NODE_ENV === 'development'
    ? {
        title: 'Sample News Article',
        slug: 'sample-news-article',
        excerpt: 'This is a sample excerpt for testing.',
        content: 'Sample Content',
        tags: ['news', 'tech'],
        metaTitle: 'Sample News Article',
        metaDescription: 'A sample news article for testing.',
        image: 'https://mark-elasfar.web.app/assets/img/default-article.jpg',
        isPublished: false,
        isFeatured: false,
        authorId: '',
      }
    : {
        title: '',
        slug: '',
        excerpt: '',
        content: '',
        tags: [],
        metaTitle: '',
        metaDescription: '',
        image: '',
        isPublished: false,
        isFeatured: false,
        authorId: '',
      }

export default function NewsArticleForm({
  type,
  article,
  articleId,
}: {
  type: 'Create' | 'Update'
  article?: INewsArticle
  articleId?: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [authors, setAuthors] = useState<{ _id: string; name: string }[]>([])

  useEffect(() => {
    async function fetchAuthors() {
      try {
        const response = await fetch('https://mark-elasfar.web.app/api/authors')
        if (!response.ok) {
          throw new Error('Failed to fetch authors')
        }
        const data = await response.json()
        setAuthors(data)
      } catch (error) {
        toast({
          variant: 'destructive',
          description: 'Failed to load authors',
        })
      }
    }
    fetchAuthors()
  }, [toast])

  const form = useForm<z.infer<typeof NewsArticleInputSchema>>({
    resolver:
      type === 'Update'
        ? zodResolver(NewsArticleUpdateSchema)
        : zodResolver(NewsArticleInputSchema),
    defaultValues:
      article && type === 'Update' ? article : newsArticleDefaultValues,
  })

  async function onSubmit(values: z.infer<typeof NewsArticleInputSchema>) {
    try {
      const result = type === 'Create'
        ? await createNewsArticle(values)
        : await updateNewsArticle({ ...values, _id: articleId! })
      
      if (!result.success) {
        toast({
          variant: 'destructive',
          description: result.message,
        })
      } else {
        toast({
          description: result.message,
        })
        router.push(`/admin/news`)
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        description: 'Failed to publish article',
      })
    }
  }

  return (
    <Form {...form}>
      <form
        method="post"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-8 p-6"
      >
        <div className="flex flex-col gap-5 md:flex-row">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Enter article title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      placeholder="Enter slug"
                      className="pl-8"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue('slug', toSlug(form.getValues('title')))
                      }}
                      className="absolute right-2 top-2.5 text-sm text-blue-500"
                    >
                      Generate
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-col gap-5 md:flex-row">
          <FormField
            control={form.control}
            name="excerpt"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Excerpt</FormLabel>
                <FormControl>
                  <Input placeholder="Enter article excerpt" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="authorId"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Author</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an author" />
                    </SelectTrigger>
                    <SelectContent>
                      {authors.map((author) => (
                        <SelectItem key={author._id} value={author._id}>
                          {author.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-col gap-5 md:flex-row">
          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Tags (comma-separated)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter tags, e.g., news,tech,ai"
                    value={field.value.join(',')}
                    onChange={(e) =>
                      form.setValue('tags', e.target.value.split(',').map((t) => t.trim()))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Image URL</FormLabel>
                <FormControl>
                  <Input placeholder="Enter image URL" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-col gap-5 md:flex-row">
          <FormField
            control={form.control}
            name="metaTitle"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Meta Title (SEO)</FormLabel>
                <FormControl>
                  <Input placeholder="Enter meta title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="metaDescription"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Meta Description (SEO)</FormLabel>
                <FormControl>
                  <Input placeholder="Enter meta description" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-col gap-5">
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Content</FormLabel>
                <FormControl>
                  <MdEditor
                    value={field.value}
                    style={{ height: '500px' }}
                    renderHTML={(text) => <ReactMarkdown>{text}</ReactMarkdown>}
                    onChange={({ text }) => form.setValue('content', text)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-col gap-5">
          <FormField
            control={form.control}
            name="isPublished"
            render={({ field }) => (
              <FormItem className="space-x-2 items-center">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel>Is Published?</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isFeatured"
            render={({ field }) => (
              <FormItem className="space-x-2 items-center">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel>Is Featured?</FormLabel>
              </FormItem>
            )}
          />
        </div>
        <div>
          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting}
            className="w-full"
          >
            {form.formState.isSubmitting ? 'Publishing...' : `${type} Article`}
          </Button>
        </div>
      </form>
    </Form>
  )
}