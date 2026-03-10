export const metadata = {
  title: "Safety Alerts | LogiQo MedTech",
};

const mockAlerts = [
  {
    id: "1",
    alertType: "recall",
    source: "FDA MedWatch",
    title: "Voluntary Recall: Zimmer Biomet Continuum Acetabular System",
    summary: "Potential for early polyethylene wear due to manufacturing variance in lot Z-2024-03.",
    severity: "high",
    publishedAt: "2024-03-15",
    acknowledged: false,
  },
  {
    id: "2",
    alertType: "safety_notice",
    source: "Medtronic",
    title: "Field Safety Corrective Action: Visia AF ICD Firmware Update Required",
    summary: "Advisory regarding battery depletion detection in firmware v2.1. Update to v2.3 required.",
    severity: "medium",
    publishedAt: "2024-02-28",
    acknowledged: true,
  },
];

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Safety Alerts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Active recalls and safety notices for your hospital&apos;s device inventory
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-xs text-yellow-700">
        Preview data — connect API + database for live alert ingestion
      </div>

      <div className="space-y-3">
        {mockAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`card p-5 border-l-4 ${
              alert.severity === "high" ? "border-l-orange-500" :
              alert.severity === "medium" ? "border-l-yellow-500" :
              "border-l-green-500"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={alert.severity === "high" ? "badge-high" : "badge-medium"}>
                    {alert.severity}
                  </span>
                  <span className="text-xs text-gray-500 uppercase">
                    {alert.alertType.replace("_", " ")}
                  </span>
                  {alert.acknowledged && (
                    <span className="text-xs text-green-600 font-medium">✓ Acknowledged</span>
                  )}
                </div>
                <p className="font-medium text-gray-900">{alert.title}</p>
                <p className="mt-1 text-sm text-gray-600">{alert.summary}</p>
                <p className="mt-2 text-xs text-gray-400">
                  Source: {alert.source} · {alert.publishedAt}
                </p>
              </div>
              {!alert.acknowledged && (
                <button className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap">
                  Acknowledge
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
