export default async function TenantDashboard({ params }) {
  const { tenant } = await params;

  return (
    <div className="flex-1 flex items-center justify-center text-gray-500">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-300 mb-2">
          Welcome to {tenant}
        </h2>
        <p className="text-sm">Select a channel from the sidebar to start chatting.</p>
      </div>
    </div>
  );
}
