# Personal Task Dashboard for Open Brain

## Summary

Build a small standalone web app inside this repo, deploy it to Vercel free tier, and keep all database access server-side. Based on the live Supabase database inspected via MCP on 2026-03-25, the dashboard should read rows from `public.thoughts`, keep filtering on `metadata.type = "task"`, derive each task’s effective due date from the earliest valid value in `metadata.dates_mentioned`, sort overdue tasks first and upcoming tasks second, and place undated tasks in a separate section at the bottom.

The app will support two separate UI actions:

1. `Complete`: local-only state stored in the browser, hidden by default with a toggle to reveal completed tasks.
2. `Delete`: real database deletion of the `thoughts` row.

Because this is personal-use software only, the app will use a single shared passcode with server-issued session cookie protection rather than full Supabase Auth.

## Architecture

### Stack

- Frontend/runtime: Next.js App Router with TypeScript
- Hosting: Vercel free tier
- Data source: existing Supabase Postgres `thoughts` table
- Server-side Supabase access: `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`
- Access control: simple passcode form + signed HTTP-only session cookie via Next.js middleware / server route

### Why this shape

- No existing frontend app is present in the repo.
- You do not need multi-user auth.
- Deletion must be real and safe, so database writes should not come from an unauthenticated browser client.
- Vercel fits a small personal dashboard with server routes and environment variables cleanly on the free plan.

### Implementation target

Build this as a single Next.js app in the repo root with:

- `app/` for routes and server handlers
- `components/` for task list UI
- `lib/` for auth, Supabase server client, and task transformation logic
- `middleware.ts` for route protection

No separate backend service is required for v1.

## Verified Database Shape

The live Supabase database currently has one relevant table for this dashboard:

- `public.thoughts`
- RLS enabled
- current columns:
  - `id uuid primary key default gen_random_uuid()`
- `content`
- `embedding`
- `metadata jsonb default '{}'::jsonb`
- `created_at`
- `updated_at`

### Required row shape for dashboard

```ts
type ThoughtTaskRow = {
  id: string;
  content: string;
  metadata: {
    type?: string;
    dates_mentioned?: string[];
    topics?: string[];
    action_items?: string[];
    people?: string[];
    source?: string;
    telegram_chat_id?: string;
    telegram_chat_type?: string;
    telegram_message_id?: string;
    telegram_username?: string;
    [key: string]: unknown;
  } | null;
  created_at: string;
  updated_at: string | null;
};
```

### Current data snapshot

- Current row count is small (`4` rows at inspection time).
- All current rows already have `metadata.type = "task"`.
- Shared metadata keys across all current rows:
  - `type`
  - `source`
  - `topics`
  - `action_items`
  - `people`
  - `dates_mentioned`
- Telegram-specific metadata appears on most, but not all, rows.
- `dates_mentioned` is usually empty in the current dataset, so v1 UX should treat undated tasks as a normal case, not an edge case.

### Schema implications

- No schema migration is required for v1 to support deletion; `id` already exists and is usable.
- `updated_at` exists but does not need to drive sorting in v1.
- `action_items` exists on every current row, but `content` should remain the primary display field for v1 because it preserves more context.

## Task Selection and Sorting Rules

### Inclusion rule

Include only rows where `metadata.type = "task"`.

Do not include non-task thoughts even if they contain `action_items`.

### Effective due date

For each included row:

1. Read `metadata.dates_mentioned`.
2. Keep only valid `YYYY-MM-DD` values.
3. Convert them to dates in local-app logic.
4. Pick the earliest valid date as `effectiveDueDate`.

### Grouping and ordering

Use three groups in this exact order:

1. Overdue
2. Upcoming
3. No due date

Definitions:

- `overdue`: effective due date is before today
- `upcoming`: effective due date is today or later
- `no due date`: no valid date found

Ordering inside groups:

- `overdue`: ascending by `effectiveDueDate` so the oldest overdue item is highest
- `upcoming`: ascending by `effectiveDueDate` so the nearest future item is highest
- `no due date`: descending by `created_at`

Tie-breaker for equal due dates: descending by `created_at`.

### Date handling rules

