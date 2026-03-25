# Telegram Capture Integration Handoff

## Purpose

Implement **Option A: Telegram as a capture-only interface** inside the existing `open-brain` repo.

The goal is to let a user send a text message to a Telegram bot and have that message flow into the existing Open Brain ingestion pipeline, be stored in the `thoughts` table, receive embeddings and metadata, and send a confirmation reply back in Telegram.

This should be implemented as a **small extension to the current architecture**, not a redesign.

---

## Required Outcome

Add a new Supabase Edge Function named `capture-telegram` that:

1. Receives Telegram webhook POSTs
2. Accepts only valid text messages
3. Reuses the repo’s existing ingestion patterns
4. Stores the message in `thoughts`
5. Adds `source: "telegram"` to metadata
6. Sends a confirmation reply back to Telegram

---

## Architectural Constraints

Keep the existing Open Brain architecture intact.

* Do **not** change the role of `open-brain-mcp`
* Do **not** make Telegram an MCP client
* Do **not** introduce a second server or app layer
* Do **not** redesign the database schema unless truly necessary
* Treat Telegram as **just another capture source**

The system should remain:

* one Supabase database
* one MCP server
* multiple capture interfaces

---

## Implementation Instructions

### 1. Inspect the existing repo before making changes

Before coding:

* inspect `supabase/functions`
* locate current capture / ingestion logic
* find where embeddings are generated
* find where metadata extraction happens
* find where inserts into `thoughts` happen
* check whether Slack capture already exists in this repo
* check whether there is already a `_shared` helper module

Preserve the project’s current conventions for:

* model/provider usage
* environment variables
* metadata shape
* insert patterns

---

### 2. Add a new Supabase Edge Function

Create:

```text
supabase/functions/capture-telegram/index.ts
```

This function should be deployable with:

```bash
supabase functions deploy capture-telegram --no-verify-jwt
```

Use `--no-verify-jwt` because Telegram will call the function directly by webhook.

---

### 3. Validate the webhook using a secret path segment

The webhook URL should follow this pattern:

```text
https://<project-ref>.supabase.co/functions/v1/capture-telegram/<secret>
```

The function must:

* read the last path segment as the webhook secret
* compare it with `TELEGRAM_WEBHOOK_SECRET`
* return `404` if it does not match
* avoid returning helpful diagnostic details for invalid requests

---

### 4. Parse only Telegram text messages

Support only:

* `update.message.text`

Ignore and return `200 OK` for:

* non-text updates
* edited messages
* callback queries
* channel posts
* empty text after trimming

This is **text-only v1**.

---

### 5. Ignore basic commands

Ignore and return `200 OK` for at least:

* `/start`
* `/help`

No command system is required in this task.

---

### 6. Support optional chat allowlisting

Read optional environment variable:

```text
TELEGRAM_ALLOWED_CHAT_ID
```

Behavior:

* if set, only accept messages from that chat
* quietly ignore messages from other chats and return `200`
* do not build multi-user support

This bot is intended for private capture.

---

### 7. Reuse existing capture pipeline logic

Use the repo’s current ingestion pipeline wherever possible.

That includes the existing approach for:

* embedding generation
* metadata extraction
* insert into `thoughts`

If reusable helpers already exist, use them.

If the logic is duplicated and a small extraction would clearly help, add a shared helper such as:

```text
supabase/functions/_shared/capture.ts
```

Possible shared functions:

```ts
generateEmbedding(text: string): Promise<number[]>
extractMetadata(text: string): Promise<Record<string, unknown>>
insertThought(args): Promise<void>
```

Do **not** do a broad refactor. Keep changes minimal and safe.

---

### 8. Generate embeddings using the existing project setup

Use the embedding provider and configuration already used by the repo.

Expected default in this system is:

* `openai/text-embedding-3-small`
* 1536 dimensions

Do not change vector dimensions.

---

### 9. Extract metadata using the existing project setup

Use the current metadata extraction pattern already present in the repo.

Expected fields, if consistent with the current setup, may include:

* `people`
* `action_items`
* `dates_mentioned`
* `topics`
* `type`

If the repo uses a different metadata schema, preserve that schema and extend it minimally.

---

### 10. Insert captured messages into `thoughts`

Insert into the existing `thoughts` table using the same insert shape already used by the project.

Store the message text as the captured content.

Add Telegram-specific metadata into the JSON metadata payload, including:

