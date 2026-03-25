const SESSION_COOKIE_NAME = "open-brain-dashboard-session";
const SESSION_VALUE = "open-brain-dashboard";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function stringToArrayBuffer(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function createSignature(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    stringToArrayBuffer(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, stringToArrayBuffer(payload));

  return bytesToBase64Url(new Uint8Array(signature));
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function createSessionToken(secret: string): Promise<string> {
  const signature = await createSignature(secret, SESSION_VALUE);
  return `${SESSION_VALUE}.${signature}`;
}

export async function isValidSessionToken(secret: string, token: string | undefined): Promise<boolean> {
  if (!token) {
    return false;
  }

  const [value, signature] = token.split(".");

  if (!value || !signature || value !== SESSION_VALUE) {
    return false;
  }

  const expectedSignature = await createSignature(secret, value);

  return signature === expectedSignature;
}