- Treat `dates_mentioned` values as date-only values in `YYYY-MM-DD` format.
- Compare due dates against the dashboard viewer's current day using a single server-side timezone baseline for each response.
- For v1, use UTC consistently in server logic to avoid ambiguous per-browser grouping.
- Expose `generatedAt` in the API response so client-side debugging can confirm the server evaluation moment.

## UI Specification

### Main screen

Show:

- Header with title and counts
- Toggle: `Show completed`
- Section: `Overdue`
- Section: `Upcoming`
- Section: `No due date`

Each task card shows:

- task text from `content`
- effective due date label if present
- overdue/upcoming badge
- captured date from `created_at`
- optional topic chips from `metadata.topics`
- optional source label from `metadata.source` only if it helps disambiguate origin without cluttering the card

Each card has two separate controls:

- `Complete`
- `Delete`

### Complete behavior

- Stored in `localStorage` only
- Key: `open-brain-completed-task-ids-v1`
- Value: JSON string array of task IDs
- Default view hides completed tasks
- `Show completed` toggle reveals them in-place with muted/struck styling
- No sync to database
- No cross-device sync
- If a completed ID is no longer present in the fetched dataset, silently drop it from local state on the next write

### Delete behavior

- Clicking delete opens confirm prompt
- On confirm, call server `DELETE` endpoint
- Remove task from UI immediately after successful response
- If delete fails, show inline error and restore item if optimistic update was used
- Disable the delete button while the request is in flight for that row
- Do not allow delete from the browser without an authenticated session cookie

## App Interfaces

### Server routes

#### `POST /api/session`

Purpose:
- validate submitted passcode
- set signed HTTP-only cookie

Request:
```ts
{ passcode: string }
```

Response:
```ts
{ ok: true }
```

Failure response:
```ts
{ ok: false, error: "INVALID_PASSCODE" }
```

#### `DELETE /api/session`

Purpose:
- clear session cookie

Response:
```ts
{ ok: true }
```

#### `GET /api/tasks`

Purpose:
- fetch all task rows, derive grouping/sorting server-side, return dashboard DTOs

Response:
```ts
type TaskDto = {
  id: string;
  content: string;
  createdAt: string;
  effectiveDueDate: string | null;
  status: "overdue" | "upcoming" | "undated";
  topics: string[];
  source: string | null;
};

type TasksResponse = {
  overdue: TaskDto[];
  upcoming: TaskDto[];
  undated: TaskDto[];
  generatedAt: string;
};
```

#### `DELETE /api/tasks/:id`

Purpose:
- delete one `thoughts` row by ID in Supabase

Response:
```ts
{ ok: true, id: string }
```

Failure responses:
```ts
{ ok: false, error: "UNAUTHORIZED" | "NOT_FOUND" | "DELETE_FAILED" }
```

### Supabase query contract

`GET /api/tasks` should query:

- table: `public.thoughts`
- columns: `id, content, metadata, created_at, updated_at`
- filter: `metadata->>type = 'task'`

Implementation can use PostgREST-compatible JSON filtering if supported cleanly by Supabase client; otherwise use a SQL RPC/view if the JSON filter proves awkward. Preferred first pass is direct table query with JSON containment because the existing MCP code already uses `contains("metadata", { type })`.

Given the current dataset, the API should also normalize these cases explicitly:

- missing or non-object `metadata` -> treat as non-task and exclude
- missing `topics` -> return `[]`
- missing or invalid `dates_mentioned` -> return `effectiveDueDate: null`
- missing `source` -> return `null`
- present but empty `action_items` -> ignore for v1 display

### Task transformation contract

Use one shared transformation function in `lib/` that:

1. accepts raw `ThoughtTaskRow[]`
2. filters rows to valid tasks
3. derives `effectiveDueDate`
4. maps rows to `TaskDto`
5. returns grouped `TasksResponse`

This function should be covered by unit tests because it contains the core business logic of the dashboard.

## Security Model

### Access control

Use one shared passcode stored in Vercel env, for example:

- `DASHBOARD_PASSCODE`

Session behavior:

- password form on first visit
- successful login sets signed HTTP-only cookie
- middleware protects `/` and `/api/tasks*`
- cookie expiry: 30 days
- logout button clears cookie

Recommended cookie settings:

