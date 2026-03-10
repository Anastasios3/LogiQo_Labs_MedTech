import Link from "next/link";

export default function HomePage() {
  const hasAuth0 = !!process.env.AUTH0_SECRET;

  return (
    /*
      Full-height landing — uses a subtle grid pattern for depth without photography.
      Refactoring UI: layered backgrounds create visual interest; Inter + weight
      scale creates clear typographic hierarchy.
    */
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-6 py-20">
      {/* Subtle background grid — purely decorative, aria-hidden */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgb(99 102 241 / 0.03) 1px, transparent 1px),
            linear-gradient(to right, rgb(99 102 241 / 0.03) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Radial glow behind content — depth cue */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgb(99 102 241 / 0.08) 0%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex max-w-3xl flex-col items-center text-center">

        {/* Eyebrow chip */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" aria-hidden="true" />
          <span className="text-xs font-semibold text-brand-700 tracking-wide uppercase">
            MedTech Platform — Phase 1 Preview
          </span>
        </div>

        {/* Logo mark + wordmark */}
        <div className="mb-4 flex items-center justify-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl shadow-card-md"
            style={{ background: "rgb(79 70 229)" }}
            aria-hidden="true"
          >
            <svg viewBox="0 0 20 20" fill="white" className="h-6 w-6">
              <path d="M12 3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h3v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3h3a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-3V3Z" />
            </svg>
          </span>
          <span className="text-4xl font-bold tracking-tight text-gray-900">LogiQo</span>
        </div>

        {/* Headline — clear, specific value prop */}
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl leading-tight">
          Unified Medical
          <br />
          <span className="text-brand-600">Hardware Platform</span>
        </h1>

        {/* Sub-headline */}
        <p className="mt-5 max-w-xl text-lg text-gray-500 leading-relaxed">
          The manufacturer-agnostic index for medical implants and devices.
          Peer-validated clinical telemetry. Hospital-grade compliance tooling.
        </p>

        {/* Feature pills */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {[
            "Hardware Index",
            "Peer Telemetry",
            "Safety Alerts",
            "Audit Logs",
            "HIPAA-eligible",
          ].map((feature) => (
            <span
              key={feature}
              className="rounded-full border border-gray-200 bg-white px-3.5 py-1 text-xs font-medium text-gray-600 shadow-card"
            >
              {feature}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={hasAuth0 ? "/api/auth/login" : "/dashboard/devices"}
            className="btn-primary px-6 py-3 text-base"
          >
            {hasAuth0 ? (
              <>
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                </svg>
                Sign in
              </>
            ) : (
              <>
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                </svg>
                Enter Dashboard
              </>
            )}
          </Link>

          <Link
            href="/dashboard/devices"
            className="btn-secondary px-6 py-3 text-base"
          >
            View Hardware Index
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>

        {/* Dev mode notice */}
        {!hasAuth0 && (
          <p className="mt-6 text-xs text-gray-400">
            <span
              className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-violet-600 font-medium"
            >
              ⚡ Dev mode
            </span>
            {" "}— Auth0 not configured.{" "}
            <code className="font-mono text-gray-500">AUTH0_SECRET</code> needed for login.
          </p>
        )}
      </div>

      {/* Trust signals footer */}
      <div className="relative z-10 mt-20 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400">
        {[
          { icon: "🏥", text: "Hospital-grade security" },
          { icon: "🔒", text: "HIPAA-eligible architecture" },
          { icon: "🇺🇸", text: "FDA MedWatch integration (Phase 2)" },
          { icon: "♿", text: "WCAG 2.1 AA compliant" },
        ].map(({ icon, text }) => (
          <span key={text} className="flex items-center gap-1.5">
            <span aria-hidden="true">{icon}</span>
            {text}
          </span>
        ))}
      </div>
    </main>
  );
}
