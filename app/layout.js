import { Tajawal, Outfit } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import PWAInstall from '@/components/pwa-install'
import BanModal from '@/components/ban-modal'
import Footer from '@/components/footer'
import { LanguageProvider } from '@/lib/language-context'
import { ThemeProvider } from '@/lib/theme-context'
import ClientLayout from '@/components/client-layout'

const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-tajawal',
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
})

export const metadata = {
  title: {
    default: 'NOO TV - Free Movies & Series Streaming',
    template: '%s | NOO TV',
  },
  description: 'Watch thousands of Arabic and international movies and series for free in high quality. NOO TV - Your first streaming platform.',
  keywords: ['streaming', 'movies', 'series', 'arabic movies', 'arabic series', 'free streaming', 'watch online', 'NOO TV', 'anime', 'drama', 'comedy', 'action'],
  authors: [{ name: 'NOO TV' }],
  creator: 'NOO TV',
  publisher: 'NOO TV',
  metadataBase: new URL('https://noo-tv.vercel.app'),
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NOO TV',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'NOO TV - Free Movies & Series Streaming',
    description: 'Watch thousands of Arabic and international movies and series for free in high quality',
    url: 'https://noo-tv.vercel.app',
    siteName: 'NOO TV',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'NOO TV - Streaming Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NOO TV - Free Movies & Series Streaming',
    description: 'Watch thousands of Arabic and international movies and series for free in high quality',
    images: ['/og-default.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport = {
  themeColor: '#dc2626',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" className="dark" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-96x96.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${tajawal.variable} ${outfit.variable} font-sans antialiased`}>
        <ThemeProvider>
          <LanguageProvider>
            <ClientLayout>
              {children}
              <Footer />
            </ClientLayout>
            <BanModal />
            <Toaster />
            <PWAInstall />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  if ('serviceWorker' in navigator) {
                    window.addEventListener('load', function() {
                      navigator.serviceWorker.register('/sw.js')
                        .then(function(reg) {
                          reg.addEventListener('updatefound', function() {
                            var newWorker = reg.installing;
                            newWorker.addEventListener('statechange', function() {
                              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                window.location.reload();
                              }
                            });
                          });
                        })
                        .catch(function(err) {});
                    });
                  }
                `,
              }}
            />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
