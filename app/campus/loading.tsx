export default function CampusLoading() {
  return (
    <div className="flex h-[100dvh] w-full flex-col items-center justify-center gap-3 bg-[#151b30] text-white">
      <div className="pixel-font text-base tracking-widest">正在进入校园…</div>
      <div className="h-3 w-64 max-w-[70vw] border-2 border-amber-200/70 bg-black/50 p-0.5">
        <div className="h-full w-full animate-pulse bg-amber-300/70" />
      </div>
    </div>
  );
}
