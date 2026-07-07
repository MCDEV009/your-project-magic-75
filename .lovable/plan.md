# Live Mock Test Feature

A synchronized live exam mode where all participants start the same 45-question test at the same moment, take it under a shared countdown, and only see their results — including Rasch ability, T-score, ranking, and analysis — after the session ends.

## Scope

- Admin creates a **Live Session** tied to an existing 45-question test with `test_format = 'milliy_sertifikat'`.
- Admin sets a scheduled start time and duration (default 90 min).
- Participants join a lobby via a session code, see a live participant list, wait for the countdown, then all start together.
- During the test: results, scores, and ranking are hidden.
- Session ends when either (a) everyone has finished or (b) the timer expires. On end, Rasch scoring runs across the whole cohort and results are published.
- Each participant gets: score, θ (theta), T-score, rank, and per-question analysis (reuses existing `evaluate-written-answers` output).

## Data model

New tables (all under `public`, with grants + RLS):

- `live_sessions` — `id, test_id, code, host_user_id, status ('scheduled'|'lobby'|'running'|'ended'), starts_at, duration_seconds, ends_at, published_at`.
- `live_participants` — `id, session_id, user_id (nullable), participant_id, display_name, joined_at, attempt_id (nullable), finished_at`.
- Add `session_id uuid` column to `test_attempts` so existing attempt/scoring flow works unchanged.

RLS:
- `live_sessions`: anyone can `SELECT` a session by code (public join); only host/admin can update.
- `live_participants`: participant can read own row + roster of same session; only insert for themselves.
- Result reads gated by `sessions.status = 'ended' AND published_at IS NOT NULL`.

Realtime: enable `supabase_realtime` publication on both tables so lobby + participant tracker update live.

## Edge functions

- `start-live-session` — host-only. Flips status to `running`, sets `ends_at = now() + duration`.
- `finalize-live-session` — triggered when all participants finished OR timer elapsed (called by client watchdog, idempotent). Runs Rasch across the cohort using existing logic in `evaluate-written-answers`, computes per-participant θ + T-score using the whole session as the norm group, marks `status='ended'`, sets `published_at`.

## Frontend

New routes:
- `/live` — enter session code, join lobby.
- `/live/:code/lobby` — shows roster, countdown to `starts_at`, "waiting for host" state.
- `/live/:code/test` — wraps existing `TestInterface` in a live-mode container that:
  - enforces synchronized `ends_at` timer,
  - blocks results screen,
  - auto-submits on timeout,
  - marks `finished_at` on `live_participants`.
- `/live/:code/results` — only accessible after `published_at`. Shows rank table + own detailed Rasch analysis (reuses `Results.tsx` components).

Admin additions (in `Admin.tsx`):
- New "Live Sessions" tab: create session (pick test, start time, duration), see live participant count, "Start now" / "End now" buttons, and a link to results.

## Rasch scoring

Reuse `estimateItemDifficulties` + `estimateAbility` + `calculateTScore` from `evaluate-written-answers`, but run **once per session** against all session attempts as the norm group (instead of the whole test history) so the cohort is comparable. Fallback to global attempts when the session has <5 finishers.

## Technical details

- Session code: 6-char alphanumeric via new SQL helper `generate_session_code()`.
- Client uses `supabase.channel('live:'+code)` for realtime; server relies on Postgres triggers to keep `finished_at` in sync (`AFTER UPDATE ON test_attempts WHEN status='finished'` updates the participant row).
- Watchdog: any active participant polls `live_sessions` every 5s while running; when `now() >= ends_at` OR everyone finished, first client to notice calls `finalize-live-session` (idempotent).
- Full-screen enforcement already exists in `TestInterface` — reused as-is.
- i18n: add UZ/RU/EN/QQ keys under `live.*` in `src/lib/i18n.ts`.

```text
Host                Participants
  |                    |
  |--create session--->|  (lobby, realtime roster)
  |--start----------->>|  synchronized ends_at
  |                    |  take test (results hidden)
  |<--finish-----------|
  |--finalize-------->>|  Rasch runs on cohort
  |                    |  results published
```

## Out of scope

- Chat during the session.
- Reconnect-during-running is already handled by existing progress-save code.
- Payments/entry fees for live sessions.
