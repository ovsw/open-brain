import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <Card className="w-full max-w-xl overflow-hidden">
        <CardHeader className="space-y-6 pb-5">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-[0.36em] text-muted-foreground uppercase">Open Brain</p>
            <CardTitle className="max-w-md text-4xl leading-none sm:text-5xl">Personal task dashboard</CardTitle>
            <CardDescription className="max-w-lg text-base">
              Enter the shared passcode to unlock the current task view. Database access stays server-side.
            </CardDescription>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="rounded-3xl border border-border/60 bg-white/35 px-4 py-3">Server-side Supabase access</div>
            <div className="rounded-3xl border border-border/60 bg-white/35 px-4 py-3">Thirty-day session window</div>
            <div className="rounded-3xl border border-border/60 bg-white/35 px-4 py-3">Shared personal passcode</div>
          </div>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
