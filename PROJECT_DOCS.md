# NOO TV - منصة البث العربية

## دليل المشروع الشامل

---

## نظرة عامة

**NOO TV** هو موقع بث عربي متكامل لعرض الأفلام والمسلسلات. تم بناؤه باستخدام:

- **الواجهة الأمامية:** Next.js 14 + React 18 + Tailwind CSS + shadcn/ui
- **قاعدة البيانات:** Supabase (PostgreSQL + Auth + RLS)
- **الباك اند:** Next.js منفصل على Render.com مع Playwright لاستخراج روابط البث
- **الاستضافة:** Vercel (الواجهة) + Render (الباك اند)

---

## المعمارية (Architecture)

```
┌─────────────────────────────────────────────┐
│                  Vercel                      │
│           (الواجهة الأمامية)                  │
│                                             │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
│  │ الصفحة   │  │ المشغل   │  │  الأدمن   │  │
│  │ الرئيسية │  │ الفيديو  │  │  panel    │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│       │              │              │        │
│       └──────────────┼──────────────┘        │
│                      │                       │
└──────────────────────┼───────────────────────┘
                       │
              ┌────────▼────────┐
              │    Supabase     │
              │  (PostgreSQL)   │
              │  + Auth + RLS   │
              └────────┬────────┘
                       │
┌──────────────────────┼───────────────────────┐
│                Render.com                     │
│             (الباك اند)                       │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │     /api/extract                     │    │
│  │  Playwright → استخراج m3u8          │    │
│  │  + طابور التجديد التلقائي           │    │
│  └──────────────────────────────────────┘    │
│                                              │
└──────────────────────────────────────────────┘
```

---

## هيكل الملفات

```
NOO-main/
├── app/                          # صفحات الواجهة
│   ├── layout.js                 # التخطيط الجذري (Arabic RTL, Tajawal font)
│   ├── page.js                   # الصفحة الرئيسية
│   ├── globals.css               # الأنماط العامة
│   ├── admin/page.js             # لوحة التحكم (1760 سطر)
│   ├── auth/page.js              # تسجيل الدخول/الإنشاء
│   ├── auth/callback/page.js     # callback Google OAuth
│   ├── movies/page.js            # قائمة الأفلام
│   ├── series/page.js            # قائمة المسلسلات
│   ├── categories/page.js        # التصنيفات
│   ├── search/page.js            # البحث
│   ├── watch/movie/[id]/page.js  # صفحة مشاهدة الفيلم
│   ├── watch/series/[id]/page.js # صفحة مشاهدة المسلسل
│   ├── user/page.js              # لوحة تحكم المستخدم
│   ├── complaints/page.js        # الشكاوى
│   ├── privacy/page.js           # سياسة الخصوصية
│   ├── disclaimer/page.js        # إخلاء المسؤولية
│   └── api/proxy/route.js        # بروكسي الفيديو
│
├── components/
│   ├── video-player.jsx          # المشغل الذكي (279 سطر)
│   ├── footer.jsx                # الفوتر
│   ├── pwa-install.jsx           # تثبيت PWA
│   └── ui/                       # مكونات shadcn/ui (48 ملف)
│
├── lib/
│   ├── supabase.js               # عميل Supabase (كلاينت)
│   ├── supabase-server.js        # عميل Supabase (سيرفر)
│   ├── translations.js           # الترجمات (عربي/إنجليزي)
│   ├── language-context.js       # سياق اللغة
│   └── utils.js                  # دوال مساعدة
│
├── hooks/
│   ├── use-toast.js              # hook الإشعارات
│   └── use-mobile.jsx            # hook كشف الجوال
│
├── public/
│   ├── manifest.json             # ملف PWA
│   ├── sw.js                     # Service Worker
│   ├── favicon.png               # الأيقونة
│   └── icons/                    # أيقونات PWA (8 أحجام)
│
├── middleware.js                  # Middleware (pass-through)
├── next.config.js                # إعدادات Next.js
├── package.json                  # التبعيات
├── tailwind.config.js            # إعدادات Tailwind
└── supabase_setup.sql            # SQL لإنشاء الجداول
```

### الباك اند (مستودع منفصل: NOO-backend)

```
backend/
├── Dockerfile                    # صورة Docker (node:20 + Playwright)
├── package.json                  # التبعيات (next, playwright, @supabase/supabase-js)
├── render.yaml                   # إعدادات Render
├── next.config.js                # standalone output
└── app/api/extract/route.js      # نقطة الاستخراج + الطابور
```

