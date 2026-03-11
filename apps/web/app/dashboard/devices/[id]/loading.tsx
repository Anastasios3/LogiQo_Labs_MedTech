export default function DeviceDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="h-4 w-48 rounded bg-gray-100" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content skeleton */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-6 space-y-4">
            <div className="flex gap-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-9 w-28 rounded-lg bg-gray-100" />
              ))}
            </div>
            <div className="space-y-3 pt-2">
              <div className="h-4 w-full rounded bg-gray-100" />
              <div className="h-4 w-5/6 rounded bg-gray-100" />
              <div className="h-4 w-4/6 rounded bg-gray-100" />
            </div>
          </div>
        </div>

        {/* Sidebar skeleton */}
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <div className="h-5 w-24 rounded bg-gray-100" />
            {[1,2,3,4].map(i => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-24 rounded bg-gray-100" />
                <div className="h-3 w-20 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
