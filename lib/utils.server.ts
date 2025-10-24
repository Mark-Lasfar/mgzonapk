import qs from 'query-string'
import { supportedCurrencies } from './config'

interface PricingResult {
  currency: string
  commission: number
  suggestedMarkup: number
  finalPrice: number
  profit: number
}

export function escapeGraphQLString(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

export function toPlainObject<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export function formUrlQuery({
  params,
  key,
  value,
}: {
  params: string
  key: string
  value: string | null
}) {
  const currentUrl = qs.parse(params)
  currentUrl[key] = value
  return qs.stringifyUrl(
    {
      url: '/search',
      query: currentUrl,
    },
    { skipNull: true }
  )
}

export function calculatePricing(
  basePrice: number,
  listPrice: number,
  markup: number,
  discount: { type: string; value?: number } | undefined,
  currency: string
): PricingResult {
  if (!supportedCurrencies.includes(currency)) {
    throw new Error('Unsupported currency')
  }

  const commissionRate = 0.1
  const commission = basePrice * commissionRate
  const suggestedMarkup = markup || 30
  let finalPrice = listPrice || basePrice * (1 + suggestedMarkup / 100)

  if (discount?.type === 'percentage' && discount.value) {
    finalPrice *= 1 - discount.value / 100
  } else if (discount?.type === 'fixed' && discount.value) {
    finalPrice -= discount.value
  }

  const profit = finalPrice - basePrice - commission

  return {
    currency,
    commission: Number(commission.toFixed(2)),
    suggestedMarkup,
    finalPrice: Number(finalPrice.toFixed(2)),
    profit: Number(profit.toFixed(2)),
  }
}

export const isValidVerificationCode = (code: string): boolean => {
  return /^\d{6}$/.test(code)
}

export const generateId = () =>
  Array.from({ length: 24 }, () => Math.floor(Math.random() * 10)).join('')

export const formatError = (error: any): string => {
  if (error.name === 'ZodError') {
    const fieldErrors = Object.keys(error.errors).map((field) => {
      const errorMessage = error.errors[field].message
      return `${error.errors[field].path}: ${errorMessage}`
    })
    return fieldErrors.join('. ')
  } else if (error.name === 'ValidationError') {
    const fieldErrors = Object.keys(error.errors).map((field) => {
      const errorMessage = error.errors[field].message
      return errorMessage
    })
    return fieldErrors.join('. ')
  } else if (error.code === 11000) {
    const duplicateField = Object.keys(error.keyValue)[0]
    return `${duplicateField} already exists`
  } else {
    return typeof error.message === 'string'
      ? error.message
      : JSON.stringify(error.message)
  }
}

export function calculateFutureDate(days: number) {
  const currentDate = new Date()
  currentDate.setDate(currentDate.getDate() + days)
  return currentDate
}

export function calculatePastDate(days: number) {
  const currentDate = new Date()
  currentDate.setDate(currentDate.getDate() - days)
  return currentDate
}

export function getMonthName(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const date = new Date(year, month - 1)
  const monthName = date.toLocaleString('default', { month: 'long' })
  const now = new Date()

  if (year === now.getFullYear() && month === now.getMonth() + 1) {
    return `${monthName} Ongoing`
  }
  return monthName
}

export function timeUntilMidnight(): { hours: number; minutes: number } {
  const now = new Date()
  const midnight = new Date()
  midnight.setHours(24, 0, 0, 0)

  const diff = midnight.getTime() - now.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return { hours, minutes }
}

export const formatDateTime = (dateString: Date) => {
  const dateTimeOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    year: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }
  const dateOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    year: 'numeric',
    day: 'numeric',
  }
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }
  const formattedDateTime: string = new Date(dateString).toLocaleString(
    'en-US',
    dateTimeOptions
  )
  const formattedDate: string = new Date(dateString).toLocaleString(
    'en-US',
    dateOptions
  )
  const formattedTime: string = new Date(dateString).toLocaleString(
    'en-US',
    timeOptions
  )
  return {
    dateTime: formattedDateTime,
    dateOnly: formattedDate,
    timeOnly: formattedTime,
  }
}
