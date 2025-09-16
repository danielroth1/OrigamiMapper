import React, { forwardRef, useState, useRef, useEffect } from 'react';

interface PTGStyleProps {
  cardData: any;
  frame: any;
  manaSelects: string[];
  manaIcons: Record<string, (color: string) => React.ReactNode>;
  onImageOffsetChange?: (x: number, y: number) => void;
  onImageZoomChange?: (zoom: number) => void;
}

const PTGStyle = forwardRef<HTMLDivElement, PTGStyleProps>(({ 
  cardData,
  frame,
  manaSelects,
  manaIcons,
  onImageOffsetChange,
  onImageZoomChange
}, ref) => {
  const [offset, setOffset] = useState<{x:number,y:number}>({ x: cardData.imageOffsetX ?? 0, y: cardData.imageOffsetY ?? 0 });
  const [zoom, setZoom] = useState<number>(cardData.imageZoom ?? 1);
  const draggingRef = useRef({ dragging: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 });

  useEffect(() => {
    // Sync local offset if cardData changes externally
    setOffset({ x: cardData.imageOffsetX ?? 0, y: cardData.imageOffsetY ?? 0 });
  }, [cardData.imageOffsetX, cardData.imageOffsetY]);

  useEffect(() => {
    setZoom(cardData.imageZoom ?? 1);
  }, [cardData.imageZoom]);

  const onPointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    // Only left button
    if ('button' in e && e.button !== 0) return;
    const target = e.currentTarget as Element;
    try { target.setPointerCapture(e.pointerId); } catch {}
    draggingRef.current.dragging = true;
    draggingRef.current.startX = e.clientX;
    draggingRef.current.startY = e.clientY;
    draggingRef.current.startOffsetX = offset.x;
    draggingRef.current.startOffsetY = offset.y;
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!draggingRef.current.dragging) return;
    const dx = e.clientX - draggingRef.current.startX;
    const dy = e.clientY - draggingRef.current.startY;
    const next = { x: draggingRef.current.startOffsetX + dx, y: draggingRef.current.startOffsetY + dy };
    setOffset(next);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!draggingRef.current.dragging) return;
    const target = e.currentTarget as Element;
    try { target.releasePointerCapture(e.pointerId); } catch {}
    draggingRef.current.dragging = false;
    // persist if handler provided
    if (typeof onImageOffsetChange === 'function') onImageOffsetChange(offset.x, offset.y);
  };

  const cursorStyle = draggingRef.current.dragging ? 'grabbing' : 'grab';
  // Compute some derived style bits outside JSX to avoid inline IIFEs in JSX
  const outerBorderStyle = (() => {
    const outer = frame.outerBorder;
    if (outer) return `2px solid ${outer}`;
    const cf = frame.cardFrame;
    if (typeof cf === 'string' && cf.trim().startsWith('#')) return `2px solid ${cf}`;
    return undefined;
  })();

  const clamp = (v:number, a:number, b:number) => Math.max(a, Math.min(b, v));

  const imageTransform = (() => {
    const parts: string[] = [];
    parts.push(`translate(${offset.x}px, ${offset.y}px)`);
    parts.push(`scale(${zoom})`);
    switch (cardData.imageTransform) {
      case 'rotate90': parts.push('rotate(90deg)'); break;
      case 'rotate180': parts.push('rotate(180deg)'); break;
      case 'rotate270': parts.push('rotate(270deg)'); break;
      case 'flipH': parts.push('scaleX(-1)'); break;
      case 'flipV': parts.push('scaleY(-1)'); break;
      default: break;
    }
    return parts.join(' ');
  })();

  const imageFilter = (() => {
    switch (cardData.imageFilter) {
      case 'grayscale': return 'grayscale(100%)';
      case 'invert': return 'invert(100%)';
      case 'saturate': return 'saturate(180%)';
      default: return 'none';
    }
  })();

  const artRef = useRef<HTMLDivElement | null>(null);
  const [autoBg, setAutoBg] = useState<string | null>(null);
  // When automatic background mode is selected, compute left/right average colors and build a gradient
  React.useEffect(() => {
    if (cardData.imageBgMode !== 'auto') { setAutoBg(null); return; }
    // If the parent already computed an automatic background (on upload), prefer it
    if ((cardData as any).imageBgAuto) { setAutoBg((cardData as any).imageBgAuto); return; }
    if (!cardData.image) { setAutoBg(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);
        const ctx = canvas.getContext('2d');
        if (!ctx) { setAutoBg(null); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Sample left and right 20% vertical strips
        const sampleWidth = Math.max(1, Math.round(canvas.width * 0.2));
        const leftX = 0;
        const rightX = Math.max(0, canvas.width - sampleWidth);
        const ys = Math.round(canvas.height * 0.0);
        const sampleH = canvas.height;
        const leftData = ctx.getImageData(leftX, ys, sampleWidth, sampleH).data;
        const rightData = ctx.getImageData(rightX, ys, sampleWidth, sampleH).data;
        const avgColor = (data: Uint8ClampedArray) => {
          let r = 0, g = 0, b = 0, a = 0, count = 0;
          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i+3];
            if (alpha === 0) continue; // ignore fully transparent
            r += data[i]; g += data[i+1]; b += data[i+2]; a += alpha; count++;
          }
          if (count === 0) return [255,255,255];
          return [Math.round(r/count), Math.round(g/count), Math.round(b/count)];
        };
        const l = avgColor(leftData);
        const r = avgColor(rightData);
        const leftColor = `rgb(${l[0]}, ${l[1]}, ${l[2]})`;
        const rightColor = `rgb(${r[0]}, ${r[1]}, ${r[2]})`;
        // build a linear gradient left->right
        setAutoBg(`linear-gradient(90deg, ${leftColor} 0%, ${leftColor} 20%, ${rightColor} 80%, ${rightColor} 100%)`);
      } catch (e) {
        setAutoBg(null);
      }
    };
    img.onerror = () => setAutoBg(null);
    img.src = cardData.image;
  }, [cardData.image, cardData.imageBgMode]);
  React.useEffect(() => {
    const el = artRef.current;
    if (!el) return;
    const handler = (ev: WheelEvent) => {
      ev.preventDefault();
      const delta = -ev.deltaY;
      const factor = delta > 0 ? 1.08 : 0.92;
      setZoom(prev => {
        const next = clamp(+(prev * factor).toFixed(4), 0.2, 3);
        if (typeof onImageZoomChange === 'function') onImageZoomChange(next);
        return next;
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [onImageZoomChange]);

  const pwPairs = [1,2,3].map(i => ({ stat: cardData[`pwStat${i}`] ?? '', desc: cardData[`pwDesc${i}`] || '' }));

  return (
    <div
    ref={ref}
    style={{
      margin: '0 auto',
      width: '300px',
      height: '420px',
      background: frame.cardFrame,
      // Prefer an explicit outerBorder. Only fall back to cardFrame when it's a solid color (hex).
      border: outerBorderStyle,
      borderRadius: '12px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
      overflow: 'hidden',
      fontFamily: 'Trebuchet MS, Verdana, Arial, sans-serif',
      fontWeight: 'bold',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column'
    }}
  >
    {frame.innerBorder && (
      <div style={{
        position: 'absolute',
        top: '8px',
        left: '8px',
        right: '8px',
        bottom: '8px',
        border: `2px solid ${frame.innerBorder}`,
        borderRadius: '8px',
        pointerEvents: 'none',
        zIndex: 1
      }} />
    )}
    <div style={{
      background: frame.titleBar,
      borderBottom: frame.titleBarBorder ? `1px solid ${frame.titleBarBorder}` : undefined,
      padding: '0.4em 0.6em',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: frame.titleBarText,
      position: 'relative',
      zIndex: 2
    }}>
      <span style={{ fontWeight: 'bold', fontSize: '1em', color: frame.titleBarText }}>{cardData.name}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25em', marginLeft: '0.5em', fontFamily: 'monospace', color: frame.manaCostText }}>
        {cardData.manaCost && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.25em',
            height: '1.25em',
            borderRadius: '50%',
            background: frame.manaCostBg,
            border: `1px solid ${frame.manaCostText}`,
            fontSize: '1.15em',
            fontWeight: 900,
            color: frame.manaCostText,
            lineHeight: 1
          }}>{cardData.manaCost}</span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.18em' }}>
          {manaSelects.map((symbol, i) => {
            if (!symbol) return null;
            const color = frame.manaIconColors && frame.manaIconColors[symbol] ? frame.manaIconColors[symbol] : '#000';
            return (
              <span key={i}>
                {manaIcons[symbol] ? manaIcons[symbol](color) : symbol}
              </span>
            );
          })}
        </span>
      </span>
    </div>
  <div ref={artRef} style={{
      width: '92%',
      height: '48%',
      margin: '0 auto',
      position: 'relative',
      zIndex: 2,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
  background: autoBg || cardData.imageBg || frame.artFallback,
      border: frame.artBorder ? `1px solid ${frame.artBorder}` : undefined
    }}>
      {cardData.image ? (
          <img
          src={cardData.image}
          alt="Card art preview"
          style={{
            width: '100%',
            height: '100%',
            objectFit: (cardData.imageFit || 'contain') as any,
            // Apply CSS transforms: translate (pan) + rotation/flips
        transform: imageTransform,
            // Apply color filter (grayscale/invert/saturate)
            filter: imageFilter,
            boxShadow: '0 2px 8px #0004',
            cursor: cursorStyle,
            touchAction: 'none'
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      ) : null}
    </div>
    <div style={{
      background: frame.typeLineBg,
      borderBottom: frame.typeLineBorder ? `1px solid ${frame.typeLineBorder}` : undefined,
      padding: '0.3em 0.6em',
      fontStyle: 'italic',
      fontSize: '0.85em',
      color: frame.typeLineText,
      textAlign: 'left',
      position: 'relative',
      zIndex: 2
    }}>{cardData.typeLine}</div>
    <div style={{
      background: frame.textBoxBg,
      padding: '0.5em 0.6em',
      fontSize: '0.8em',
      flex: '1',
      whiteSpace: 'pre-line',
      color: frame.textBoxText,
      position: 'relative',
      zIndex: 2
    }}>
      {cardData.pwEnabled === true ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6em' }}>
          {pwPairs.map((p, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '0.8em', alignItems: 'flex-start' }}>
              <div style={{
                width: '2.8em',
                height: '2.8em',
                border: `1px solid ${frame.powerToughnessBorder}`,
                background: frame.powerToughnessBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                color: frame.powerToughnessTextColor || '#000'
              }}>{p.stat}</div>
              <div style={{ flex: 1, fontSize: '0.85em', color: frame.textBoxText }}>{p.desc}</div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {cardData.rulesText}
          {cardData.flavorText && (
            <div className="card-flavor-text" style={{ fontStyle: 'italic', marginTop: '0.5em', color: frame.flavorTextColor || '#444' }}>
              {cardData.flavorText}
            </div>
          )}
        </>
      )}
    </div>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '0.7em',
      padding: '0.3em 0.6em',
      borderTop: frame.bottomInfoBorder ? `1px solid ${frame.bottomInfoBorder}` : undefined,
      color: frame.bottomInfoText,
      background: frame.bottomInfoBg,
      position: 'relative',
      zIndex: 2
    }}>
      <span>{cardData.collectorNo} • {cardData.rarity} • {cardData.setCode} • {cardData.language}</span>
    </div>
  {cardData.pwEnabled === true ? (
      <div style={{
        position: 'absolute',
        bottom: '0.4em',
        right: '0.4em',
        border: `1px solid ${frame.powerToughnessBorder}`,
        background: frame.powerToughnessBg,
        padding: '0 0.2em',
        fontWeight: 'bold',
        fontSize: '0.9em',
        color: frame.powerToughnessTextColor || '#000',
        zIndex: 3
      }}>
        {cardData.pwLife ?? ''}
      </div>
    ) : (cardData.showPT !== false && (
      <div style={{
        position: 'absolute',
        bottom: '0.4em',
        right: '0.4em',
        border: `1px solid ${frame.powerToughnessBorder}`,
        background: frame.powerToughnessBg,
        padding: '0 0.2em',
        fontWeight: 'bold',
        fontSize: '0.9em',
        color: frame.powerToughnessTextColor || '#000',
        zIndex: 3
      }}>
        {cardData.power}/{cardData.toughness}
      </div>
    ))}
    <div style={{
      position: 'absolute',
      bottom: '0.4em',
      left: '18.0em',
      fontSize: '0.6em',
      color: frame.copyrightText,
      zIndex: 3
    }}>{cardData.copyright}</div>
    </div>
  );
});

export default PTGStyle;
