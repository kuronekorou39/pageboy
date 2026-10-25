interface Props {
  url: string;
  drawWidth: number;
  drawHeight: number;
  /** 画像を上へずらす量(画面 px) */
  offsetY: number;
  viewportWidth: number;
  /** 画像が画面より広いとき、どこを見せるか。0 = 左端、1 = 右端 */
  panX: number;
}

export function Viewer({ url, drawWidth, drawHeight, offsetY, viewportWidth, panX }: Props) {
  const tx = drawWidth <= viewportWidth ? (viewportWidth - drawWidth) / 2 : -(drawWidth - viewportWidth) * panX;
  return (
    <img
      key={url}
      class="page"
      src={url}
      draggable={false}
      style={{
        width: `${drawWidth}px`,
        height: `${drawHeight}px`,
        transform: `translate(${tx}px, ${-offsetY}px)`,
      }}
    />
  );
}
