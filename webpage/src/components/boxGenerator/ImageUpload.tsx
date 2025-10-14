
import React, { useEffect, useMemo, useRef, useState } from 'react';

interface ExampleItem {
  url: string;
  label?: string;
  thumbUrl?: string;
}

interface ImageUploadProps {
  label: string;
  onImage: (dataUrl: string) => void;
  // optional id to apply to the file input element so other UI can trigger it
  inputId?: string;
  // Optional: pass curated examples; if not provided, component will attempt to fetch from /assets/examples/examples.json
  examples?: ExampleItem[];
  // Optional: maximum recent URLs to keep
  maxRecent?: number;
  // Optional: localStorage key for recents (use different keys per use-case if needed)
  recentStorageKey?: string;
}

export default function ImageUpload({ label, onImage, inputId, examples, maxRecent = 10, recentStorageKey = 'imageUpload.recentUrls' }: ImageUploadProps) {
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [fetchedExamples, setFetchedExamples] = useState<ExampleItem[] | null>(null);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const [hoverPreview, setHoverPreview] = useState<{ url: string; x: number; y: number } | null>(null);
  
  const inputRef = useRef<HTMLInputElement | null>(null);
    const recentRef = useRef<string[]>([]);

  // Ensure asset paths work when the app is served from a subpath (vite base)
  const withBase = (u: string) => {
    if (!u) return u;
    if (/^(https?:|data:)/i.test(u)) return u;
    const base = import.meta.env.BASE_URL || '/'; // ends with '/'
    // If already base-prefixed, return as-is
    if (u.startsWith(base)) return u;
    if (u.startsWith('/')) return base + u.slice(1);
    return base + u;
  };



  const fileToDataUrl = (file: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFile = async (file: File) => {
    if (!file) return;
    // allow images only
    if (!file.type || !file.type.startsWith('image/')) {
      alert('Please upload a valid image file.');
      return;
    }
    try {
  const dataUrl = await fileToDataUrl(file);
      onImage(dataUrl);
    } catch (err) {
      console.warn('Failed to read file', err);
      alert('Failed to read file');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void handleFile(file);
  };

  const loadFromUrl = async (rawUrl: string) => {
    if (!rawUrl) return;
    setLoadingUrl(true);
    try {
      const res = await fetch(rawUrl, { method: 'GET', cache: 'no-cache' });
      if (!res.ok) throw new Error('Failed to fetch image: ' + res.status);
      const blob = await res.blob();
      if (!blob.type || !blob.type.startsWith('image/')) {
        const lower = rawUrl.split('?')[0].toLowerCase();
        if (!lower.match(/\.svg$/)) throw new Error('URL did not point to a recognized image type');
      }
  const dataUrl = await fileToDataUrl(blob);
      onImage(dataUrl);
      setUrlValue('');
      setShowUrlInput(false);
      // Record recent URL for http(s) and same-origin paths (skip data/blob URLs)
      const base = import.meta.env.BASE_URL || '/';
      const isWebUrl = (() => {
        if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return false;
        if (/^https?:\/\//i.test(rawUrl)) return true;
        if (rawUrl.startsWith('/')) return true;
        if (rawUrl.startsWith(base)) return true;
        try {
          const u = new URL(rawUrl, window.location.href);
          return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
          return false;
        }
      })();
      if (isWebUrl) {
        const storeUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : withBase(rawUrl);
        const current = Array.isArray(recentRef.current) ? recentRef.current : [];
        const next = [storeUrl, ...current.filter(u => u !== storeUrl)].slice(0, maxRecent);
        try { localStorage.setItem(recentStorageKey, JSON.stringify(next)); } catch {}
        setRecentUrls(next);
      }
    } catch (err) {
      console.warn('Failed to load image from URL', err);
      alert('Failed to load image from URL: ' + String(err));
    } finally {
      setLoadingUrl(false);
    }
  };

  // Keep a ref synced with the latest recentUrls (used to compute next state deterministically)
  useEffect(() => {
    recentRef.current = recentUrls;
  }, [recentUrls]);

  // Drag / drop handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Prefer files
    const dt = e.dataTransfer;
    if (dt.files && dt.files.length > 0) {
      const f = dt.files[0];
      void handleFile(f);
      return;
    }
    // Fallback: try to read a dragged URL
    const url = dt.getData('text/uri-list') || dt.getData('text/plain');
    if (url) void loadFromUrl(url.trim());
  };

  // Paste handler (when area is focused)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (file) { e.preventDefault(); void handleFile(file); return; }
      }
    }
    // no file in clipboard; maybe a URL string
    const txt = e.clipboardData.getData('text/plain');
    if (txt && (txt.startsWith('http://') || txt.startsWith('https://'))) {
      e.preventDefault();
      void loadFromUrl(txt.trim());
    }
  };

  // Load curated examples if not provided via props
  useEffect(() => {
    if (examples && examples.length) return; // use provided
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(withBase('assets/examples/examples.json'), { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch examples.json: ' + res.status);
        const json = await res.json();
        const list: ExampleItem[] = Array.isArray(json?.suggestions) ? json.suggestions : [];
        if (!aborted) setFetchedExamples(list);
      } catch (e) {
        console.warn('Unable to load examples.json', e);
        if (!aborted) setFetchedExamples([]);
      }
    })();
    return () => { aborted = true; };
  }, [examples]);

  // Load recents from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(recentStorageKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setRecentUrls(arr.filter((s: any) => typeof s === 'string'));
      }
    } catch {}
  }, [recentStorageKey]);

  const curated = examples && examples.length ? examples : (fetchedExamples ?? []);
  const curatedDeduped = useMemo(() => {
    const seen = new Set<string>();
    return curated.filter(it => {
      if (!it?.url || seen.has(it.url)) return false;
      seen.add(it.url);
      return true;
    });
  }, [curated]);

  const recentDeduped = useMemo(() => {
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const u of recentUrls) {
      const base = import.meta.env.BASE_URL || '/';
      const ok = typeof u === 'string'
        && !u.startsWith('data:')
        && !u.startsWith('blob:')
        && (u.startsWith('/') || /^https?:\/\//i.test(u) || u.startsWith(base));
      if (ok && !seen.has(u)) {
        seen.add(u);
        deduped.push(u);
        if (deduped.length >= maxRecent) break;
      }
    }
    return deduped;
  }, [recentUrls, maxRecent]);

  const handleClearRecents = () => {
    setRecentUrls([]);
    try { localStorage.removeItem(recentStorageKey); } catch {}
  };

  const Thumb = ({ item }: { item: ExampleItem | string }) => {
    const url = typeof item === 'string' ? item : (item.thumbUrl || item.url);
    let label: string;
    if (typeof item === 'string') {
      try {
        const u = new URL(item, window.location.href);
        label = u.hostname || 'This site';
      } catch {
        label = 'Link';
      }
    } else {
      label = item.label || 'Example';
    }
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); void loadFromUrl(typeof item === 'string' ? item : withBase(item.url)); }}
        onMouseEnter={(e) => setHoverPreview({ url: typeof item === 'string' ? item : withBase(item.url), x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setHoverPreview(null)}
        aria-label={`Load ${label}`}
        style={{
          flex: '0 0 auto',
          width: 84,
          minWidth: 84,
          height: 84,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          background: '#111',
          padding: 0,
          cursor: 'pointer'
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={typeof item === 'string' ? url : withBase(url)}
          alt={label}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.4'; }}
        />
      </button>
    );
  };

  return (
    <div style={{ minWidth: 0 }}>
      {/* Suggested Images */}
      {(curatedDeduped.length > 0 || recentDeduped.length > 0) && (
        <div style={{ marginBottom: 10, width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
          {curatedDeduped.length > 0 && (
            <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
              <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 8 }}>
                {curatedDeduped.map((it, idx) => (
                  <Thumb key={(it.url || '') + idx} item={it} />
                ))}
              </div>
            </div>
          )}
          {recentDeduped.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ color: '#bbb', fontSize: '0.9em' }}>Recent links</div>
                <button type="button" onClick={handleClearRecents} style={{ fontSize: '0.85em', opacity: 0.8 }}>Clear</button>
              </div>
              <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
                <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 8 }}>
                  {recentDeduped.map((u, idx) => (
                    <Thumb key={u + idx} item={u} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaste={handlePaste}
        tabIndex={0}
        role="button"
        aria-label="Image drop area"
        onClick={() => inputRef.current?.click()}
        style={{
          border: '2px dashed rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: 12,
          minHeight: 84,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: '#0f0f10',
          cursor: 'pointer'
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ color: '#aaa', fontSize: '0.95em' }}>Drop image here or paste (Ctrl/Cmd+V).</div>
          <div style={{ color: '#888', fontSize: '0.85em', marginTop: 6 }}>Click to browse files or use the URL loader.</div>
          <div style={{ marginTop: 8 }}>
            <button type="button" onClick={(e) => { e.stopPropagation(); setShowUrlInput(s => !s); }} style={{ padding: '6px 10px' }}>
              {showUrlInput ? 'Cancel URL' : 'Load from URL'}
            </button>
          </div>
        </div>
        <input ref={el => { inputRef.current = el }} id={inputId} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
      </div>

      {showUrlInput && (
        <form onSubmit={(e) => { e.preventDefault(); void loadFromUrl(urlValue.trim()); }} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            type="url"
            placeholder="https://example.com/image.png"
            value={urlValue}
            onChange={e => setUrlValue(e.target.value)}
            style={{ flex: 1 }}
            aria-label="Image URL"
          />
          <button type="submit" disabled={loadingUrl}>{loadingUrl ? 'Loading...' : 'Load'}</button>
        </form>
      )}

      {/* Hover preview tooltip */}
      {hoverPreview && (
        <div
          style={{
            position: 'fixed',
            left: hoverPreview.x + 12,
            top: hoverPreview.y + 12,
            zIndex: 1000,
            border: '1px solid rgba(255,255,255,0.12)',
            background: '#0f0f10',
            padding: 4,
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hoverPreview.url} alt="Preview" style={{ width: 200, height: 200, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}
