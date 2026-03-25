# 📄 PRD: Telegram Capture Integration (Option A)

## 1. Overview

This document defines the requirements for integrating **Telegram as a capture interface** into the Open Brain system.

The goal is to allow a user to send messages to a Telegram bot and have each message:

1. Processed through the existing Open Brain ingestion pipeline
2. Stored in the `thoughts` table
3. Embedded for semantic search
4. Enriched with metadata
5. Confirmed via a Telegram reply

This integration mirrors the existing Slack capture system but uses Telegram as the input source.

---

## 2. Goals

### Primary Goal

Enable **frictionless thought capture via Telegram** with minimal changes to the existing architecture.

### Secondary Goals

* Maintain architectural consistency with Open Brain principles
* Reuse existing embedding + metadata pipeline
* Keep Telegram as a **capture-only interface**
* Ensure secure, private ingestion (single-user or allowlist)

---

## 3. Non-Goals

This version explicitly does NOT include:

* MCP integration inside Telegram
* Editing or deleting thoughts
* Multi-user support
* File/image/audio ingestion
* Advanced Telegram commands (`/search`, `/stats`, etc.)

---

## 4. System Architecture

### High-Level Flow

```
Telegram Message
    ↓
Telegram Webhook
    ↓
Supabase Edge Function (capture-telegram)
    ↓
Embedding + Metadata Extraction
    ↓
Insert into thoughts table
    ↓
Send confirmation via Telegram API
```

### Key Principles

* Open Brain remains:

  * One Supabase database
  * One MCP server (`open-brain-mcp`)
* Telegram is a **capture source only**
* No changes to MCP server required

---

## 5. Functional Requirements

### 5.1 Telegram Bot Integration

The system must:

* Accept webhook POST requests from Telegram
* Parse incoming updates
* Extract text messages from:

  * `update.message.text`

The system must ignore:

* Non-text messages
* Edited messages
* Channel posts
* Empty messages

---

### 5.2 Edge Function: `capture-telegram`

Create a new Supabase Edge Function:

```
supabase/functions/capture-telegram
```

#### Responsibilities

1. Validate request (via secret path)
2. Parse Telegram payload
3. Extract message content
4. Generate embedding
5. Extract metadata
6. Insert into `thoughts`
7. Send confirmation reply

---

### 5.3 Message Processing

For each valid message:

#### Input

```json
{
  "text": "Marcus wants to move to the platform team"
}
```

#### Processing Steps

1. Trim text
2. Ignore commands (`/start`, `/help`)
3. Generate embedding using:

   * `openai/text-embedding-3-small`
4. Extract metadata using:

   * `openai/gpt-4o-mini`
5. Insert into database

---

### 5.4 Database Insert

Insert into `thoughts` table:

```ts
{
  content: string,
  embedding: number[],
  metadata: jsonb
}
```

#### Metadata Requirements

Must include:

```json
{
  "source": "telegram",
  "telegram_chat_id": "...",
  "telegram_message_id": "...",
  "telegram_username": "...",
  "telegram_chat_type": "private"
}
```

Also include extracted metadata:

* `people`
* `topics`
* `action_items`
* `dates_mentioned`
* `type`

---

### 5.5 Telegram Response

After successful insert, send a reply:

#### Example Response

```
Captured as idea — hiring, org structure
People: Marcus
Action items: follow up on transfer
```

#### Requirements

* Reply to original message
* Use `sendMessage` API
* Fail gracefully if send fails

---

### 5.6 Access Control

System must support:

* Optional `TELEGRAM_ALLOWED_CHAT_ID`
* If set:

  * Only accept messages from that chat
* If not set:

  * Accept all messages (not recommended)

---

### 5.7 Webhook Security

Webhook must:

* Use a **secret path segment**

Example:

```
/capture-telegram/<secret>
```

Requests without correct secret must return:

```
404 Not Found
```

---

## 6. Non-Functional Requirements

### 6.1 Performance

* Must respond within Telegram timeout (~10 seconds)
* Embedding + metadata should run in parallel

---

### 6.2 Reliability

* Return `200 OK` for:

  * Ignored messages
  * Unsupported formats
* Return `500` only on real failures

---

### 6.3 Idempotency (Future Consideration)

Not required for v1, but note:

* Telegram may retry failed requests
* Duplicate entries are possible

---

### 6.4 Observability

Must log:

* Incoming updates
* Errors from:

  * embedding API
  * metadata extraction
  * database insert
  * Telegram API

Primary debugging surface:

* Supabase Edge Function logs

---

## 7. Configuration

### Required Secrets

Set via Supabase:

```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
```

### Optional

```bash
TELEGRAM_ALLOWED_CHAT_ID
```

---

## 8. Deployment Requirements

### 8.1 Create Function

```bash
supabase functions new capture-telegram
```

### 8.2 Deploy

```bash
supabase functions deploy capture-telegram --no-verify-jwt
```

---

### 8.3 Set Telegram Webhook

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<PROJECT_REF>.supabase.co/functions/v1/capture-telegram/<SECRET>"}'
```

---

## 9. Code Structure

### Recommended Structure

```
supabase/functions/
  capture-telegram/
    index.ts

  _shared/
    capture.ts   (optional but recommended)
```

---

### Shared Logic (Recommended Refactor)

Extract reusable logic:

```ts
generateEmbedding(text)
extractMetadata(text)
insertThought(content, metadata, embedding)
```

This enables:

* Reuse across Slack, Telegram, future sources
* Cleaner architecture
* Easier extension

---

## 10. Testing Plan

### Manual Tests

1. Send message via Telegram
2. Confirm:

   * Row appears in `thoughts`
   * Metadata includes `"source": "telegram"`
   * Embedding is non-null
   * Telegram reply is received

---

### Edge Cases

Test:

* Empty message
* `/start` command
* Non-allowed chat_id
* Large message
* API failure simulation

---

## 11. Acceptance Criteria

The feature is complete when:

* ✅ Telegram messages are successfully captured
* ✅ Thoughts are inserted into database
* ✅ Embeddings are generated
* ✅ Metadata is extracted and stored
* ✅ Telegram confirmation is sent
* ✅ Unauthorized chats are blocked (if configured)
* ✅ Errors are visible in logs

---

## 12. Future Extensions (Not in Scope)

* `/search` command (semantic search)
* `/recent` command
* `/stats` command
* Voice → text transcription
* Image OCR ingestion
* Deduplication layer
* Multi-user support

---

## 13. Key Architectural Reminder

This integration must preserve the core Open Brain model:

> **One MCP server + one database + multiple capture sources**

Telegram is **just another ingestion path**, not a new system layer.
