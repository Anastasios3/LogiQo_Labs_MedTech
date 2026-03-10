import { SidebarNav } from "@/components/sidebar-nav";

// Dev-mode mock user when AUTH0_SECRET is not configured
const DEV_USER = {
  name: "Dev User",
  email: "dev@logiqo.io",
  picture: null,
  "https://logiqo.io/role": "hospital_safety_officer",
};

async function getSessionUser() {
  // If Auth0 is not configured, use dev mock so the UI is explorable
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
    // Only redirect if Auth0 is actually configured
    const { redirect } = await import("next/navigation");
    redirect("/api/auth/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <SidebarNav user={user!} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
