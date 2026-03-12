import { OrganizationManager } from "@/components/organizations/organization-manager";

export const metadata = {
  title: "Organization | LogiQo MedTech",
};

export default function OrganizationsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Organization</h1>
          <p className="page-subtitle">
            Manage team members, roles, and pending invitations
          </p>
        </div>
      </div>

      <OrganizationManager />
    </div>
  );
}
