import { Tajawal } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

const tajawal = Tajawal({ 
  subsets: ['arabic'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-tajawal'
})

export const metadata = {
  title: 'NOO TV - منصة البث العربية',
  description: 'شاهد آلاف الأفلام والمسلسلات العربية والعالمية',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <body className={`${tajawal.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
