/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@logiqo/shared"],

  // Allow webpack to resolve .ts/.tsx files when an import uses a .js extension.
  // This is required for ESM-first workspace packages (@logiqo/shared) that use
  // TypeScript's recommended "import './foo.js'" pattern — TypeScript resolves
  // './foo.js' to './foo.ts' at compile time, but webpack sees the literal '.js'
  // and fails to find the file unless extensionAlias is configured.
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js":  [".ts", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },

  // Proxy /api/backend/* → Fastify API (allows client components to reach the API)
  async rewrites() {
    const apiBase = process.env.INTERNAL_API_URL ?? "http://localhost:8080";
    return [
      {
        source: "/api/backend/:path*",
        destination: `${apiBase}/:path*`,
      },
    ];
  },
  // Security headers
  async headers() {
    // Auth0 domains — adjust if using a custom Auth0 domain
    const auth0Domain = process.env.AUTH0_ISSUER_BASE_URL ?? "";

    // Content-Security-Policy
    // - default-src 'self': block all external resources by default
    // - script-src: Next.js needs 'unsafe-inline' for inline hydration scripts
    //   and 'unsafe-eval' is NOT included (prevents eval-based XSS)
    // - style-src: Tailwind uses inline styles; restrict to self + inline
    // - img-src: allow data URIs (avatars) and any HTTPS image CDN
    // - connect-src: API calls go to self (via Next.js rewrites) + Auth0
    // - frame-ancestors 'none': belt-and-suspenders alongside X-Frame-Options
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      `connect-src 'self' ${auth0Domain} https://api.logiqo.io`,
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
