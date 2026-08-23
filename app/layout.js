import { Tajawal } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import PWAInstall from '@/components/pwa-install'
import Footer from '@/components/footer'

const tajawal = Tajawal({ 
  subsets: ['arabic'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-tajawal'
})

export const metadata = {
  title: 'NOO TV - منصة البث العربية',
  description: 'شاهد آلاف الأفلام والمسلسلات العربية والعالمية',
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
    title: 'NOO TV - منصة البث العربية',
    description: 'شاهد آلاف الأفلام والمسلسلات العربية والعالمية',
    type: 'website',
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
