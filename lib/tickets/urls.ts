// Absolute links embedded in QR codes, emails and Stripe redirects.

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://latinmusicmastery.com').replace(/\/$/, '')
}

export const eventPagePath = (slug: string) => `/events/${slug}`
export const orderPagePath = (accessToken: string) => `/tickets/${accessToken}`
export const scannerPagePath = (token: string) => `/scan/${token}`

export const orderPageUrl = (accessToken: string) => `${appUrl()}${orderPagePath(accessToken)}`
export const scannerPageUrl = (token: string) => `${appUrl()}${scannerPagePath(token)}`
