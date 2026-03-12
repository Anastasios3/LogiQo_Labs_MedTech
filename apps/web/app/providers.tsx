"use client";

/**
 * Providers — global client-side context wrappers.
 *
 * Placed here (app/providers.tsx) so RootLayout (a Server Component) can
 * import it without making itself a client component. Any context that must
 * wrap the full app tree goes here.
 *
 * Current providers:
 *   QueryClientProvider — TanStack Query v5 cache shared across the app.
 *     staleTime: 60s   — data stays fresh for 1 minute (avoids redundant
 *                         refetches when navigating between pages quickly).
 *     gcTime:    5 min — inactive queries stay in cache for 5 minutes.
 *     retry:     1     — one automatic retry on network errors; avoids
 *                         hammering the API on repeated failures.
 */

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({ children }: { children: React.ReactNode }) {
  // useState so each browser tab/session gets its own QueryClient instance
  // (avoids shared state between server-side renders in Next.js)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,        // 1 minute
            gcTime:    5  * 60 * 1000,   // 5 minutes
            retry:     1,
            refetchOnWindowFocus: false,  // clinical dashboards shouldn't jump on tab-switch
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
