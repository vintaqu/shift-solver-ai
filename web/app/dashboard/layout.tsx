import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#080B14" }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar user={{ name: session.user?.name ?? null, email: session.user?.email ?? null }} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
