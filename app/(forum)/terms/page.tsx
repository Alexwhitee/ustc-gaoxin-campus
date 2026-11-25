import Link from "next/link";

export const metadata = { title: "用户协议" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">用户协议</h1>
      <p className="mt-2 text-sm text-muted-foreground">最后更新：2026 年 10 月</p>
      <div className="mt-6 space-y-4 text-[15px] leading-7 text-foreground/95">
        <p>
          欢迎来到 JLUAI（本演示项目）。这是一个面向大学师生的 AI 交流社区演示站点，注册与使用均在本机演示环境内完成，不会向任何第三方发送数据。
        </p>
        <p>1. 请文明发言，尊重他人；禁止发布违法、侵权或与学习交流无关的广告内容。</p>
        <p>2. 本站点为学习性复刻项目，页面内容均为演示数据。</p>
        <p>3. 登录仅需本地演示用途：手机号与验证码不会被发送或存储到服务器以外的位置。</p>
        <p>
          有问题可以通过侧边栏的 QQ 群入口联系我们。
        </p>
      </div>
      <p className="mt-8 text-sm">
        <Link href="/" className="text-primary hover:underline">
          返回首页
        </Link>
      </p>
    </main>
  );
}
