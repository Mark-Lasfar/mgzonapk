import { Metadata as NextMetadata } from 'next'

declare module 'next' {
  interface Verification {
    google?: string
    bing?: string
    yandex?: string
    other?: {
      [key: string]: string | boolean
      'msvalidate.01'?: string
      'baidu-site-verification'?: string
    }
  }

  interface Metadata extends Omit<NextMetadata, 'verification'> {
    verification?: Verification
  }
}

