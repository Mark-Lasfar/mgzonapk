import { EMAIL_CONFIG } from '@/lib/config/email'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendPointsNotification({
  userId,
  email,
  points,
  type,
  description,
}: {
  userId: string
  email: string
  points: number
  type: 'points.earned' | 'points.redeemed'
  description: string
}) {
  try {
    const subject = type === 'points.earned' 
      ? `You Earned ${points} Points!` 
      : `You Redeemed ${points} Points`
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>${subject}</h2>
        <p>Hello,</p>
        <p>${
          type === 'points.earned'
            ? `You have earned ${points} points for: ${description}`
            : `You have redeemed ${points} points for: ${description}`
        }</p>
        <p>Check your points balance in your account dashboard.</p>
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/account" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Dashboard</a>
        <p>Best regards,<br/>${EMAIL_CONFIG.FROM.NAME}</p>
      </div>
    `

    const { error } = await resend.emails.send({
      from: `${EMAIL_CONFIG.FROM.NAME} <${EMAIL_CONFIG.FROM.EMAIL}>`,
      to: email,
      subject,
      html,
    })

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`)
    }

    return { success: true }
  } catch (error) {
    console.error('Send points notification error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send points notification'
    }
  }
}