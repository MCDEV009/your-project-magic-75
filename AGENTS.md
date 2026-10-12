# Architecture decisions

- Generate and persist question images only in the authenticated `generate-question-image` Edge Function so AI credentials and privileged storage writes never reach the browser.
- Purchase subscriptions through the atomic `purchase_plan_with_wallet` database function so balance deduction, payment history, and plan activation succeed or roll back together.
- Theme all pages through shared semantic CSS tokens and shared controls so visual updates preserve existing workflows and both themes.
- Keep the procedural Three.js Rasch illustration isolated from scoring logic and dispose its resources on unmount to avoid affecting exam accuracy or navigation performance.