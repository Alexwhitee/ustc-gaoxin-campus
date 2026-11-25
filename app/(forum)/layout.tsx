import { Sidebar } from "@/components/forum/sidebar";

export default function ForumLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Sidebar />
      {/* 桌面端让位固定侧栏；移动端顶部有顶栏、底部有标签栏 */}
      <div className="min-h-screen pb-14 lg:pl-64 lg:pb-0">{children}</div>
    </>
  );
}
