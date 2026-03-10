"use client";

import { useState } from "react";
import type { Device } from "@logiqo/shared";
import { apiClient } from "@/lib/api-client";

interface DeviceDetailProps {
  device: Device;
}

export function DeviceDetail({ device }: DeviceDetailProps) {
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  const openDocument = async (documentId: string) => {
    setLoadingDocId(documentId);
    try {
      const { url } = await apiClient.devices.getDocumentUrl(
        device.id,
        documentId
      );
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setLoadingDocId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{device.name}</h1>
            <p className="mt-1 font-mono text-sm text-gray-500">{device.sku}</p>
            {device.description && (
              <p className="mt-3 text-gray-600">{device.description}</p>
            )}
          </div>
          <span
            className={
              device.regulatoryStatus === "recalled"
                ? "badge-critical"
                : "badge-low"
            }
          >
            {device.regulatoryStatus}
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <dt className="text-gray-500">Manufacturer</dt>
            <dd className="font-medium text-gray-900">
              {device.manufacturer?.name}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Category</dt>
            <dd className="font-medium text-gray-900">
              {device.category?.name}
            </dd>
          </div>
          {device.fdA510kNumber && (
            <div>
              <dt className="text-gray-500">FDA 510(k)</dt>
              <dd className="font-mono font-medium text-gray-900">
                {device.fdA510kNumber}
              </dd>
            </div>
          )}
          {device.sterilizationMethod && (
            <div>
              <dt className="text-gray-500">Sterilization</dt>
              <dd className="font-medium text-gray-900">
                {device.sterilizationMethod}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Compatibility & Tooling */}
      {device.extractionTooling && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-3">
            Extraction Tooling
          </h2>
          <pre className="text-xs bg-gray-50 rounded p-3 overflow-x-auto text-gray-700">
            {JSON.stringify(device.extractionTooling, null, 2)}
          </pre>
        </div>
      )}

      {/* Documents */}
      {device.documents && device.documents.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Documents</h2>
          <ul className="space-y-2">
            {device.documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {doc.title}
                  </p>
                  <p className="text-xs text-gray-500 uppercase">
                    {doc.documentType} {doc.version ? `· v${doc.version}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => openDocument(doc.id)}
                  disabled={loadingDocId === doc.id}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  {loadingDocId === doc.id ? "Opening..." : "Open"}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-400">
            Document links expire after 15 minutes for security.
          </p>
        </div>
      )}
    </div>
  );
}
