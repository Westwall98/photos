export type Photo = {
  key: string;
  url: string;
  uploaded: string | null;
  size: number;
};

export type PhotoPage = {
  photos: Photo[];
  nextCursor: string | null;
  hasMore: boolean;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export async function fetchPhotos(cursor?: string | null): Promise<PhotoPage> {
  if (!API_BASE_URL) {
    throw new Error("未配置 VITE_API_BASE_URL。请在 Pages 环境变量中设置 Worker API 地址。");
  }

  const url = new URL(`${API_BASE_URL}/api/photos`);
  if (cursor) url.searchParams.set("cursor", cursor);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`获取图片列表失败（HTTP ${response.status}）`);
  }
  return response.json() as Promise<PhotoPage>;
}
