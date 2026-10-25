import type { Size } from "../core/types";

export interface LoadedImage {
  path: string;
  url: string;
  size: Size;
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  bmp: "image/bmp",
};

/** 読み込んだ画像を Blob URL で保持する LRU。先読みと戻る操作のため数枚だけ残す */
export class ImageCache {
  private readonly entries = new Map<string, Promise<LoadedImage>>();

  constructor(
    private readonly read: (path: string) => Promise<ArrayBuffer>,
    private readonly capacity = 8,
  ) {}

  get(path: string): Promise<LoadedImage> {
    const hit = this.entries.get(path);
    if (hit) {
      this.entries.delete(path);
      this.entries.set(path, hit);
      return hit;
    }
    const p = this.load(path);
    this.entries.set(path, p);
    p.catch(() => this.entries.delete(path));
    this.evict();
    return p;
  }

  private async load(path: string): Promise<LoadedImage> {
    const bytes = await this.read(path);
    const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
    const url = URL.createObjectURL(new Blob([bytes], { type: MIME[ext] ?? "" }));
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(url);
      throw new Error(`画像として読めません: ${path}`);
    }
    return { path, url, size: { width: img.naturalWidth, height: img.naturalHeight } };
  }

  private evict(): void {
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) return;
      const p = this.entries.get(oldest)!;
      this.entries.delete(oldest);
      p.then((img) => URL.revokeObjectURL(img.url), () => {});
    }
  }
}
