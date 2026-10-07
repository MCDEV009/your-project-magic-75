# Architecture decisions

- Generate and persist question images only in the authenticated `generate-question-image` Edge Function so AI credentials and privileged storage writes never reach the browser.
- Purchase subscriptions through the atomic `purchase_plan_with_wallet` database function so balance deduction, payment history, and plan activation succeed or roll back together.