- `httpOnly: true`
- `secure: true` in production
- `sameSite: "lax"`
- `path: "/"`
- signed or HMAC-validated value using `SESSION_SECRET`

### Secret handling

Server-only env vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DASHBOARD_PASSCODE`
- `SESSION_SECRET`

Never expose service role key or passcode to the browser bundle.

### Route protection scope

Protect these with middleware or equivalent server checks:

- `/`
- `/api/tasks`
- `/api/tasks/:id`

Do not protect `POST /api/session`, or login becomes impossible.

## Deployment Plan

### Vercel

- Create Vercel project from this repo
- Set framework to Next.js
- Add env vars above
- Deploy from main branch
- Use the generated Vercel URL for personal access

No custom domain is required for v1.

### Environment checklist

- `SUPABASE_URL` points at the live project already inspected via MCP
- `SUPABASE_SERVICE_ROLE_KEY` has delete access to `public.thoughts`
- `DASHBOARD_PASSCODE` is long and unique
- `SESSION_SECRET` is at least 32 random bytes encoded as a string

## Implementation Plan

### Phase 1: App scaffold

- Initialize Next.js App Router app in repo root
- Add TypeScript, ESLint, and minimal styling
- Add environment variable loading and validation

### Phase 2: Server foundations

- Implement server-only Supabase client helper
- Implement session cookie create/verify/clear helpers
- Add middleware protection for the dashboard and task APIs

### Phase 3: Task read path

- Implement `GET /api/tasks`
- Implement shared task transformation and grouping logic
- Render dashboard sections from server-fetched data

### Phase 4: Client interactions

- Implement local completed-task state
- Implement delete flow with optimistic removal and error recovery
- Add logout action

### Phase 5: Verification

- Add unit tests for transformation logic
- Manually verify login, ordering, undated handling, and deletion against Supabase

## Testing and Acceptance Criteria

### Functional cases

1. Login with correct passcode grants access and persists session.
2. Login with wrong passcode denies access.
3. Only rows with `metadata.type = "task"` appear.
4. Tasks with past due dates appear in `Overdue`.
5. Tasks with today/future dates appear in `Upcoming`.
6. Tasks with no valid date appear in `No due date`.
7. Multiple dates in one row use the earliest valid date.
8. Completed tasks disappear from default view after marking complete.
9. Completed tasks reappear when `Show completed` is enabled.
10. Completed state survives page reload in the same browser.
11. Delete removes the row from Supabase and from the UI.
12. Delete failure shows an error and does not silently lose the row.
13. Unauthorized requests to protected routes are redirected or rejected consistently.
14. Rows with missing optional metadata still render without runtime errors.

### Edge cases

- malformed `dates_mentioned`
- empty or null `metadata`
- duplicate dates
- same due date on multiple tasks
- task deleted after being marked complete locally
- stale local completed IDs for already-deleted rows
- network failure during initial task load
- session cookie expired while dashboard is open

### Manual verification

- Use the current real dataset as the starting point:
  - one row currently resolves to an overdue date from `dates_mentioned = ["2023-10-23"]`
  - the other current rows are undated
- Add or seed at least one future-dated task before signing off the `Upcoming` section behavior
- Verify actual ordering against the database contents
- Verify deletion by checking the row no longer exists in Supabase

## Important Changes to Public Interfaces

This adds a new personal dashboard surface but does not change existing MCP or Telegram capture interfaces.

New internal interfaces:

- `POST /api/session`
- `DELETE /api/session`
- `GET /api/tasks`
- `DELETE /api/tasks/:id`

## Assumptions and Defaults

- `thoughts` already exists and continues to be the single source of truth.
- `metadata.type = "task"` is sufficiently reliable for v1 task filtering.
- Current live data suggests all existing rows are tasks today, but the filter should remain in place so non-task rows can coexist later.
- `dates_mentioned` values are intended as due-date candidates.
- Earliest valid mentioned date is the effective due date.
- Due-date grouping is computed server-side using UTC for v1 consistency.
- Undated tasks are shown, not hidden.
- Local completion is browser-specific and not shared across devices.
- Deletion is permanent for v1; no soft-delete or trash.
- Server-side Supabase access with service role is acceptable because this is a personal dashboard behind a passcode.
