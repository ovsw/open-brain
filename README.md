# Open Brain

Open Brain is a lightweight personal knowledge capture system built on Supabase Edge Functions.

Its purpose is simple: capture short thoughts quickly, store them with embeddings and structured metadata, and make them retrievable later through an MCP server or other clients.

## What It Does

- Captures incoming notes and thoughts.
- Generates vector embeddings for semantic search.
- Extracts lightweight metadata such as topics, people, action items, dates, and a thought type.
- Stores everything in a `thoughts` table in Supabase.
- Exposes an MCP server for searching, listing, capturing, and summarizing stored thoughts.
- Accepts Telegram messages as a low-friction capture input.

## Current Architecture

This repository currently contains two main Supabase Edge Functions:

### `capture-telegram`

Receives Telegram webhook events, extracts the message text, saves it as a thought, and replies in Telegram with a short confirmation.

The shared capture flow:

1. Receive a text message from Telegram.
2. Generate an embedding using OpenRouter.
3. Extract metadata with an LLM.
4. Insert the thought, embedding, and metadata into Supabase.
5. Reply to the user with a short capture summary.

### `open-brain-mcp`

Provides an MCP server over the stored thoughts so AI clients can interact with the database directly.

Exposed tools:

- `search_thoughts`: semantic search by meaning
- `list_thoughts`: list recent thoughts with optional filters
- `capture_thought`: save a new thought directly through MCP
- `thought_stats`: summarize counts, types, topics, and people

## Why This Exists

The project is designed around frictionless capture. Instead of forcing notes into a full app workflow, Open Brain lets you send a message from a simple interface such as Telegram and turn it into searchable memory.

The longer-term model is:

- one database of thoughts
- multiple capture sources
- one retrieval layer for AI tools and clients

## Stack

- Supabase Edge Functions
- Supabase database
- TypeScript / Deno
- OpenRouter for embeddings and metadata extraction
- Telegram Bot API for inbound capture
- MCP for AI-client access

## Repository Layout

```text
supabase/functions/_shared/capture.ts      Shared capture pipeline
supabase/functions/capture-telegram/       Telegram webhook handler
supabase/functions/open-brain-mcp/         MCP server for retrieval and capture
telegram-prd.md                            Product requirements for Telegram capture
telegram-plan.md                           Implementation planning notes
```

## In Practice

You can think of Open Brain as a private memory layer:

- send a note from Telegram
- store it with metadata and embeddings
- retrieve it later through semantic search
- let AI tools query or extend that memory through MCP

## Status

This repo appears to be an early, focused implementation of the capture-and-retrieval core. Telegram capture is implemented, and the MCP server already exposes the main memory operations.
