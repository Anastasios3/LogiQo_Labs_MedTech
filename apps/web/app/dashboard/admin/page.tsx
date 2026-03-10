export const metadata = {
  title: "Admin Dashboard | LogiQo MedTech",
};

const mockPending = [
  { id: "2", name: "Visia AF ICD – 3T MRI Compatible", sku: "MDT-VISIA-AF-ICD-3T", manufacturer: "Medtronic", submitted: "2024-03-01" },
];

const mockLogs = [
  { id: "1", ts: "2024-03-10T14:22:01Z", email: "surgeon@hospital.org", action: "device.viewed", resource: "device:STR-ACCOLADE", ip: "10.0.1.42" },
  { id: "2", ts: "2024-03-10T14:20:15Z", email: "safety@hospital.org", action: "alert.acknowledged", resource: "alert:Z-1234-2024", ip: "10.0.1.11" },
  { id: "3", ts: "2024-03-10T14:18:33Z", email: "surgeon@hospital.org", action: "document.downloaded", resource: "device_document:IFU-001", ip: "10.0.1.42" },
];

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Device approvals, SOP management, and compliance audit logs
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-xs text-yellow-700">
        Preview data — connect API + database for live data
      </div>

      {/* Pending Approvals */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Pending Device Approvals</h2>
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Device</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Manufacturer</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Submitted</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {mockPending.map((device) => (
                <tr key={device.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{device.name}</p>
                    <p className="font-mono text-xs text-gray-500">{device.sku}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{device.manufacturer}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{device.submitted}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="btn-primary text-xs px-3 py-1.5">Approve</button>
                      <button className="btn-secondary text-xs px-3 py-1.5 text-red-600">Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Audit Log */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Audit Log</h2>
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {mockLogs.map((log) => (
                <tr key={log.id} className="font-mono text-xs">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{log.ts}</td>
                  <td className="px-4 py-3 text-gray-700">{log.email}</td>
                  <td className="px-4 py-3 font-semibold text-brand-700">{log.action}</td>
                  <td className="px-4 py-3 text-gray-600">{log.resource}</td>
                  <td className="px-4 py-3 text-gray-500">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
