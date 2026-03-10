import Link from "next/link";

export default function HomePage() {
  const hasAuth0 = !!process.env.AUTH0_SECRET;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <div className="mb-8 text-6xl font-bold text-brand-600">LogiQo</div>
        <h1 className="mb-4 text-3xl font-bold text-gray-900">
          Unified Medical Hardware Platform
        </h1>
        <p className="mb-8 text-lg text-gray-600">
          The manufacturer-agnostic index for medical implants, devices, and
          peer-validated clinical telemetry.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href={hasAuth0 ? "/api/auth/login" : "/dashboard/devices"}
            className="btn-primary"
          >
            {hasAuth0 ? "Sign In" : "Enter Dashboard"}
          </Link>
          <Link href="/dashboard/devices" className="btn-secondary">
            View Hardware Index
          </Link>
        </div>
        {!hasAuth0 && (
          <p className="mt-4 text-xs text-gray-400">
            Dev mode — Auth0 not configured. Set AUTH0_SECRET to enable login.
          </p>
        )}
      </div>
    </main>
  );
}
