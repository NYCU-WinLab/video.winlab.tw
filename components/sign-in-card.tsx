"use client";

import { KeyRound } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
} from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_RULES, storePasswordCredential } from "@/lib/credential-manager";

type Mode = "password" | "request-code" | "set-password";

async function readError(res: Response, fallback: string) {
  try {
    return ((await res.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export function SignInCard({ googleAction }: { googleAction: () => Promise<void> }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const passkeysUsable = useSyncExternalStore(
    () => () => {},
    () => browserSupportsWebAuthn(),
    () => false,
  );
  const autofillStarted = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const signInWithTicket = useCallback(
    async (ticket: string) => {
      const result = await signIn("passkey", { ticket, redirect: false });
      if (result?.error) {
        setError("That passkey is not accepted, ask an admin.");
        return;
      }
      router.push("/");
      router.refresh();
    },
    [router],
  );

  const runPasskey = useCallback(
    async (useBrowserAutofill: boolean) => {
      const optionsRes = await fetch("/api/auth/passkey/authenticate/options", {
        method: "POST",
      });
      if (!optionsRes.ok) throw new Error("Could not start passkey sign-in");
      const optionsJSON = await optionsRes.json();
      const assertion = await startAuthentication({ optionsJSON, useBrowserAutofill });
      const verifyRes = await fetch("/api/auth/passkey/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      if (!verifyRes.ok) {
        throw new Error(await readError(verifyRes, "That passkey did not work."));
      }
      const { ticket } = (await verifyRes.json()) as { ticket: string };
      await signInWithTicket(ticket);
    },
    [signInWithTicket],
  );

  // Conditional UI: if the browser can offer passkeys from the email field, arm
  // it once. Browsers without it simply keep the button below.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!browserSupportsWebAuthn()) return;
      if (!(await browserSupportsWebAuthnAutofill())) return;
      if (cancelled || autofillStarted.current) return;
      autofillStarted.current = true;
      try {
        await runPasskey(true);
      } catch {
        // The user ignored the autofill prompt or aborted it: not an error.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runPasskey]);

  async function submitPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn("password", { email, password, redirect: false });
    if (result?.error) {
      setError(
        "Wrong email or password. After 10 failed tries the account pauses for 15 minutes.",
      );
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function requestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/auth/pin/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        const data = (await res.json()) as {
          error?: string;
          retryAfterSeconds?: number;
        };
        setCooldown(data.retryAfterSeconds ?? 60);
        setError(data.error ?? "Wait a little before asking for another code.");
        return;
      }
      if (!res.ok) throw new Error(await readError(res, "Could not send a code"));
      const data = (await res.json()) as { dev?: boolean };
      setCooldown(60);
      setMode("set-password");
      setNote(
        data.dev
          ? "Mail is not configured here, the code is in the server log."
          : `Code sent to ${email}. It expires in 10 minutes.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a code");
    } finally {
      setBusy(false);
    }
  }

  async function submitNewPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password: newPassword }),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not set the password"));
      await storePasswordCredential(email, newPassword);
      const result = await signIn("password", {
        email,
        password: newPassword,
        redirect: false,
      });
      if (result?.error) {
        setMode("password");
        setNote("Password saved. Sign in with it now.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set the password");
    } finally {
      setBusy(false);
    }
  }

  const feedback = (
    <>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      {mode === "password" && (
        <form onSubmit={submitPassword} className="space-y-3" method="post">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username webauthn"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="current-password">Password</Label>
            <Input
              id="current-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          {feedback}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="link"
            className="w-full"
            disabled={busy}
            onClick={() => {
              setMode("request-code");
              setError(null);
              setNote(null);
            }}
          >
            Forgot or set password
          </Button>
        </form>
      )}

      {mode === "request-code" && (
        <form onSubmit={requestCode} className="space-y-3" method="post">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              disabled={busy}
            />
          </div>
          {feedback}
          <Button type="submit" className="w-full" disabled={busy || cooldown > 0}>
            {cooldown > 0
              ? `Wait ${cooldown}s`
              : busy
                ? "Sending…"
                : "Email me a code"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={() => {
              setMode("password");
              setError(null);
              setNote(null);
            }}
          >
            Back to sign in
          </Button>
        </form>
      )}

      {mode === "set-password" && (
        <form onSubmit={submitNewPassword} className="space-y-3" method="post">
          <input type="hidden" name="email" value={email} autoComplete="username" />
          <div className="space-y-2">
            <Label htmlFor="code">Code from the email</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              className="font-mono"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoFocus
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              {...PASSWORD_RULES}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              {...PASSWORD_RULES}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          {feedback}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Save password and sign in"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={busy || cooldown > 0}
            onClick={() => {
              setMode("request-code");
              setCode("");
              setError(null);
            }}
          >
            {cooldown > 0 ? `Send another code in ${cooldown}s` : "Send another code"}
          </Button>
        </form>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      {passkeysUsable && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await runPasskey(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "That passkey did not work.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <KeyRound />
          Sign in with a passkey
        </Button>
      )}

      <form action={googleAction}>
        <Button type="submit" variant="outline" className="w-full">
          Sign in with Google
        </Button>
      </form>
    </div>
  );
}
