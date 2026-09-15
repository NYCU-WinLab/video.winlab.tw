import Link from "next/link";
import { auth, signOut } from "@/auth";
import { UserMenu } from "@/components/user-menu";

export async function SiteHeader({
  crumb,
  children,
}: {
  crumb?: string;
  children?: React.ReactNode;
}) {
  const session = await auth();
  if (!session) return null;

  return (
    <header>
      <div className="flex w-full items-center gap-2 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0 font-semibold">
          WinLab Video
        </Link>
        {crumb && (
          <span className="truncate text-sm text-muted-foreground">
            / {crumb}
          </span>
        )}
        {children && (
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            {children}
          </div>
        )}
        <div className="ml-auto shrink-0">
          <UserMenu
            name={session.user.name ?? session.user.email ?? "Account"}
            isAdmin={session.user.isAdmin}
            signOutAction={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          />
        </div>
      </div>
    </header>
  );
}