---

## قاعدة البيانات (Supabase)

### الجداول الرئيسية

| الجدول | الوظيفة |
|---|---|
| `users` | ملفات المستخدمين (id, email, display_name, role, is_banned) |
| `movies` | الأفلام (title, description, embed_url, thumbnail, category, year) |
| `series` | المسلسلات (title, description, category, total_seasons) |
| `seasons` | المواسم (series_id, season_number, title) |
| `episodes` | الحلقات (season_id, episode_number, title, embed_url, last_refreshed) |
| `categories` | التصنيفات |
| `watchlist` | قائمة المتابعة |
| `watch_history` | سجل المشاهدة |
| `ratings` | التقييمات |
| `comments` | التعليقات |
| `comment_likes` | إعجابات التعليق |
| `episode_likes` | إعجابات الحلقات |
| `movie_likes` | إعجابات الأفلام |
| `complaints` | الشكاوى |
| `view_tracking` | تتبع المشاهدات |
| `ads` | الإعلانات |
| `site_settings` | إعدادات الموقع |
| `user_notifications` | إشعارات المستخدمين |

### حقول مهمة في جدول الحلقات

```sql
episodes:
  id              UUID PRIMARY KEY
  season_id       UUID REFERENCES seasons(id)
  episode_number  INTEGER
  title           TEXT
  embed_url       TEXT          -- رابط المصدر أو m3u8 المستخرج
  thumbnail       TEXT
  duration        INTEGER
  views           INTEGER DEFAULT 0
  is_active       BOOLEAN DEFAULT true
  display_order   INTEGER
  last_refreshed  TIMESTAMPTZ   -- آخر تحديث للرابط
  created_at      TIMESTAMPTZ DEFAULT now()
```

### حقول مهمة في جدول الأفلام

```sql
movies:
  id              UUID PRIMARY KEY
  title           TEXT
  description     TEXT
  embed_url       TEXT          -- رابط المصدر أو m3u8 المستخرج
  thumbnail       TEXT
  banner          TEXT
  category        TEXT
  year            INTEGER
  language        TEXT DEFAULT 'ar'
  quality         TEXT DEFAULT 'HD'
  views           INTEGER DEFAULT 0
  average_rating  DECIMAL
  is_active       BOOLEAN DEFAULT true
  last_refreshed  TIMESTAMPTZ
  created_at      TIMESTAMPTZ DEFAULT now()
```

---

## نظام الفيديو (Video System)

### مصادر الفيديو المدعومة

| النوع | النمط | الطريقة |
|---|---|---|
| YouTube | youtube.com, youtu.be | iframe embed |
| Vimeo | vimeo.com | iframe embed |
| Dailymotion | dailymotion.com, dai.ly | iframe embed |
| Wistia | wistia.com, wistia.net | iframe embed |
| HLS Stream | .m3u8 | hls.js |
| فيديو مباشر | .mp4, .webm, .mov, .ogv | HTML5 video |
| صفحة مصدر | 3isk, qrmzi, krmzi | استخراج عبر Playwright |
| أي رابط آخر | -- | iframe عام |

### مسار الفيديو (Video Flow)

```
1. المستخدم يفتح صفحة المشاهدة
        │
        ▼
2. VideoPlayer يقرأ embed_url من Supabase
        │
        ├─── رابط m3u8/mp4/YouTube ──→ تشغيل مباشر
        │
        └─── رابط مصدر (3isk/qrmzi) ──→ ExtractingPlayer
                │
                ▼
3. استدعاء GET /api/extract?url=...
                │
                ▼
4. سيرفر Render يفتح الصفحة بـ Playwright
   وي拦截 (intercept) طلبات .m3u8
                │
                ▼
5. إرجاع رابط m3u8 → تشغيل في hls.js
                │
                ▼
6. تحديث embed_url في Supabase بالـ m3u8
   (الزوار接下来 يشغّلون مباشرة بدون استخراج)
```

### المشغل الذكي (video-player.jsx)

```javascript
// التدفق الداخلي:

VideoPlayer({ url })
    │
    ├── url فارغ → "الفيديو غير متوفر"
    │
    ├── isSourcePageUrl(url) = true
    │       → ExtractingPlayer
    │       → شاشة تحميل + استدعاء API
    │       → تشغيل m3u8 المستخرج
    │
    ├── toEmbedUrl(url) → type: 'hls'
    │       → HlsVideo (hls.js)
    │
    ├── toEmbedUrl(url) → type: 'video'
    │       → <video> tag
    │
    └── toEmbedUrl(url) → type: 'iframe'
            → <iframe>
```

