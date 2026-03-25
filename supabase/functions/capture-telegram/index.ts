import "@supabase/functions-js/edge-runtime";

import {
  buildCaptureConfirmation,
  captureThought,
} from "../_shared/capture.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")!;
const TELEGRAM_ALLOWED_CHAT_ID = Deno.env.get("TELEGRAM_ALLOWED_CHAT_ID");

type TelegramUpdate = {
  message?: {
    message_id: number;
    text?: string;
    chat?: {
      id: number;
      type?: string;
    };
    from?: {
      username?: string;
    };
  };
};

function response(status = 200): Response {
  return new Response("ok", { status });
}

function getSecretFromPath(url: string): string | null {
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  return segments.at(-1) ?? null;
}

function shouldIgnoreCommand(text: string): boolean {
  return text === "/start" || text === "/help";
}

async function sendTelegramReply(
  chatId: number,
  messageId: number,
  text: string,
): Promise<void> {
  const telegramResponse = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_to_message_id: messageId,
      }),
    },
  );

  if (!telegramResponse.ok) {
    const message = await telegramResponse.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed: ${telegramResponse.status} ${message}`);
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return response(405);
  }

  const providedSecret = getSecretFromPath(request.url);
  if (!providedSecret || providedSecret !== TELEGRAM_WEBHOOK_SECRET) {
    return response(404);
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return response();
  }

  const message = update.message;
  const text = message?.text?.trim();
  const chatId = message?.chat?.id;

  if (!message || !text || !chatId) {
    return response();
  }
// Logs to find out the Telegram chat ID
  // console.log("telegram incoming message", {
  //   chat_id: String(chatId),
  //   chat_type: message.chat?.type ?? null,
  //   username: message.from?.username ?? null,
  //   text,
  // });

  if (shouldIgnoreCommand(text)) {
    return response();
  }

  // logs to check if the telegram chat ID is actually being enforced
  // if (TELEGRAM_ALLOWED_CHAT_ID) {
  //   const isAllowedChat = String(chatId) === TELEGRAM_ALLOWED_CHAT_ID;
  //   console.log("telegram allowlist check", {
  //     allowed_chat_configured: true,
  //     chat_id: String(chatId),
  //     allowed: isAllowedChat,
  //   });

  //   if (!isAllowedChat) {
  //     return response();
  //   }
  // } else {
  //   console.log("telegram allowlist check", {
  //     allowed_chat_configured: false,
  //     chat_id: String(chatId),
  //     allowed: true,
  //   });
  // }

  try {
    const metadata = await captureThought({
      content: text,
      source: "telegram",
      metadata: {
        telegram_chat_id: String(chatId),
        telegram_message_id: String(message.message_id),
        telegram_username: message.from?.username ?? null,
        telegram_chat_type: message.chat?.type ?? null,
      },
    });

    try {
      await sendTelegramReply(
        chatId,
        message.message_id,
        buildCaptureConfirmation(metadata),
      );
    } catch (error) {
      console.error("Failed to send Telegram confirmation", error);
    }

    return response();
  }
  catch (error) {
    console.error("Failed to capture Telegram message", error);
    return new Response("error", { status: 500 });
  }
});
