# 🎬 NOO TV - منصة البث العربية

## 📋 نظرة عامة

منصة NOO TV هي منصة بث فيديو عربية متكاملة مبنية بتقنيات حديثة توفر تجربة مشاهدة احترافية للأفلام والمسلسلات العربية والعالمية.

## ✨ الميزات الرئيسية

### 🎥 للمستخدمين
- ✅ تصفح آلاف الأفلام والمسلسلات
- ✅ مشغل فيديو متقدم (YouTube Embed)
- ✅ نظام بحث قوي وذكي
- ✅ حفظ المفضلة وقوائم المشاهدة
- ✅ تتبع سجل المشاهدة
- ✅ نظام تقييم وتعليقات
- ✅ إشعارات للمحتوى الجديد
- ✅ واجهة عربية كاملة (RTL)
- ✅ دعم الوضع الداكن
- ✅ تصميم متجاوب لجميع الأجهزة

### 🛠️ لوحة التحكم الإدارية
- ✅ إدارة الأفلام والمسلسلات
- ✅ نظام التصنيفات المرن
- ✅ إدارة المستخدمين
- ✅ إحصائيات وتقارير متقدمة
- ✅ نظام الإعلانات
- ✅ إعدادات الموقع
- ✅ نظام الإشعارات

## 🚀 التقنيات المستخدمة

```
- Frontend: Next.js 14 + React 18
- Styling: Tailwind CSS + shadcn/ui
- Backend: Supabase (PostgreSQL + Auth + Storage)
- Authentication: Supabase Auth + OAuth (Google)
- Deployment: Vercel Ready
```

## 📦 التثبيت والإعداد

### 1. المتطلبات الأساسية

```bash
Node.js 18.x أو أعلى
npm 9.x أو yarn 1.22+
حساب Supabase
```

### 2. استنساخ المشروع

```bash
git clone <repository-url>
cd noo-tv
```

### 3. تثبيت الحزم

```bash
yarn install
# أو
npm install
```

### 4. إعداد Supabase

