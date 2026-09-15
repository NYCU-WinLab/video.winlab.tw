import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AccountPasskeys, type PasskeyRow } from "@/components/account-passkeys";
import { AccountPasswordForm } from "@/components/account-password-form";
import { SiteHeader } from "@/components/site-header";
import { findUser } from "@/lib/access";
import { listPasskeys } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  const email = session?.user.email;
  if (!email) redirect("/login");

  const user = await findUser(email);
  const passkeys: PasskeyRow[] = (await listPasskeys(email)).map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    lastUsedAt: p.lastUsedAt,
  }));

  return (
    <>
      <SiteHeader crumb="Account" />
      <main className="mx-auto w-full max-w-xl flex-1 space-y-8 p-6">
        <section className="space-y-3">
          <div>
            <h2 className="text-lg">Password</h2>
            <p className="text-sm text-muted-foreground">
              Signed in as {email}.{" "}
              {user?.passwordHash
                ? "Change it here."
                : "You have no password yet, set one here."}
            </p>
          </div>
          <AccountPasswordForm
            email={email}
            hasPassword={Boolean(user?.passwordHash)}
          />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg">Passkeys</h2>
            <p className="text-sm text-muted-foreground">
              Sign in with Touch ID, Windows Hello or a security key. A passkey only
              works on the site it was created on.
            </p>
          </div>
          <AccountPasskeys passkeys={passkeys} />
        </section>
      </main>
    </>
  );
}
