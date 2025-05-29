import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import type { ReactNode } from 'react'
import { headers } from 'next/headers'

export default async function SellerLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { locale: string }
}) {
  try {
    // Execute all asynchronous operations concurrently
    const [session, headersList] = await Promise.all([
      auth(),
      headers(),
    ])

    // Parse the pathname
    const pathname = headersList.get('x-invoke-path') || ''
    const pathSegments = pathname.split('/')

    const isRegistrationPage = pathSegments.includes('registration')
    const isErrorPage = pathSegments.includes('error')

    // Check authentication and redirect if necessary
    if (!session?.user && !isRegistrationPage && !isErrorPage) {
      return redirect(`/${params.locale}/seller/registration`)
    }

    // Render the layout with content
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    )
  } catch (error) {
    console.error('Seller Layout Error:', error)
    return redirect(`/${params.locale}/error`)
  }
}