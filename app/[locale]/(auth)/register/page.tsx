'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useTranslations, useLocale } from 'next-intl'
import { sendNotification } from '@/lib/utils/notification'
import { supabase } from '@/lib/config/supabase'
import { v4 as uuidv4 } from 'uuid'

interface FormData {
  name: string
  email: string
  whatsapp?: string
  password: string
  confirmPassword: string
}

export default function RegisterPage() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    whatsapp: '',
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('Auth')
  const locale = useLocale()
  const isArabic = locale === 'ar'
  const direction = isArabic ? 'rtl' : 'ltr'

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString() // 6-digit code
  }

  const storeVerificationCode = async (userId: string, email: string, code: string) => {
    const expiresAt = new Date(Date.now() + process.env.VERIFICATION_CODE_EXPIRY!)
    const { error } = await supabase
      .from('verification_codes')
      .insert({
        user_id: userId,
        email,
        code,
        expires_at: expiresAt.toISOString(),
      })
    if (error) {
      console.error('Supabase error:', error)
      throw new Error(t('VerificationCodeFailed'))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password !== formData.confirmPassword) {
      toast({ description: t('PasswordsDoNotMatch'), variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          whatsapp: formData.whatsapp || undefined,
          password: formData.password,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        const verificationCode = generateVerificationCode()
        const channels = formData.whatsapp ? ['email', 'whatsapp'] : ['email']

        await storeVerificationCode(data.userId, formData.email, verificationCode)

        await sendNotification({
          userId: data.userId,
          type: 'verification',
          title: t('VerifyYourAccount'),
          message: `${t('VerificationCodeMessage')} ${verificationCode}`,
          channels,
          data: { verificationCode, email: formData.email, whatsapp: formData.whatsapp },
        })

        toast({ description: t('RegistrationSuccess') })
        router.push(`/verify-code?email=${encodeURIComponent(formData.email)}`)
      } else {
        toast({ description: data.error || t('RegistrationFailed'), variant: 'destructive' })
      }
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : t('Error'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-md mx-auto py-8" style={{ direction }}>
      <Card>
        <CardHeader>
          <CardTitle>{t('CreateAccount')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">{t('FullName')}</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">{t('Email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="whatsapp">{t('WhatsAppOptional')}</Label>
              <Input
                id="whatsapp"
                name="whatsapp"
                placeholder={t('WhatsAppPlaceholder')}
                value={formData.whatsapp}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <Label htmlFor="password">{t('Password')}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">{t('ConfirmPassword')}</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t('Registering') : t('Register')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}