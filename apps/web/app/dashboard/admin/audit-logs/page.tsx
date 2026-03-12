import { AuditLogViewer } from "@/components/admin/audit-log-viewer";

export const metadata = {
  title: "Audit Log | LogiQo MedTech",
};

export default function AuditLogsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            Audit Log
            <span className="flex items-center gap-1.5 text-xs font-normal text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
              <svg aria-hidden="true" className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
              </svg>
              Immutable
            </span>
          </h1>
          <p className="page-subtitle">
            HIPAA-compliant audit trail — all events are write-only and cannot be modified or deleted
          </p>
        </div>
      </div>

      <AuditLogViewer />
    </div>
  );
}
