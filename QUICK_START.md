# 🎬 NOO TV - البداية السريعة

## ✨ ما تم بناؤه

تم بناء منصة NOO TV الكاملة مع جميع الميزات المطلوبة:

### 🎯 الميزات الرئيسية المنفذة:

#### 1️⃣ نظام المصادقة الكامل
- تسجيل دخول بالبريد الإلكتروني ✅
- إنشاء حسابات جديدة ✅
- Google OAuth (جاهز للتفعيل) ✅
- نظام الأدوار (Admin/Editor/User) ✅

#### 2️⃣ الصفحة الرئيسية
- تصميم Netflix-style احترافي ✅
- عرض الأفلام والمسلسلات ✅
- نظام التصنيفات ✅
- بحث متقدم ✅
- قائمة مستخدم ✅

#### 3️⃣ مشغل الفيديو
- YouTube Embed Player ✅
- نظام التقييم (1-5 نجوم) ✅
- نظام التعليقات ✅
- المفضلة وسجل المشاهدة ✅
- badges (مترجم/مدبلج) ✅

#### 4️⃣ لوحة التحكم الإدارية
- إحصائيات Dashboard ✅
- إدارة الأفلام (CRUD) ✅
- إدارة التصنيفات ✅
- إدارة المستخدمين ✅
- تفعيل/إخفاء المحتوى ✅

#### 5️⃣ لوحة المستخدم
- المفضلة ✅
- سجل المشاهدة ✅
- الإعدادات الشخصية ✅

#### 6️⃣ قاعدة البيانات
- 13 جدول محترف ✅
- Row Level Security ✅
- Indexes للأداء ✅

---

## 🚀 الخطوات التالية للبدء

### الخطوة 1: إعداد Supabase (5 دقائق)