```json
{
  "source": "telegram",
  "telegram_chat_id": "...",
  "telegram_message_id": "...",
  "telegram_username": "...",
  "telegram_chat_type": "private"
}
```

If the current repo has an established source metadata convention, follow that convention.

---

### 11. Send a Telegram confirmation reply

After a successful insert, call the Telegram Bot API `sendMessage` endpoint and reply to the original message.

The reply should be short and useful.

Acceptable examples:

* `Captured.`
* `Captured as idea.`
* `Captured — topics: hiring, org structure.`

Keep formatting simple.

If the confirmation send fails, log the error clearly.

---

## Required Environment Variables

The implementation must support these environment variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
```

It must also reuse the existing environment variables already used by the repo for embeddings and metadata extraction.

Optional:

```text
TELEGRAM_ALLOWED_CHAT_ID
```

---

## Setup Documentation to Add

Add brief documentation covering:

1. how to create a Telegram bot with BotFather
2. where to place the bot token
3. how to set the webhook secret
4. how to get the allowed chat ID
5. how to deploy the function
6. how to register the webhook

Include the webhook registration pattern:

```text
https://<project-ref>.supabase.co/functions/v1/capture-telegram/<secret>
```

Include an example command such as:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<project-ref>.supabase.co/functions/v1/capture-telegram/<secret>"}'
```

Keep the documentation short and implementation-focused.

---

## Logging Requirements

Add logs that are useful in Supabase Edge Function logs.

Log at least:

* webhook received
* ignored unsupported update type
* rejected non-allowed chat
* embedding failure
* metadata extraction failure
* database insert failure
* Telegram reply failure

Do not log secrets.

---

## Validation Checklist

The implementation is complete when all of the following are true:

* a Telegram text message reaches the webhook
* the function parses the update successfully
* the content is inserted into `thoughts`
* the row includes embedding data
* the metadata includes `source: "telegram"`
* Telegram metadata fields are stored
* a confirmation reply is sent back to Telegram
* ignored update types return `200`
* invalid secret path returns `404`
* optional chat allowlist works
* logs are sufficient for debugging in Supabase

---

## Out of Scope

Do not implement any of the following in this task:

* `/search`
* `/recent`
* `/stats`
* edit support
* delete support
* image capture
* audio transcription
* OCR
* group workflow design
* multi-user support
* deduplication
* calling MCP from Telegram

---

## Expected Files

This work will likely touch some subset of:

```text
supabase/functions/capture-telegram/index.ts
supabase/functions/_shared/capture.ts
README.md
docs/telegram-capture.md
.env.example
```

Only add `_shared/capture.ts` if it clearly improves reuse with minimal risk.

---

## Code Quality Requirements

* match the repo’s existing TypeScript and Supabase Edge Function style
* keep functions readable and small
* reuse current model/provider configuration
* preserve schema assumptions
* avoid unnecessary dependencies
* add comments only where behavior is not obvious
* keep v1 narrow and reliable

---

## Build Prompt

Use the following instruction as the direct execution brief:

```text
Implement Telegram capture-only integration inside this existing open-brain repo.

Requirements:
- Add a new Supabase Edge Function at supabase/functions/capture-telegram/index.ts
- Telegram should be a capture source only, not an MCP client
- Accept Telegram webhook POSTs and validate a secret path segment
- Parse only update.message.text
- Ignore unsupported updates and basic commands like /start and /help
- Reuse existing embedding, metadata extraction, and thoughts insert patterns already present in the repo
- Insert captured text into the existing thoughts table
- Add metadata.source = "telegram" plus telegram_chat_id, telegram_message_id, telegram_username, telegram_chat_type
- Reply to the original Telegram message using the Telegram Bot API
- Support optional TELEGRAM_ALLOWED_CHAT_ID filtering
- Add minimal docs for setup, secrets, deploy, and webhook registration
- Do not redesign the architecture
- Do not modify MCP behavior
- Keep the implementation narrow, safe, and text-only

Before coding:
1. Inspect the repo structure and identify the current ingestion pipeline
2. Reuse shared logic if it exists
3. Only extract a shared helper if it clearly reduces duplication with minimal risk

After coding:
- Summarize the files changed
- Explain any assumptions about existing repo structure
- Provide exact deploy and setup commands
```

---

## Final Reminder

The correct implementation is a **small extension** to the existing Open Brain system.

Telegram should behave like another capture source, not a new platform layer.