### بروكسي الفيديو (api/proxy/route.js)

- يمرر روابط m3u8 عبر البروكسي لتجاوز مشاكل CORS
- يعيد كتابة روابط الـ segments لتمرير عبر البروكسي
- يضيف headers: CORS, User-Agent spoofing
- يدعم: m3u8, mp4, webm, ogv

---

## الباك اند (Backend - Render.com)

### نقطة الاستخراج (/api/extract)

**GET مع parametr `url`:** استخراج فردي
```
GET /api/extract?url=https://z.3isk.news/episode-5
→ يفتح الصفحة بـ Playwright
→ ي拦截 طلبات .m3u8
→ يُعيد { m3u8: "https://...m3u8?..." }
→ يحدّث embed_url في Supabase
```

**GET بدون parameters:** تشغيل الطابور
```
GET /
→ يقرأ كل الحلقات من Supabase
→ يفلتر: فارغة أو last_refreshed > 6 ساعات
→ يستخرج كل حلقة بالتسلسل
→ يُعي { status: "queue_started" }
→ الطابور يعمل في الخلفية
```

**POST:** تشغيل الطابور (نفس GET بدون parameters)

### الطابور التلقائي (Sequential Queue)

```
1. يجلب كل الحلقات النشطة من Supabase
2. يفلتر الحلقات التي تحتاج تجديد:
   - embed_url فارغ
   - last_refreshed فارغ
   - last_refreshed > 6 ساعات
3. لكل حلقة بالترتيب:
   a. chromium.launch() → فتح متصفح جديد
   b. الذهاب لصفحة المصدر
   c. انتظار تحميل .m3u8 (حد أقصى 45 ثانية)
   d. page.close() + context.close() + browser.close()
   e. تحديث embed_url و last_refreshed في Supabase
   f. الانتقال للحلقة التالية
```

### إعدادات Playwright على Render

```javascript
// Dockerfile
FROM node:20-slim
RUN apt-get install -y chromium deps
RUN npx playwright install --with-deps chromium

// BROWSER_ARGS
'--no-sandbox', '--disable-setuid-sandbox',
'--disable-gpu', '--disable-dev-shm-usage',
'--no-first-run', '--no-zygote', '--single-process'
```

---

## لوحة التحكم (Admin Panel)

### الميزات

- **إحصائيات:** عدد الأفلام، المسلسلات، الحلقات، المستخدمين
- **إدارة الأفلام:** إضافة/تعديل/حذف + رفع صور
- **إدارة المسلسلات:** إضافة/تعديل/حذف + المواسم
- **توليد حلقات بالجملة:** إدخار رابط + تحديد رقم من/إلى → توليد تلقائي
- **إدارة المستخدمين:** حظر/فك حظر
- **الشكاوى:** عرض والرد
- **الجدول الزمني:** يوم نزول الحلقات الأسبوعي

### توليد الحلقات بالجملة

```
1. الأدمن يدخل رابط الحلقة الأولى (مثال: https://z.3isk.news/episode-5)
2. يحدد: من الحلقة 1 إلى الحلقة 10
3. النظام:
   - يستخرج الرقم من نهاية الرابط (5)
   - يستبدل بالأرقام من 1 إلى 10
   - يحفظ كل حلقة في Supabase:
     embed_url = "https://z.3isk.news/episode-{i}"
     last_refreshed = null (يتم الاستخراج لاحقاً)
4. البادج يظهر: ⏳ في طابور الانتظار (برتقالي)
5. أول زائر يفتح الحلقة → يستخرجها → تتحول لـ: ✓ جاهز للمشاهدة (أخضر)
```

### بادجات حالة الحلقة في الأدمن

| البادج | الحالة | المعنى |
|---|---|---|
| 🟢 `✓ جاهز للمشاهدة` | `embed_url` يحتوي m3u8 | الفيديو جاهز |
| 🟡 `⏳ في طابور الانتظار` | `embed_url` رابط مصدر | في انتظار الاستخراج |
| 🔴 `غير موجودة ✗` | `embed_url` فارغ | لا يوجد رابط |

---

## Autentication

### طريقة العمل