#### أ. إنشاء مشروع Supabase
1. اذهب إلى [supabase.com](https://supabase.com)
2. أنشئ حساب جديد أو سجل دخول
3. أنشئ مشروع جديد
4. انتظر حتى يتم إعداد المشروع (2-3 دقائق)

#### ب. الحصول على بيانات الاتصال
1. من لوحة تحكم Supabase، اذهب إلى **Settings** > **API**
2. انسخ:
   - `Project URL` → سيكون `NEXT_PUBLIC_SUPABASE_URL`
   - `anon/public key` → سيكون `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### ج. إنشاء قاعدة البيانات
1. من لوحة تحكم Supabase، اذهب إلى **SQL Editor**
2. افتح ملف `supabase_setup.sql` من المشروع
3. انسخ كامل محتوى الملف والصقه في SQL Editor
4. اضغط **Run** أو **F5**
5. انتظر حتى تظهر رسالة النجاح ✅

### 5. إعداد ملف البيئة

أنشئ ملف `.env.local` في جذر المشروع:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 6. تفعيل Google OAuth (اختياري)

1. من Supabase، اذهب إلى **Authentication** > **Providers**
2. فعّل **Google**
3. أدخل `Client ID` و `Client Secret` من Google Console
4. أضف Redirect URL: `https://your-project.supabase.co/auth/v1/callback`

### 7. تشغيل المشروع

```bash
# وضع التطوير
yarn dev
# أو
npm run dev

# المتصفح: http://localhost:3000
```

## 👨‍💼 إعداد أول مستخدم إداري

### الطريقة 1: من خلال SQL

```sql
-- في Supabase SQL Editor
INSERT INTO public.users (id, email, display_name, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@example.com'),
  'admin@example.com',
  'المدير',
  'admin'
);
```

### الطريقة 2: من خلال الواجهة

1. سجل حساب جديد من `/auth`
2. من Supabase Dashboard، اذهب إلى **Table Editor** > **users**
3. ابحث عن المستخدم وغيّر `role` إلى `admin`
4. سجل خروج ودخول مرة أخرى
5. الآن يمكنك الوصول إلى `/admin`

## 📚 دليل الاستخدام

### إضافة فيلم جديد

1. سجل دخول كمدير
2. اذهب إلى `/admin`
3. اضغط "إضافة فيلم جديد"
4. املأ البيانات:
   - **العنوان**: اسم الفيلم
   - **رابط YouTube Embed**: احصل عليه من YouTube:
     - افتح الفيديو على YouTube
     - اضغط Share > Embed
     - انسخ الرابط من `src="..."`
     - مثال: `https://www.youtube.com/embed/VIDEO_ID`
   - **الوصف**: نبذة عن الفيلم
   - **صورة الغلاف**: رابط صورة (استخدم Unsplash مجاناً)
   - **التصنيف، السنة، اللغة، الجودة**
5. اضغط "إضافة"

### إدارة التصنيفات

1. من لوحة التحكم، اذهب إلى تبويب "التصنيفات"
2. اضغط "إضافة تصنيف جديد"
3. أدخل الاسم واختر النوع (أفلام/مسلسلات)
4. سيظهر التصنيف تلقائياً في الصفحة الرئيسية

### إدارة المستخدمين

1. من لوحة التحكم، اذهب إلى تبويب "المستخدمين"
2. يمكنك:
   - عرض جميع المستخدمين
   - البحث والتصفية
   - تغيير الأدوار
   - حظر المستخدمين

## 🎨 التخصيص

### تغيير الألوان الرئيسية

عدّل ملف `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      primary: 'your-color', // اللون الرئيسي
      // ...
    }
  }
}
```

### تغيير الشعار

1. افتح `app/page.js`
2. ابحث عن `NOO TV`
3. استبدله بشعارك أو صورة

## 🔒 الأمان

### Row Level Security (RLS)

المشروع يستخدم RLS من Supabase لحماية البيانات:

- ✅ المستخدمون يمكنهم قراءة المحتوى العام فقط
- ✅ المستخدمون يمكنهم إدارة بياناتهم الخاصة فقط
- ✅ المدراء فقط يمكنهم إضافة/تعديل/حذف المحتوى
- ✅ جميع الجداول محمية بـ RLS

### نصائح أمنية

- 🔐 لا تشارك `SUPABASE_ANON_KEY` علناً (هي آمنة للاستخدام في الفرونت إند)
- 🔐 استخدم `SUPABASE_SERVICE_ROLE_KEY` فقط في الباك إند
- 🔐 فعّل 2FA لحساب Supabase
- 🔐 راجع سياسات RLS بانتظام

## 📱 النشر (Deployment)

### النشر على Vercel

```bash
# 1. ثبت Vercel CLI
npm i -g vercel

# 2. سجل دخول
vercel login

# 3. انشر
vercel --prod

# 4. أضف Environment Variables من لوحة Vercel
```

### النشر على Netlify

1. اربط مستودع GitHub
2. أضف Environment Variables
3. Build command: `npm run build`
4. Publish directory: `.next`

## 🐛 استكشاف الأخطاء

### خطأ: "Not authenticated"

**الحل:** تأكد من:
- تسجيل الدخول
- صحة بيانات Supabase في `.env.local`
- إعادة تشغيل السيرفر بعد تغيير `.env.local`

### خطأ: "Table does not exist"

**الحل:**
- تأكد من تنفيذ `supabase_setup.sql` بالكامل
- تحقق من Supabase Dashboard > Table Editor

### خطأ: "Permission denied"

**الحل:**
- تحقق من سياسات RLS في Supabase
- تأكد من أن دور المستخدم صحيح

## 📊 الإحصائيات والأداء

### تحسين الأداء

- ✅ تحميل lazy للصور
- ✅ Caching لـ Supabase queries
- ✅ Indexes على الأعمدة المهمة
- ✅ Pagination للقوائم الطويلة

### مراقبة الأداء

```sql
-- احصائيات سريعة
SELECT 
  COUNT(*) as total_movies,
  SUM(views) as total_views,
  AVG(average_rating) as avg_rating
FROM movies;
```

## 🔄 التحديثات المستقبلية

### المرحلة 2
- [ ] نظام الاشتراكات المدفوعة
- [ ] بث مباشر
- [ ] تطبيقات موبايل (React Native)
- [ ] تعدد اللغات الكامل
- [ ] نظام التوصيات الذكي (AI)

### المرحلة 3
- [ ] PWA (Progressive Web App)
- [ ] Offline Mode
- [ ] Social Features
- [ ] Analytics Dashboard
- [ ] API للمطورين

## 🤝 المساهمة

نرحب بمساهماتكم! يرجى:

1. Fork المشروع
2. أنشئ branch جديد (`git checkout -b feature/amazing-feature`)
3. Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push للـ branch (`git push origin feature/amazing-feature`)
5. افتح Pull Request

## 📄 الترخيص

هذا المشروع مفتوح المصدر ومتاح للاستخدام الحر.

## 📞 الدعم

للدعم والاستفسارات:
- 📧 Email: support@nootv.com
- 💬 Discord: [انضم لمجتمعنا](#)
- 📱 Twitter: [@nootv](#)

## 🙏 شكر وتقدير

- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Lucide Icons](https://lucide.dev/)

---

<div align="center">
  <strong>صُنع بـ ❤️ للمجتمع العربي</strong>
  <br>
  <sub>NOO TV &copy; 2025</sub>
</div>
