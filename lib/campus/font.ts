// 像素字体流水线。
// 目标成果样式：Fusion Pixel（OFL 开源可商用）自托管 woff2 + next/font/local。
// 本环境无法联网拉取字体文件，因此这里做成「可随时落文件即生效」的流水线：
//   1. 把 fusion-pixel 的 woff2 放到 app/fonts/ 下并按下方 @font-face 名称注册即可；
//   2. 未落文件时自动回退到像素观感的本地字体栈（关闭抗锯齿 + 整数字号 + 字距收紧）。

/** canvas / Phaser Text 使用的字体栈 */
export const PIXEL_FONT_STACK =
  "'Fusion Pixel 12px monospaced', var(--pixel-font), 'PingFang SC', 'Microsoft YaHei', monospace";

/** CSS 里使用的字体族别名（见 globals.css 的 --pixel-font） */
export const PIXEL_FONT_CSS_VAR = "--pixel-font";

/**
 * 等待字体就绪再绘制含文字的世界画布，避免「先用回退字体画完再被替换」导致的重绘。
 * 字体缺失时会静默跳过（`document.fonts` 不可用时同理）。
 */
export async function ensurePixelFontReady(): Promise<void> {
  if (typeof document === "undefined") return;
  try {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) await fonts.ready;
    if (fonts?.load) await fonts.load(`12px 'Fusion Pixel 12px monospaced'`).catch(() => undefined);
  } catch {
    // 字体不可用不影响渲染，走回退字体栈
  }
}
