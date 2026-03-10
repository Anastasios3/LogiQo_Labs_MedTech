"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function AuditLogTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => apiClient.admin.auditLogs({ limit: 50 }),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return <div className="card h-48 animate-pulse" />;
  }

  return (
    <div className="card overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Timestamp
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              User
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Action
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Resource
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              IP
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {data?.data.map((log) => (
            <tr key={log.id} className="font-mono text-xs">
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                {new Date(log.createdAt).toISOString()}
              </td>
              <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                {log.userEmail}
              </td>
              <td className="px-4 py-3">
                <span className="font-semibold text-brand-700">{log.action}</span>
              </td>
              <td className="px-4 py-3 text-gray-600">
                {log.resourceType}:{log.resourceId?.slice(0, 8)}
              </td>
              <td className="px-4 py-3 text-gray-500">{log.ipAddress}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
