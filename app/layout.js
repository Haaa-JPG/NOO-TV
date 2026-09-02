import { Tajawal } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import PWAInstall from '@/components/pwa-install'
import BanModal from '@/components/ban-modal'
import Footer from '@/components/footer'

const tajawal = Tajawal({ 
  subsets: ['arabic'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-tajawal'
})

export const metadata = {
  title: {
    default: 'NOO TV - منصة أفلام ومسلسلات مجانية',
    template: '%s | NOO TV',
  },
  description: 'شاهد أحدث الأفلام والمسلسلات العربية والعالمية مجاناً بجودة عالية. ترجمة مدبلجة. NOO TV منصة البث الأولى.',
  keywords: ['مسلسلات عربية', 'أفلام عربية', 'مشاهدة مجاناً', ' streaming', 'مسلسلات مترجمة', 'أفلام مدبلجة', 'نوفا', 'NOO TV', 'مسلسلات تركية', 'أفلام هندية', 'أنمي', 'דרاما', 'كوميديا', 'أكشن'],
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
    title: 'NOO TV - منصة أفلام ومسلسلات مجانية',
    description: 'شاهد أحدث الأفلام والمسلسلات العربية والعالمية مجاناً بجودة عالية',
    url: 'https://noo-tv.vercel.app',
    siteName: 'NOO TV',
    locale: 'ar_SA',
    type: 'website',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'NOO TV - منصة البث العربية',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NOO TV - منصة أفلام ومسلسلات مجانية',
    description: 'شاهد أحدث الأفلام والمسلسلات العربية والعالمية مجاناً بجودة عالية',
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
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-96x96.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${tajawal.variable} font-sans antialiased`}>
        {children}
        <Footer />
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
                      console.log('SW registered:', reg.scope);
                      
                      reg.addEventListener('updatefound', function() {
                        var newWorker = reg.installing;
                        newWorker.addEventListener('statechange', function() {
                          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('New SW available, refreshing...');
                            window.location.reload();
                          }
                        });
                      });
                    })
                    .catch(function(err) { console.log('SW registration failed:', err); });
                  
                  navigator.serviceWorker.addEventListener('controllerchange', function() {
                    console.log('SW controller changed');
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
