# 🚀 دليل الإعداد السريع لـ NOO TV

## الخطوة 1: إعداد قاعدة البيانات في Supabase

### 1.1 إنشاء المشروع
1. افتح [Supabase Dashboard](https://app.supabase.com)
2. اضغط "New Project"
3. أدخل:
   - **Name**: NOO TV
   - **Database Password**: اختر كلمة مرور قوية
   - **Region**: اختر أقرب منطقة لك
4. اضغط "Create new project" وانتظر 2-3 دقائق

### 1.2 تنفيذ SQL
1. من القائمة الجانبية، اذهب إلى **SQL Editor**
2. افتح ملف `supabase_setup.sql` من المشروع
3. انسخ كامل المحتوى (Ctrl+A ثم Ctrl+C)
4. الصقه في SQL Editor
5. اضغط **Run** (أو اضغط F5)
6. انتظر حتى ترى رسالة "✅ تم إعداد قاعدة البيانات بنجاح!"

### 1.3 الحصول على مفاتيح API
1. من القائمة، اذهب إلى **Settings** (الترس في الأسفل)
2. اختر **API** من القائمة الجانبية
3. ستجد:
   ```
   Project URL: https://xxxxx.supabase.co
   anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. احتفظ بهذه القيم للخطوة التالية

---

## الخطوة 2: إعداد المشروع محلياً

### 2.1 تثبيت المشروع
```bash
# استنسخ المشروع
git clone <your-repo-url>
cd noo-tv

# ثبت الحزم
yarn install
# أو
npm install
```

### 2.2 إعداد ملف البيئة
أنشئ ملف `.env.local` في جذر المشروع:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> ⚠️ **مهم**: استبدل القيم بالقيم الحقيقية من Supabase

---

## الخطوة 3: تشغيل المشروع

```bash
# شغل السيرفر
yarn dev
# أو
npm run dev

# افتح المتصفح
# http://localhost:3000
```

---

## الخطوة 4: إنشاء حساب مدير

### الطريقة 1: من واجهة الموقع + Supabase Dashboard

1. **سجل حساب جديد** من الموقع:
   - اذهب إلى http://localhost:3000/auth
   - اضغط "إنشاء حساب جديد"
   - أدخل بريدك الإلكتروني وكلمة المرور
   - اضغط "إنشاء الحساب"

2. **تأكيد البريد**:
   - افتح بريدك الإلكتروني
   - ابحث عن رسالة من Supabase
   - اضغط رابط التأكيد
   - (إذا لم تصل الرسالة، تحقق من مجلد Spam)

3. **ترقية الحساب إلى مدير**:
   - افتح Supabase Dashboard
   - اذهب إلى **Table Editor**
   - اختر جدول **users**
   - ابحث عن بريدك الإلكتروني
   - غيّر عمود `role` من `user` إلى `admin`
   - احفظ التغييرات

4. **تسجيل الدخول كمدير**:
   - ارجع للموقع
   - سجل خروج ثم دخول مرة أخرى
   - الآن يمكنك الوصول إلى `/admin`

### الطريقة 2: مباشرة من SQL (أسرع)

إذا كان لديك حساب مسجل بالفعل:

```sql
-- في Supabase SQL Editor
-- استبدل البريد الإلكتروني ببريدك
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'your-email@example.com';

-- أو أنشئ حساب مدير مباشرة
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  is_super_admin,
  raw_app_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@nootv.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"role": "admin", "display_name": "Admin"}'::jsonb,
  FALSE,
  '{"provider": "email", "providers": ["email"]}'::jsonb
);
```

---

## الخطوة 5: إضافة أول فيلم

1. **تسجيل الدخول كمدير**:
   - اذهب إلى http://localhost:3000/auth
   - سجل دخول بحساب المدير

2. **فتح لوحة التحكم**:
   - اذهب إلى http://localhost:3000/admin
   - أو اضغط على اسمك > "لوحة التحكم"

3. **إضافة فيلم**:
   - اضغط "إضافة فيلم جديد"
   - املأ البيانات:
     
     **مثال عملي:**
     ```
     العنوان: The Matrix
     الوصف: فيلم خيال علمي رائع
     رابط YouTube Embed: https://www.youtube.com/embed/m8e-FF8MsqU
     صورة الغلاف: https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400
     البانر: https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920
     التصنيف: خيال علمي
     السنة: 1999
     اللغة: en
     الجودة: HD
     ✅ مترجم
     ✅ مفعل
     ```

4. **احفظ واعرض**:
   - اضغط "إضافة"
   - ارجع للصفحة الرئيسية (/)
   - ستجد الفيلم معروضاً!

---

## الخطوة 6: الحصول على روابط YouTube Embed الصحيحة

### كيفية الحصول على رابط Embed:

#### الطريقة 1: من YouTube مباشرة
1. افتح الفيديو على YouTube
2. اضغط **Share** (مشاركة)
3. اختر **Embed** (تضمين)
4. انسخ الرابط من `src="..."`
   ```html
   مثال:
   src="https://www.youtube.com/embed/VIDEO_ID"
   ```

#### الطريقة 2: تحويل رابط عادي
إذا كان لديك رابط عادي:
```
من: https://www.youtube.com/watch?v=dQw4w9WgXcQ
إلى: https://www.youtube.com/embed/dQw4w9WgXcQ
```

فقط استبدل `watch?v=` بـ `embed/`

---

## الخطوة 7: تفعيل Google OAuth (اختياري)

### 7.1 إنشاء مشروع Google
1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com)
2. أنشئ مشروع جديد
3. فعّل Google OAuth API

### 7.2 إنشاء OAuth Client
1. من القائمة: **APIs & Services** > **Credentials**
2. اضغط **Create Credentials** > **OAuth Client ID**
3. اختر **Web application**
4. أضف Authorized redirect URIs:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```
5. احفظ **Client ID** و **Client Secret**

