# Database notes

- التخزين الفعلي داخل النسخة الحالية أصبح **SQLite relational database** في الملف:
  `src/data/return.db`
- تم الإبقاء على `src/data/store.json` كنسخة احتياطية/تصدير سهلة القراءة.
- تمت إضافة **Prisma/PostgreSQL scaffold** داخل:
  - `prisma/schema.prisma`
  - `docker-compose.postgres.yml`

## مشاهدة الجداول الآن
- من داخل الموقع: `/admin/db`
- أو ببرنامج **DB Browser for SQLite** وافتح `src/data/return.db`

## ترقية لاحقة إلى PostgreSQL
- شغل ملف `docker-compose.postgres.yml`
- عدل `DATABASE_URL`
- استخدم `prisma/schema.prisma` كبداية للترحيل الإنتاجي
