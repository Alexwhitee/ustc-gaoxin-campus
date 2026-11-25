import Link from "next/link";

export const metadata = { title: "隐私政策" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">隐私政策</h1>
      <p className="mt-2 text-sm text-muted-foreground">最后更新：2026 年 10 月</p>
      <div className="mt-6 space-y-4 text-[15px] leading-7 text-foreground/95">
        <p>本演示项目尊重并保护用户隐私：</p>
        <p>1. 登录信息（昵称、头像 emoji、演示手机号）只保存在你自己的浏览器 localStorage 中。</p>
        <p>2. 帖子与评论数据保存在演示服务的内存数据库中，重启服务即清空。</p>
        <p>3. 像素地图中的位置信息仅用于同页面内的多人位置演示同步，不会持久化。</p>
        <p>4. 本站不接入任何第三方统计或广告。</p>
      </div>
      <p className="mt-8 text-sm">
        <Link href="/" className="text-primary hover:underline">
          返回首页
        </Link>
      </p>
    </main>
  );
}
