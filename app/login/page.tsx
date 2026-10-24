import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, keycloakEnabled, signIn } from "@/auth";
import { SignInCard } from "@/components/sign-in-card";
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
  CredentialsSignin: "Wrong email or password.",
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
  const message = error ? (MESSAGES[error] ?? "Sign-in failed, try again.") : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>WinLab Video</CardTitle>
          <CardDescription>
            {keycloakEnabled
              ? "Sign in with WinLab, your password, a passkey or Google."
              : "Sign in with your password, a passkey or Google."}
          </CardDescription>
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
          <SignInCard
            keycloakAction={
              keycloakEnabled
                ? async () => {
                    "use server";
                    await signIn("keycloak", { redirectTo: "/" });
                  }
                : undefined
            }
            googleAction={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          />
        </CardContent>
      </Card>
      <Link
        href="/manual"
        className="rounded-md text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        第一次登入？看教學
      </Link>
    </main>
  );
}
