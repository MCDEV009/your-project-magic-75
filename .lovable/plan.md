## Maqsad
Admin panelda role-based ruxsat, audit log, 403 sahifasi, hamda to'lov tizimi (coming soon) va Free/Pro/Premium oylik planlar limitlari qo'shiladi.

## 1. Admin xavfsizligi

**Yangi rollar (`app_role` enum):**
- `admin` (mavjud)
- `super_admin` — barcha sahifalar
- `editor` — faqat testlar yaratish/tahrirlash
- `analyst` — faqat analitika va natijalar (read-only)

**`ProtectedRoute` kuchaytirish:**
- `requiredRoles?: app_role[]` propi qo'shiladi
- Server-side `has_role` chaqiriq qoladi
- Ruxsat yo'q bo'lsa → `/403` sahifaga
- Login emas bo'lsa → `/auth?redirect=...`
- Har bir tekshiruv `admin_audit_log` jadvaliga yoziladi (kim, qaysi route, natija, IP/user-agent)

**Yangi sahifalar:**
- `src/pages/Forbidden.tsx` (403 — chiroyli, "Orqaga qaytish")
- `/403` route App.tsx ga qo'shiladi

**Admin panel ichida bo'limlarni cheklash:**
- `Admin.tsx` da har bir tab/section `useUserRoles()` orqali ko'rinadi
- Editor → faqat "Testlar" tab
- Analyst → faqat "Analitika" + "Reytinglar"
- Super admin → hamma narsa + "Foydalanuvchilarni boshqarish"

## 2. Database o'zgarishlari

```text
- ALTER TYPE app_role ADD super_admin, editor, analyst
- CREATE TABLE admin_audit_log (user_id, route, required_roles, granted, ip, user_agent, created_at)
- CREATE TABLE user_plans (user_id, plan ENUM 'free'|'pro'|'premium', started_at, expires_at, status)
- CREATE TABLE usage_counters (user_id, period_month, mocks_taken, ai_requests, image_uploads)
- CREATE TABLE plan_payments (user_id, plan, amount, currency='UZS', status='pending', provider='coming_soon', created_at)
- CREATE TABLE test_pricing (test_id, price_uzs DEFAULT 10000, is_free BOOLEAN DEFAULT false)
- ALTER TABLE tests: visibility enum ga 'paid' qo'shish, 'private' deprecated qilish (migrationda paid ga ko'chirish)
```

RLS: barcha jadvallar uchun, foydalanuvchi faqat o'z yozuvlarini, admin hammasini ko'radi.

## 3. To'lov tizimi (Coming Soon)

- `src/pages/Pricing.tsx` — 3 ta plan kartasi:
  - **Free** — 0 so'm/oy: 5 mock/oy, 10 AI so'rov, 3 rasm yuklash, asosiy tahlil
  - **Pro** — 49 000 so'm/oy: 30 mock, 100 AI, 30 rasm, batafsil AI tahlil, PDF eksport
  - **Premium** — 99 000 so'm/oy: cheksiz mock, cheksiz AI, ustuvor qo'llab-quvvatlash, custom test
- Har bir mock testga **10 000 so'm** yorlig'i (Free akkaunt cheklovidan oshganda)
- "To'lash" tugmasi → modal: *"Tez orada — to'lov usuli qo'shilmoqda"* (bot/karta keyin)
- `plan_payments` ga `pending` status bilan yoziladi (admin ko'rishi uchun)

## 4. Foydalanish limitlari (frontend + backend)

**Hook:** `useUsageLimits()` — joriy oy uchun `usage_counters` o'qiydi va plan limiti bilan solishtiradi.

**Tekshirish joylari:**
- `TestEntry.tsx` — mock boshlashda (Free + 5 dan ko'p → upgrade modal)
- `AIQuestionGenerator.tsx` — AI so'rovlar
- `QuestionImageInput.tsx` — rasm yuklash
- `AlXorazmiyChat.tsx` — chat so'rovlari

Limit oshganda: toast + Pricing sahifaga link.

**Edge function `check-usage-limit`** — har bir AI/rasm so'rovidan oldin server tomonida ham tekshiriladi (frontend bypass qilinmasligi uchun) va `usage_counters` ni `INCREMENT` qiladi.

## 5. "Private/yopiq test" → "Paid test"

- `tests.visibility` migrationi: barcha mavjud `private` → `paid`
- `TestEditor.tsx` da "Yopiq test" radio olib tashlanadi, o'rniga "Pulli test (10 000 so'm)" qo'yiladi
- Public: bepul, Paid: to'lov tushgach kirish
- Test kirishida `paid` bo'lsa va to'lov yo'q bo'lsa → "Coming soon" modal

## 6. Texnik tafsilotlar

**Yangi/o'zgargan fayllar:**
- `supabase/migrations/<ts>_admin_roles_payments.sql`
- `src/components/auth/ProtectedRoute.tsx` (kengaytirish)
- `src/pages/Forbidden.tsx` (yangi)
- `src/pages/Pricing.tsx` (yangi)
- `src/hooks/useUserRoles.tsx` (yangi)
- `src/hooks/useUsageLimits.tsx` (yangi)
- `src/components/UpgradeModal.tsx` (yangi)
- `src/pages/Admin.tsx` (role-based tablar)
- `src/pages/TestEditor.tsx` (visibility o'zgarishi)
- `src/pages/TestEntry.tsx` (paid + limit)
- `src/App.tsx` (yangi routelar)
- `supabase/functions/check-usage-limit/index.ts` (yangi)
- `supabase/functions/al-xorazmiy-chat/index.ts` (limit check qo'shish)
- `supabase/functions/generate-questions/index.ts` (limit check qo'shish)

**Audit logni yozish:** `ProtectedRoute` ichidan `supabase.from('admin_audit_log').insert(...)` — anon ham yozsin (faqat insert, select admin only).

**To'lov:** `provider='coming_soon'` — kelajakda Click/Payme/Uzum integratsiyasi uchun joy qoldiriladi.

## Tasdiqlash kerak
1. Yuqoridagi 3 ta plan narxi (49k/99k so'm) sizga to'g'ri keladimi yoki o'zingiz aytasizmi?
2. Yangi rollarni (`super_admin`, `editor`, `analyst`) qo'shaymi yoki faqat `admin` qoladimi?
3. Mavjud `private` testlar avtomatik `paid` ga o'tkazilsinmi?