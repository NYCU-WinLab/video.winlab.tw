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
      {/* One row on desktop: logo, crumb, centred search, user menu. On narrow
          screens the row wraps so the search (home only) drops to its own
          full-width line below the logo and user menu, instead of being crushed
          into a single non-wrapping row. */}
      <div className="flex w-full flex-wrap items-center gap-2 px-4 py-3 sm:flex-nowrap sm:px-6">
        <Link
          href="/"
          className="shrink-0 rounded-md font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          WinLab Video
        </Link>
        {crumb && (
          <span className="min-w-0 truncate text-sm text-muted-foreground">
            / {crumb}
          </span>
        )}
        {children && (
          <div className="order-last flex w-full min-w-0 items-center justify-center gap-2 sm:order-none sm:w-auto sm:flex-1">
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