1. افتح [Supabase](https://app.supabase.com)
2. أنشئ مشروع جديد
3. انتظر 2-3 دقائق حتى يصبح جاهزاً
4. اذهب إلى **SQL Editor**
5. افتح ملف `supabase_setup.sql`
6. انسخ كل المحتوى والصقه في SQL Editor
7. اضغط **Run** ✅

### الخطوة 2: احصل على المفاتيح

1. في Supabase، اذهب إلى **Settings** > **API**
2. انسخ:
   - `Project URL`
   - `anon public key`

### الخطوة 3: أضف المفاتيح للمشروع

أنشئ ملف `.env.local` في جذر المشروع:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### الخطوة 4: شغل المشروع

```bash
yarn dev
# أو
npm run dev

# افتح: http://localhost:3000
```

### الخطوة 5: أنشئ حساب مدير

**الطريقة السريعة:**

1. سجل حساب جديد من `/auth`
2. افتح Supabase Dashboard > Table Editor > users
3. ابحث عن بريدك وغيّر `role` إلى `admin`
4. سجل خروج ودخول مرة أخرى
5. افتح `/admin` ✅

**أو استخدم SQL:**
```sql
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'your-email@example.com';
```

### الخطوة 6: أضف أول فيلم! 🎬

1. اذهب إلى `/admin`
2. اضغط "إضافة فيلم جديد"
3. املأ البيانات:

```
العنوان: The Matrix
الوصف: فيلم خيال علمي رائع
رابط Embed: https://www.youtube.com/embed/m8e-FF8MsqU
صورة: https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400
التصنيف: خيال علمي
السنة: 1999
الجودة: HD
✅ مترجم
✅ مفعل
```

4. اضغط "إضافة" ✅
5. ارجع للصفحة الرئيسية - سترى الفيلم! 🎉

---

## 📂 بنية المشروع

```
/app
├── app/
│   ├── page.js              # 🏠 الصفحة الرئيسية
│   ├── auth/page.js         # 🔐 تسجيل الدخول
│   ├── admin/page.js        # 👨‍💼 لوحة التحكم
│   ├── user/page.js         # 👤 لوحة المستخدم
│   └── watch/movie/[id]/    # 🎬 صفحة المشاهدة
├── components/ui/           # 🎨 مكونات UI
├── lib/supabase.js          # 🗄️ Supabase Client
├── supabase_setup.sql       # 📊 إعداد القاعدة
├── README.md                # 📖 التوثيق الكامل
├── SETUP_GUIDE.md           # 🚀 دليل الإعداد
└── PROJECT_SUMMARY.md       # 📋 ملخص المشروع
```

---

## 🎯 صفحات المشروع

### للمستخدمين:
- `/` - الصفحة الرئيسية
- `/auth` - تسجيل الدخول/إنشاء حساب
- `/watch/movie/:id` - مشاهدة الفيلم
- `/user` - لوحة المستخدم
- `/user/watchlist` - المفضلة
- `/user/history` - سجل المشاهدة

### للمدراء:
- `/admin` - لوحة التحكم
- إدارة الأفلام
- إدارة التصنيفات
- إدارة المستخدمين
- الإحصائيات

---

## 🔧 التكنولوجيا المستخدمة

- **Frontend**: Next.js 14 + React 18
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **الأيقونات**: Lucide React

---

## 📊 قاعدة البيانات

13 جدول تم إنشاؤها:
1. users - المستخدمين
2. movies - الأفلام
3. series - المسلسلات
4. seasons - المواسم
5. episodes - الحلقات
6. categories - التصنيفات
7. watchlist - المفضلة
8. watch_history - سجل المشاهدة
9. ratings - التقييمات
10. comments - التعليقات
11. user_notifications - الإشعارات
12. ads - الإعلانات
13. site_settings - الإعدادات

---

## 💡 نصائح سريعة

### الحصول على رابط YouTube Embed:
```
من: https://www.youtube.com/watch?v=VIDEO_ID
إلى: https://www.youtube.com/embed/VIDEO_ID
```

فقط استبدل `watch?v=` بـ `embed/`

### صور مجانية:
- [Unsplash](https://unsplash.com) - صور عالية الجودة
- [Pexels](https://pexels.com) - صور مجانية
- استخدم روابط مباشرة: `?w=400` للغلاف، `?w=1920` للبانر

---

## 🆘 حل المشاكل الشائعة

### ❌ "Cannot connect to Supabase"
✅ تحقق من المفاتيح في `.env.local`  
✅ أعد تشغيل السيرفر بعد تعديل `.env.local`

### ❌ "Permission denied"
✅ تأكد من تنفيذ `supabase_setup.sql` كاملاً  
✅ تحقق من دور المستخدم (admin/user)

### ❌ "Table does not exist"
✅ نفذ SQL كاملاً من `supabase_setup.sql`  
✅ تحقق من Table Editor في Supabase

### ❌ الفيديو لا يعمل
✅ تأكد من استخدام رابط Embed الصحيح  
✅ جرب الرابط في متصفح منفصل

---

## 📖 ملفات مرجعية

للمزيد من التفاصيل، راجع:

1. **README.md** - التوثيق الكامل
2. **SETUP_GUIDE.md** - دليل الإعداد المفصل
3. **PROJECT_SUMMARY.md** - ملخص شامل للمشروع

---

## ✅ قائمة المراجعة

قبل البدء، تأكد من:

- [ ] إنشاء مشروع Supabase
- [ ] تنفيذ `supabase_setup.sql`
- [ ] نسخ المفاتيح إلى `.env.local`
- [ ] تشغيل `yarn dev`
- [ ] إنشاء حساب مدير
- [ ] إضافة أول فيلم
- [ ] اختبار المشاهدة

---

## 🎉 النتيجة النهائية

**منصة NOO TV جاهزة بالكامل!**

### ما لديك الآن:
✅ منصة بث احترافية  
✅ نظام مصادقة كامل  
✅ لوحة تحكم قوية  
✅ مشغل فيديو متقدم  
✅ قاعدة بيانات محترفة  
✅ تصميم عصري  
✅ جاهز للنشر  

### ابدأ الآن:
1. نفذ الخطوات أعلاه
2. أضف محتواك
3. انشر للعالم! 🚀

---

<div align="center">

**صُنع بـ ❤️ للمجتمع العربي**

NOO TV © 2025

[📖 التوثيق الكامل](./README.md) | [🚀 دليل الإعداد](./SETUP_GUIDE.md) | [📋 الملخص](./PROJECT_SUMMARY.md)

</div>
