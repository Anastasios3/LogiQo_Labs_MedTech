import { SidebarNav }       from "@/components/sidebar-nav";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { Toaster }          from "@/components/ui/toast";

// Dev-mode mock user when AUTH0_SECRET is not configured
const DEV_USER = {
  name: "Dev User",
  email: "dev@logiqo.io",
  picture: null,
  "https://logiqo.io/role": "hospital_safety_officer",
};

async function getSessionUser() {
  if (!process.env.AUTH0_SECRET) {
    return DEV_USER;
  }

  try {
    const { getSession } = await import("@auth0/nextjs-auth0");
    const session = await getSession();
    if (!session?.user) return null;
    return session.user;
  } catch {
    return null;
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/api/auth/login");
  }

  return (
    <>
      {/*
        Skip navigation link — first focusable element on page.
        Keyboard and screen-reader users can jump directly to main content.
        (Inclusive Components: Skip links pattern)
      */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/*
        Toaster sits outside the page chrome so toasts always appear
        in the top-right corner regardless of scroll position or overlays.
        The Zustand store persists across client-side navigations, so a toast
        fired on /admin/devices/:id will still be visible after router.push()
        lands on /admin.
      */}
      <Toaster />

      <div className="flex h-screen overflow-hidden bg-surface-subtle">
        {/* Sidebar — aside landmark for navigation */}
        <aside aria-label="Site navigation" className="shrink-0 relative">
          <SidebarNav user={user!} />
        </aside>

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar — breadcrumb / contextual actions slot */}
          <header
            className="flex h-14 shrink-0 items-center border-b border-gray-200 bg-white px-6 gap-4"
            aria-label="Page header"
          >
            {/* Left: page title injected via slot pattern (Next.js parallel routes could
                extend this — for now it's a visual anchor only) */}
            <div className="flex-1" />
            {/* Right: global actions */}
            <div className="flex items-center gap-2">
              {/* Dev mode badge */}
              {!process.env.AUTH0_SECRET && (
                <span className="badge bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200">
                  <span aria-hidden="true">⚡</span>
                  Dev mode
                </span>
              )}
            </div>
          </header>

          {/* Scrollable page content */}
          <main
            id="main-content"
            className="flex-1 overflow-y-auto scrollbar-thin"
            tabIndex={-1}   /* allows programmatic focus after skip-link */
          >
            {/*
              SubscriptionGate is a client component that calls GET /users/me on
              mount. If the tenant has no active subscription it renders a
              full-page overlay on top of the children, which continue to render
              behind it (prevents layout shift and keeps SSR output stable).
              system_admin role bypasses the gate; network errors fail-open.
            */}
            <SubscriptionGate>
              <div className="mx-auto max-w-7xl px-6 py-7">
                {children}
              </div>
            </SubscriptionGate>
          </main>
        </div>
      </div>
    </>
  );
}
