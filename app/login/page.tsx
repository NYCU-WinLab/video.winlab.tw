import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { EmailPinForm } from "@/components/email-pin-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NOT_ALLOWED } from "@/lib/login-codes";

const MESSAGES: Record<string, string> = {
  AccessDenied: NOT_ALLOWED,
  CredentialsSignin: "That code is wrong or has expired.",
  Verification: "That sign-in link is no longer valid.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/");

  const { error } = await searchParams;
  const message = error
    ? (MESSAGES[error] ?? "Sign-in failed, try again.")
    : null;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>WinLab Video</CardTitle>
          <CardDescription>Sign in to watch lab videos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {message}
            </p>
          )}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <Button type="submit" className="w-full">
              Sign in with Google
            </Button>
          </form>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <EmailPinForm />
        </CardContent>
      </Card>
    </main>
  );
}
