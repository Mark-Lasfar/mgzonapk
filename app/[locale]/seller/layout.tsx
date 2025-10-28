// /home/mark/Music/my-nextjs-project-clean/app/[locale]/(root)/seller/layout.tsx
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import type { ReactNode } from 'react'
import LanguageSwitcher from '@/components/shared/header/language-switcher';
import ThemeSwitcher from '@/components/shared/header/theme-switcher';
import { headers } from 'next/headers'
import { Sellerchatbote } from '@/components/seller/Chatbote'
// import { Sellerchatbote } from '@/components/seller/Chatbote'
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

    // جهز الـ Switchers قبل الـ return
    const switchers = (
      <div className="flex items-center space-x-4">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>
    )

    // Render the layout
    return (
      <div className="min-h-screen bg-background">
        {/* ممكن تحط الهيدر هنا */}
        <header className="flex justify-end p-4">
          {switchers}
        </header>

        {/* محتوى الصفحة */}
        {children}

        {/* Chatbote */}
        <Sellerchatbote />
      </div>
    )
  } catch (error) {
    console.error('Seller Layout Error:', error)
    return redirect(`/${params.locale}/error`)
  }
}
