function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getDashboardPasscode(): string {
  return getRequiredEnv("DASHBOARD_PASSCODE");
}

export function getSessionSecret(): string {
  return getRequiredEnv("SESSION_SECRET");
}

export function getSupabaseEnv() {
  return {
    url: getRequiredEnv("SUPABASE_URL"),
    serviceRoleKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
