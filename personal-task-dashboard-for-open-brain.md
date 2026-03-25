# Personal Task Dashboard for Open Brain

## Summary

Build a small standalone web app inside this repo, deploy it to Vercel free tier, and keep all database access server-side. The dashboard will read only rows from `thoughts` where `metadata.type = "task"`, derive each task’s effective due date from the earliest valid value in `metadata.dates_mentioned`, sort overdue tasks first and upcoming tasks second, and place undated tasks in a separate section at the bottom.

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

## Data Model Assumptions

The current repo code shows inserts/selects against `thoughts` with at least:

- `content`
- `metadata`
- `embedding`
- `created_at`

The dashboard implementation will require a stable row identifier for deletion.

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
    [key: string]: unknown;
  } | null;
  created_at: string;
};
```

### Conditional schema check

- Confirm that `thoughts.id` already exists in the remote DB.
- If it does not exist, add a migration for `id uuid primary key default gen_random_uuid()`.
- No other schema change is required for v1.

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
- captured date
- optional topic chips from `metadata.topics`

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

### Delete behavior

- Clicking delete opens confirm prompt
- On confirm, call server `DELETE` endpoint
- Remove task from UI immediately after successful response
- If delete fails, show inline error and restore item if optimistic update was used

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

### Supabase query contract

`GET /api/tasks` should query:

- table: `thoughts`
- columns: `id, content, metadata, created_at`
- filter: `metadata->>type = 'task'`

Implementation can use PostgREST-compatible JSON filtering if supported cleanly by Supabase client; otherwise use a SQL RPC/view if the JSON filter proves awkward. Preferred first pass is direct table query with JSON containment because the existing MCP code already uses `contains("metadata", { type })`.

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

### Secret handling

Server-only env vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DASHBOARD_PASSCODE`
- `SESSION_SECRET`

Never expose service role key or passcode to the browser bundle.

## Deployment Plan

### Vercel

- Create Vercel project from this repo
- Set framework to Next.js
- Add env vars above
- Deploy from main branch
- Use the generated Vercel URL for personal access

No custom domain is required for v1.

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

### Edge cases

- malformed `dates_mentioned`
- empty or null `metadata`
- duplicate dates
- same due date on multiple tasks
- task deleted after being marked complete locally
- stale local completed IDs for already-deleted rows

### Manual verification

- Seed or use existing real tasks with overdue, future, and undated examples
- Verify actual ordering against the database contents
- Verify deletion by checking the row no longer exists in Supabase

## Important Changes to Public Interfaces

This adds a new personal dashboard surface but does not change existing MCP or Telegram capture interfaces.

New internal interfaces:

- `POST /api/session`
- `DELETE /api/session`
- `GET /api/tasks`
- `DELETE /api/tasks/:id`

Possible conditional DB change:

- add `thoughts.id` if absent

## Assumptions and Defaults

- `thoughts` already exists and continues to be the single source of truth.
- `metadata.type = "task"` is sufficiently reliable for v1 task filtering.
- `dates_mentioned` values are intended as due-date candidates.
- Earliest valid mentioned date is the effective due date.
- Undated tasks are shown, not hidden.
- Local completion is browser-specific and not shared across devices.
- Deletion is permanent for v1; no soft-delete or trash.
- Server-side Supabase access with service role is acceptable because this is a personal dashboard behind a passcode.
