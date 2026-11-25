import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="text-4xl">🧭</span>
      <h1 className="mt-4 text-xl font-bold">这里什么都没有</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        页面可能已被删除，或者链接打错了。
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          回首页
        </Link>
        <Link
          href="/campus"
          className="rounded-xl border px-5 py-2.5 text-sm font-medium hover:bg-accent"
        >
          去像素地图逛逛
        </Link>
      </div>
    </main>
  );
}
