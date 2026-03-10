"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function AlertFeed() {
  const [filter, setFilter] = useState<"active" | "acknowledged">("active");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["alerts", filter],
    queryFn: () => apiClient.alerts.list({ status: filter }),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => apiClient.alerts.acknowledge(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["active", "acknowledged"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab
                ? "bg-brand-600 text-white"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {!data?.data.length ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500">No {filter} alerts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.data.map((alert) => (
            <div
              key={alert.id}
              className={`card p-5 border-l-4 ${
                alert.severity === "critical"
                  ? "border-l-red-500"
                  : alert.severity === "high"
                  ? "border-l-orange-500"
                  : alert.severity === "medium"
                  ? "border-l-yellow-500"
                  : "border-l-green-500"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={
                        alert.severity === "critical"
                          ? "badge-critical"
                          : alert.severity === "high"
                          ? "badge-high"
                          : alert.severity === "medium"
                          ? "badge-medium"
                          : "badge-low"
                      }
                    >
                      {alert.severity}
                    </span>
                    <span className="text-xs text-gray-500 uppercase">
                      {alert.alertType.replace("_", " ")}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900">{alert.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{alert.summary}</p>
                  <p className="mt-2 text-xs text-gray-400">
                    Source: {alert.source} ·{" "}
                    {new Date(alert.publishedAt).toLocaleDateString()}
                  </p>
                </div>
                {filter === "active" && (
                  <button
                    onClick={() => acknowledgeMutation.mutate(alert.id)}
                    disabled={acknowledgeMutation.isPending}
                    className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
