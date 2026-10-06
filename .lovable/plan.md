# Pullik full mock va AI rasmlar

## Maqsad
- AI yaratgan har bir full mock testni `private` emas, `paid` holatida chiqarish.
- Narxni mavjud standart bo‘yicha 10 000 so‘m qilib yozish, shunda test umumiy ro‘yxatda ko‘rinadi va mavjud hamyon orqali sotib olinadi.
- Rasm kerak bo‘ladigan savollarni AI o‘zi belgilashi va shu savollar uchun alohida, matnsiz imtihon diagrammasi/rasmini yaratishi.

## Amalga oshirish
1. Savol generatori javobiga `needs_image` va `image_prompt` maydonlarini qo‘shish; faqat rasm masalani yechish uchun zarur bo‘lganda belgilash.
2. Admin uchun himoyalangan `generate-question-image` xizmatini qo‘shish:
   - Lovable AI orqali rasm yaratadi;
   - natijani `question-images` saqlash joyiga yozadi;
   - savolga ishlaydigan rasm manzilini qaytaradi;
   - limit va xizmat xatolarini aniq ko‘rsatadi.
3. Full mock saqlangach, rasm talab qilgan savollar uchun rasmlarni navbat bilan yaratish va `image_url` maydoniga yozish.
4. Testni `paid` qilish va `test_pricing` jadvaliga 10 000 so‘mlik narx yozish. Narx yozilmasa yarim tayyor testni qoldirmaslik.
5. Jarayon oynasida “savollar”, “rasmlar”, “saqlash” bosqichlarini aniq ko‘rsatish; ayrim rasm muvaffaqiyatsiz bo‘lsa testni saqlab, qaysi rasm yaratilmaganini ogohlantirish.

## Tekshiruv
- TypeScript tekshiruvi.
- Yangi rasm xizmatini haqiqiy so‘rov bilan sinash.
- Yaratilgan full mock `paid` ekanini, narxi yozilganini va rasmli savolda `image_url` saqlanganini tekshirish.
