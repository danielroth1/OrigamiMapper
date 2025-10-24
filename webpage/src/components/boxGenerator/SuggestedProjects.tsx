import { useEffect, useState, useRef } from 'react';

interface SuggestedProjectItem {
  file: string;      // path to .mapper file
  title: string;     // display title
  preview?: string;  // path to preview image (pre-generated screenshot)
}

interface SuggestedProjectsProps {
  onSelect: (fileUrl: string) => void; // callback with absolute (with base) URL to .mapper file
  manifestUrl?: string; // override manifest JSON path
  heading?: string;
}

// Utility to prefix with vite base when needed
const withBase = (u: string) => {
  if (!u) return u;
  if (/^(https?:|data:)/i.test(u)) return u;
  const base = import.meta.env.BASE_URL || '/';
  if (u.startsWith(base)) return u;
  if (u.startsWith('/')) return base + u.slice(1);
  return base + u;
};

export default function SuggestedProjects({ onSelect, manifestUrl = '/assets/examples/suggestions_projects/projects.json', heading = 'Themes' }: SuggestedProjectsProps) {
  const [projects, setProjects] = useState<SuggestedProjectItem[]>([]);
  const [hover, setHover] = useState<{ x: number; y: number; item: SuggestedProjectItem } | null>(null);
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    (async () => {
      try {
        const res = await fetch(withBase(manifestUrl), { cache: 'no-store', signal: ac.signal });
        if (!res.ok) throw new Error('Failed manifest ' + res.status);
        const json = await res.json();
        const list: SuggestedProjectItem[] = Array.isArray(json?.projects) ? json.projects : [];
        setProjects(list.filter(p => p && p.file && p.title));
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        console.warn('SuggestedProjects manifest load failed:', err);
      }
    })();
    return () => ac.abort();
  }, [manifestUrl]);

  if (projects.length === 0) return null;

  return (
    <div style={{ marginTop: '1.25em', position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: '1.1em', fontWeight: 600, textAlign: 'center', letterSpacing: 0.3 }}>{heading}</h3>
        <div style={{ width: 180, maxWidth: '70%', height: 3, background: 'linear-gradient(90deg, rgba(255,255,255,0), #ffffff 50%, rgba(255,255,255,0))', borderRadius: 2 }} />
        {(import.meta as any).env?.DEV && (
          <button
            type="button"
            disabled={generating}
            onClick={async () => {
              if (generating) return;
              setGenerating(true);
              try {
                const fn = (window as any).generateSuggestedProjectPreviews;
                if (!fn) {
                  alert('Helper not available. Ensure BoxGenerator with dev helper is loaded.');
                } else {
                  await fn({ log: true, transparent: true, outputFormat: 'webp', trim: true });
                }
              } catch (err) {
                console.warn('Preview generation failed', err);
                alert('Preview generation failed: ' + String((err as any)?.message || err));
              } finally {
                setGenerating(false);
              }
            }}
            style={{
              fontSize: '0.6em',
              padding: '4px 10px',
              borderRadius: 6,
              background: generating ? '#3a3a3a' : 'linear-gradient(135deg,#2a2a2a,#3c3c3c)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.18)',
              cursor: generating ? 'default' : 'pointer',
              letterSpacing: 0.5,
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
            }}
            title="Generate & download preview PNGs (dev only) To make them available on the website: add these to /public/assets/examples/suggestions_projects/ and update the projects.json in the same folder"
          >
            {generating ? 'Generating...' : 'Generate Previews'}
          </button>
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', paddingBottom: 6, scrollbarWidth: 'thin' }}>
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 12 }}>
          {projects.map((p, idx) => {
            const preview = p.preview ? withBase(p.preview) : undefined;
            const fileUrl = withBase(p.file);
            return (
              <button
                key={p.file + idx}
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelect(fileUrl); }}
                onMouseEnter={(e) => preview && setHover({ x: e.clientX, y: e.clientY, item: p })}
                onMouseLeave={() => setHover(null)}
                aria-label={`Load project ${p.title}`}
                style={{
                  flex: '0 0 auto',
                  width: 140,
                  minWidth: 140,
                  height: 120,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: '#101010',
                  padding: 0,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt={p.title}
                    loading="lazy"
                    style={{ width: '90%', height: '90%', objectFit: 'scale-down', display: 'block', opacity: 1.0 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.35'; }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '70%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#222,#181818)' }}>
                    <span style={{ fontSize: '0.75em', opacity: 0.7 }}>No preview</span>
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px 6px', background: 'linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.75))' }}>
                  <div style={{ fontSize: '0.7em', fontWeight: 500, lineHeight: 1.2, textAlign: 'left' }}>{p.title}</div>
                </div>
              </button>
            );
          })}
          </div>
        </div>
        {/* Edge fades */}
        <div aria-hidden="true" style={{ pointerEvents: 'none', position: 'absolute', inset: 0 }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 34, background: 'linear-gradient(90deg,#181818,rgba(24,24,24,0))' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 34, background: 'linear-gradient(270deg,#181818,rgba(24,24,24,0))' }} />
        </div>
      </div>
      <div style={{ marginTop: 10, height: 1, background: 'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.32),rgba(255,255,255,0))' }} />
      {hover?.item?.preview && (
        <div
          style={{
            position: 'fixed',
            left: hover.x + 14,
            top: hover.y + 14,
            zIndex: 2000,
            background: '#0f0f10',
            border: '1px solid rgba(255,255,255,0.18)',
            padding: 6,
            borderRadius: 8,
            boxShadow: '0 6px 20px rgba(0,0,0,0.45)'
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={withBase(hover.item.preview)} alt={hover.item.title} style={{ width: 220, height: 150, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}
