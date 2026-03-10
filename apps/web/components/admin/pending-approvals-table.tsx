"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function PendingApprovalsTable() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["devices", "pending"],
    queryFn: () => apiClient.devices.list({ page: 1, limit: 20 }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.admin.approveDevice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.admin.rejectDevice(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });

  const pendingDevices = data?.data.filter(
    (d) => d.approvalStatus === "pending"
  );

  if (isLoading) return <div className="card h-32 animate-pulse" />;

  if (!pendingDevices?.length) {
    return (
      <div className="card p-8 text-center text-sm text-gray-500">
        No pending approvals.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Device
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Manufacturer
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Submitted
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {pendingDevices.map((device) => (
            <tr key={device.id}>
              <td className="px-4 py-3">
                <p className="font-medium text-gray-900">{device.name}</p>
                <p className="font-mono text-xs text-gray-500">{device.sku}</p>
              </td>
              <td className="px-4 py-3 text-gray-600">
                {device.manufacturer?.name}
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs">
                {new Date(device.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => approveMutation.mutate(device.id)}
                    disabled={approveMutation.isPending}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() =>
                      rejectMutation.mutate({
                        id: device.id,
                        reason: "Rejected by safety officer",
                      })
                    }
                    disabled={rejectMutation.isPending}
                    className="btn-secondary text-xs px-3 py-1.5 text-red-600 hover:text-red-700"
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
