import type { Metadata } from "next";
import { ModerationQueueClient } from "@/components/admin/moderation-queue-client";

export const metadata: Metadata = {
  title: "Moderation Queue — LogiQo",
  description: "Review and action flagged peer annotations",
};

/**
 * Server shell — renders instantly with correct <head> metadata.
 * All data-fetching is in ModerationQueueClient (WebSocket + 15s polling).
 */
export default function ModerationPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Moderation Queue</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review flagged peer annotations. Approve to restore visibility or remove with a reason.
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
          Live
        </span>
      </div>

      <ModerationQueueClient />
    </div>
  );
}