1. **تسجيل الدخول:** email + password عبر Supabase Auth
2. **Google OAuth:** تسجيل عبر Google مع callback
3. **الجلسة:** مخزنة في `localStorage` (وليس cookies)
4. **الأدمن:** التحقق عبر `users.role === 'admin'`
5. **الحماية:** كل صفحة محمية تتحقق من المستخدم client-side

### صلاحيات المستخدمين

| الدور | الصلاحيات |
|---|---|
| زائر | تصفح المشاهدة |
| مستخدم مسجل | التعليق + التقييم + المفضلة |
| أدمن | لوحة التحكم الكاملة (CRUD) |

---

## PWA (Progressive Web App)

- **manifest.json:** إعدادات عربية مع RTL
- **Service Worker:** `sw.js` للتخزين المؤقت
- **أيقونات:** 8 أحجام من 72px إلى 512px
- **الألوان:** خلفية سوداء (#000000)، لون رئيسي أحمر (#dc2626)
- **التثبيت:** زر `pwa-install.jsx` يظهر للمستخدمين

---

## إعدادات الأمان (Headers)

```javascript
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src * 'self' 'unsafe-inline' 'unsafe-eval' ...
```

---

## متغيرات البيئة المطلوبة

### Vercel (الواجهة)

```
NEXT_PUBLIC_SUPABASE_URL=https://ykrslhhpjgfqkyutlxbx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_76J5Q_JJzHMjtAz5zqKGbg_IUUjRPUs
NEXT_PUBLIC_EXTRACT_URL=https://noo-tv-backend.onrender.com
```

### Render (الباك اند)

```
NODE_ENV=production
SUPABASE_URL=https://ykrslhhpjgfqkyutlxbx.supabase.co
SUPABASE_ANON_KEY=sb_publishable_76J5Q_JJzHMjtAz5zqKGbg_IUUjRPUs
```

---

## المستودعات (Repositories)

| المستودع | الرابط | الاستضافة |
|---|---|---|
| NOON (الرئيسي) | github.com/Haaa-JPG/NOON | -- |
| NOO-frontend | github.com/Haaa-JPG/NOO-frontend | Vercel |
| NOO-backend | github.com/Haaa-JPG/NOO-backend | Render |

---

## أوامر مهمة

```bash
# تثبيت التبعيات
npm install

# التشغيل المحلي
npm run dev

# البناء
npm run build

# بدء التشغيل
npm start

# بناء الباك اند (Docker)
cd backend && docker build -t noo-backend .

# اختبار استخراج m3u8
curl "https://noo-tv-backend.onrender.com/api/extract?url=https://z.3isk.news/episode-1"

# تشغيل الطابور
curl -X POST "https://noo-tv-backend.onrender.com/"
```

---

## الحلقات المشكلة المعروفة وحلولها

### 1. بطء أول تحميل للفيديو
**المشكلة:** أول زائر ينتظر ~10 ثوانٍ لاستخراج m3u8
**الحل:** بعد الاستخراج الأول، يُحفظ m3u8 في Supabase. الزوار接下来 يشغّلون مباشرة.

### 2. انتهاء صلاحية التوكن
**المشكلة:** روابط m3u8 تحتوي معلمات `s` (وقت الإنشاء) و `e` (المدة). بعد انتهاء المدة، ي_STOPWORK.
**الحل:** `last_refreshed` في Supabase يحدد متى يحتاج التجديد (> 6 ساعات).

### 3. عدم توافق روابط qrmzi
**المشكلة:** روابط qrmzi.tv لا تحتوي معلمات توكن.
**الحل:** الفحص يعتمد فقط على `last_refreshed` من Supabase (وليس تحليل الـ URL).

### 4. Render free tier spin-down
**المشكلة:** Render ينام بعد 15 دقيقة عدم نشاط. يستغرق 30-60 ثانية للصحو.
**الحل:** الطابور يعمل في الخلفية بعد الاستجابة.FIRST extraction takes time, subsequent ones are instant.

---

## ملخص تقني سريع

```
الموقع: NOO TV - منصة بث عربية
الإطار: Next.js 14.2.3
اللغة: JavaScript (لا TypeScript)
التصميم: RTL عربي بالكامل
القاعدة: Supabase PostgreSQL
المكونات: shadcn/ui + Tailwind CSS
الفيديو: hls.js + Playwright extraction
الاستضافة: Vercel + Render
المستخدم: admin@nootv.com / Admin@123456
```
