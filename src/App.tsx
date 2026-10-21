import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPhotos, type Photo } from "./api";

function getDisplayName(key: string): string {
  const filename = key.split("/").pop() || key;
  return filename.replace(/\.[^.]+$/, "");
}

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestLock = useRef(false);

  const loadPage = useCallback(async (nextCursor: string | null, reset = false) => {
    if (requestLock.current) return;
    requestLock.current = true;
    setLoading(true);
    setError("");
    try {
      const page = await fetchPhotos(nextCursor);
      setPhotos((previous) => {
        const base = reset ? [] : previous;
        const seen = new Set(base.map((photo) => photo.key));
        return [...base, ...page.photos.filter((photo) => !seen.has(photo.key))];
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore && page.nextCursor !== null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载图片时发生未知错误");
    } finally {
      setLoading(false);
      requestLock.current = false;
    }
  }, []);

  useEffect(() => {
    void loadPage(null, true);
  }, [loadPage]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && cursor) {
          void loadPage(cursor);
        }
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [cursor, hasMore, loading, loadPage]);

  const closeViewer = useCallback(() => setViewerIndex(null), []);
  const goTo = useCallback((delta: number) => {
    setViewerIndex((current) => {
      if (current === null || photos.length === 0) return current;
      return (current + delta + photos.length) % photos.length;
    });
  }, [photos.length]);

  useEffect(() => {
    if (viewerIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowLeft") goTo(-1);
      if (event.key === "ArrowRight") goTo(1);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [viewerIndex, closeViewer, goTo]);

  const currentPhoto = viewerIndex === null ? null : photos[viewerIndex];

  return (
    <main className="page-shell">
      <header className="site-header">
        <div className="photo-count">{photos.length}{hasMore ? "+" : ""} photos</div>
      </header>

      {error && (
        <div className="error-panel" role="alert">
          <span>{error}</span>
          <button onClick={() => void loadPage(null, true)}>重试</button>
        </div>
      )}

      {!error && photos.length === 0 && loading && (
        <div className="empty-state">正在加载照片…</div>
      )}
      {!error && photos.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-icon">▧</div>
          <h2>还没有照片</h2>
          <p>请在 R2 Bucket 的 photos/ 前缀下上传 JPG、PNG、WebP 或 AVIF 图片。</p>
        </div>
      )}

      <section className="masonry" aria-label="照片墙">
        {photos.map((photo, index) => (
          <button
            className="photo-card"
            key={photo.key}
            type="button"
            onClick={() => setViewerIndex(index)}
            aria-label={`查看图片 ${getDisplayName(photo.key)}`}
          >
            <img
              src={photo.url}
              alt=""
              loading={index < 12 ? "eager" : "lazy"}
              decoding="async"
            />
            <span className="photo-overlay">{getDisplayName(photo.key)}</span>
          </button>
        ))}
      </section>

      <div ref={sentinelRef} className="load-sentinel" aria-hidden="true" />
      {loading && photos.length > 0 && <p className="status-line">加载更多照片…</p>}
      {!loading && !hasMore && photos.length > 0 && (
        <p className="status-line">已显示全部 {photos.length} 张照片</p>
      )}
      {!loading && hasMore && cursor && (
        <button className="load-more" onClick={() => void loadPage(cursor)}>加载更多</button>
      )}

      {currentPhoto && viewerIndex !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="图片预览" onClick={closeViewer}>
          <button className="viewer-close" onClick={closeViewer} aria-label="关闭预览">×</button>
          <button
            className="viewer-nav viewer-prev"
            onClick={(event) => { event.stopPropagation(); goTo(-1); }}
            aria-label="上一张"
          >‹</button>
          <figure className="viewer-figure" onClick={(event) => event.stopPropagation()}>
            <img src={currentPhoto.url} alt={getDisplayName(currentPhoto.key) || "Photo"} />
            <figcaption>{viewerIndex + 1} / {photos.length} · {getDisplayName(currentPhoto.key)}</figcaption>
          </figure>
          <button
            className="viewer-nav viewer-next"
            onClick={(event) => { event.stopPropagation(); goTo(1); }}
            aria-label="下一张"
          >›</button>
        </div>
      )}
    </main>
  );
}
