import AdminSidebar from "@/components/admin/sidebar";
import IdleLogout from "@/components/admin/idle-logout";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <IdleLogout />
      <AdminSidebar />
      <main className="flex-1 overflow-auto pt-14 pb-16 md:pt-0 md:pb-0">
        {children}
      </main>
    </div>
  );
}