### 7.3 تفعيل في Supabase
1. في Supabase: **Authentication** > **Providers**
2. فعّل **Google**
3. أدخل **Client ID** و **Client Secret**
4. احفظ

الآن المستخدمون يمكنهم تسجيل الدخول بـ Google!

---

## الخطوة 8: النشر للإنتاج

### على Vercel (مجاني)

```bash
# ثبت Vercel CLI
npm i -g vercel

# سجل دخول
vercel login

# انشر
vercel --prod
```

**لا تنسَ:**
1. أضف Environment Variables في Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. حدّث Redirect URLs في Supabase:
   - اذهب إلى **Authentication** > **URL Configuration**
   - أضف رابط موقعك على Vercel

---

## 🎉 تهانينا!

منصتك جاهزة الآن! يمكنك:

✅ إضافة أفلام ومسلسلات
✅ إدارة المستخدمين  
✅ عرض الإحصائيات
✅ إدارة التصنيفات

---

## 🆘 مشاكل شائعة وحلولها

### مشكلة: "Cannot connect to Supabase"
**الحل:**
- تأكد من صحة المفاتيح في `.env.local`
- تأكد من إعادة تشغيل السيرفر بعد تعديل `.env.local`
- تحقق من اتصال الإنترنت

### مشكلة: "Permission denied"
**الحل:**
- تأكد من تنفيذ SQL كاملاً
- تحقق من RLS Policies في Supabase
- تأكد من دور المستخدم (admin/user)

### مشكلة: الفيديو لا يعمل
**الحل:**
- تأكد من استخدام رابط Embed صحيح
- جرب الرابط في متصفح منفصل
- تحقق من أن الفيديو غير محظور في بلدك

### مشكلة: الصور لا تظهر
**الحل:**
- استخدم روابط مباشرة للصور (https://)
- جرب روابط من Unsplash أو Pexels
- تأكد من أن الرابط يعمل في متصفح منفصل

---

## 📞 تحتاج مساعدة؟

- 📧 البريد الإلكتروني: support@nootv.com
- 💬 Discord: [انضم لمجتمعنا](#)
- 📖 التوثيق الكامل: [README.md](./README.md)

---

**بالتوفيق! 🎬**
