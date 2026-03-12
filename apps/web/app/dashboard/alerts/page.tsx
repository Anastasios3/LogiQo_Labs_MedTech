import { AlertFeed } from "@/components/alerts/alert-feed";

export const metadata = {
  title: "Safety Alerts | LogiQo MedTech",
};

export default function AlertsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Safety Alerts</h1>
          <p className="page-subtitle">
            Active recalls and safety notices for your hospital&apos;s device inventory
          </p>
        </div>
      </div>

      <AlertFeed />
    </div>
  );
}
