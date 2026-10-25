import type { Size } from "./types";

export interface StepLayout {
  /** 画像 px → 画面 px の倍率 */
  scale: number;
  drawWidth: number;
  drawHeight: number;
  /** 各ステップで画像をどれだけ上へずらすか(画面 px) */
  offsets: number[];
}

/**
 * ページを横幅フィット × zoom で描いたときの、縦方向のステップ位置を求める。
 * 画面に収まるなら 1 ステップ。収まらないなら、画面高さ × (1 - overlap) 刻みで必要な数に等分する。
 */
export function layoutSteps(image: Size, viewport: Size, zoom: number, overlap: number): StepLayout {
  const scale = (viewport.width * zoom) / image.width;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const travel = Math.max(0, drawHeight - viewport.height);
  if (travel <= 0.5) {
    return { scale, drawWidth, drawHeight, offsets: [0] };
  }
  const stride = viewport.height * (1 - overlap);
  const count = Math.ceil(travel / stride) + 1;
  const offsets = Array.from({ length: count }, (_, i) => (travel * i) / (count - 1));
  return { scale, drawWidth, drawHeight, offsets };
}

/** Infinity や範囲外のステップを実際の番号に収める */
export function clampStep(step: number, stepCount: number): number {
  if (!Number.isFinite(step)) return stepCount - 1;
  return Math.min(Math.max(0, step), stepCount - 1);
}
