# Architecture decisions

- Generate and persist question images only in the authenticated `generate-question-image` Edge Function so AI credentials and privileged storage writes never reach the browser.
- Purchase subscriptions through the atomic `purchase_plan_with_wallet` database function so balance deduction, payment history, and plan activation succeed or roll back together.
- Theme all pages through shared semantic CSS tokens and shared controls so visual updates preserve existing workflows and both themes.
- Provide language context at the application root so shared navigation renders safely on every route, including authentication and live pages.
- Keep the procedural Three.js Rasch illustration isolated from scoring logic and dispose its resources on unmount to avoid affecting exam accuracy or navigation performance.- Verify bot checks (math captcha) and accept public feedback only in the `captcha` Edge Function using an HMAC-signed, expiring challenge so answers and the signing secret never reach the browser and feedback rows are written server-side.
- Read tracking permission only through `src/lib/consent.ts` (`canTrack`/`readChoice`) so every tag follows the visitor's cookie choice.
