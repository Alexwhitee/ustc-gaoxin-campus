"use client";

import { useCallback, useRef, useState } from "react";

/**
 * 移动端虚拟摇杆：指针在底盘内拖动，输出归一化方向 (-1..1)。
 * 松手后回中并回调 (0,0)。像素风：方形底座 + 硬边框 + 4px 网格吸附。
 */
export function VirtualJoystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activeId = useRef<number | null>(null);
  const MAX = 44; // 摇杆最大行程 px
  const GRID = 4; // 像素量化步长，让摇杆有「格点感」

  const quantize = (v: number) => Math.round(v / GRID) * GRID;

  const update = useCallback(
    (clientX: number, clientY: number) => {
      const base = baseRef.current;
      if (!base) return;
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > MAX) {
        dx = (dx / len) * MAX;
        dy = (dy / len) * MAX;
      }
      const qx = quantize(dx);
      const qy = quantize(dy);
      setKnob({ x: qx, y: qy });
      onMove(qx / MAX, qy / MAX);
    },
    [onMove],
  );

  const end = useCallback(() => {
    activeId.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  }, [onMove]);

  return (
    <div
      ref={baseRef}
      className="pointer-events-auto relative size-28 touch-none border-4 border-amber-900/80 bg-black/40 shadow-[0_0_0_2px_rgba(0,0,0,0.6)_inset]"
      onPointerDown={(e) => {
        activeId.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (activeId.current === e.pointerId) update(e.clientX, e.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {/* 底座十字准星 */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-amber-200" />
        <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 bg-amber-200" />
      </div>
      <div
        className="absolute left-1/2 top-1/2 size-12 border-4 border-amber-700 bg-amber-300"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
