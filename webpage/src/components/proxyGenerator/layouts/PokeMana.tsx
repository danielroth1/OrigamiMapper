import React, { forwardRef, useState, useRef, useEffect } from 'react';

interface PokeManaProps {
  cardData: any;
  frame: any;
  manaSelects: string[];
  manaIcons: Record<string, (color: string) => React.ReactNode>;
  onImageOffsetChange?: (x: number, y: number) => void;
  onImageZoomChange?: (zoom: number) => void;
}

const PokeMana = forwardRef<HTMLDivElement, PokeManaProps>(({ cardData, frame, manaSelects, manaIcons, onImageOffsetChange, onImageZoomChange }, ref) => {
  const [offset, setOffset] = useState<{x:number,y:number}>({ x: cardData.imageOffsetX ?? 0, y: cardData.imageOffsetY ?? 0 });
  const [zoom, setZoom] = useState<number>(cardData.imageZoom ?? 1);
  const draggingRef = useRef({ dragging: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 });

  useEffect(() => {
    setOffset({ x: cardData.imageOffsetX ?? 0, y: cardData.imageOffsetY ?? 0 });
    setZoom(cardData.imageZoom ?? 1);
  }, [cardData.imageOffsetX, cardData.imageOffsetY, cardData.imageZoom]);

  const onPointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if ('button' in e && e.button !== 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
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
    setOffset({ x: draggingRef.current.startOffsetX + dx, y: draggingRef.current.startOffsetY + dy });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!draggingRef.current.dragging) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    draggingRef.current.dragging = false;
    if (typeof onImageOffsetChange === 'function') onImageOffsetChange(offset.x, offset.y);
  };

  const cursorStyle = draggingRef.current.dragging ? 'grabbing' : 'grab';

  const clamp = (v:number, a:number, b:number) => Math.max(a, Math.min(b, v));

  const artRef = useRef<HTMLDivElement | null>(null);

  // Attach a native wheel listener with passive: false to reliably prevent page scrolling
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

  return (
  <div
    ref={ref}
    style={{
      margin: '2em auto',
      width: '300px',
      height: '420px',
      background: frame.cardFrame,
      border: (() => {
        const outer = frame.outerBorder;
        if (outer) return `2px solid ${outer}`;
        const cf = frame.cardFrame;
        if (typeof cf === 'string' && cf.trim().startsWith('#')) return `2px solid ${cf}`;
        return undefined;
      })(),
      borderRadius: '12px',
      overflow: 'hidden',
      position: 'relative',
      fontFamily: 'Trebuchet MS, Verdana, Arial, sans-serif',
      fontWeight: 'bold',
      display: 'flex',
      flexDirection: 'column'
    }}
  >
    {/* Header aligned with PTGStyle */}
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
      {cardData.showMana !== false && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25em', marginLeft: '0.5em', fontFamily: 'monospace', color: frame.manaCostText }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.18em' }}>
            {manaSelects.map((symbol, i) => {
              if (!symbol) return null;
              const color = frame.manaIconColors?.[symbol] || '#000';
              return (
                <span key={i}>
                  {manaIcons[symbol] ? manaIcons[symbol](color) : symbol}
                </span>
              );
            })}
          </span>
          {cardData.manaCost && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.4em',
              height: '1.4em',
              borderRadius: '50%',
              background: frame.manaCostBg,
              border: `2px solid ${frame.manaCostText}`,
              fontSize: '1.1em',
              fontWeight: 'bold',
              color: frame.manaCostText,
              lineHeight: 1
            }}>{cardData.manaCost}</span>
          )}
        </span>
      )}
    </div>

    {/* Main art or icon area (footer excluded) */}
  <div ref={artRef} style={{
      flex: '1 1 auto',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: frame.artFallback,
      border: frame.artBorder ? `1px solid ${frame.artBorder}` : undefined,
      margin: '0.7em 0.5em 0 0.5em', // no bottom margin, footer is reserved
      minHeight: 0,
      height: 'calc(100% - 36px)', // 36px reserved for footer
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      {cardData.image ? (
        (() => {
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
          const imageTransform = parts.join(' ');
          return (
            <img
          src={cardData.image}
          alt="Card art preview"
          style={{
            width: '100%',
            height: '100%',
            objectFit: (cardData.imageFit || 'contain') as any,
              // Apply CSS transforms: translate (pan) + scale + rotation/flips
              transform: imageTransform,
            display: 'block',
            cursor: cursorStyle,
            touchAction: 'none'
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
          );
        })()
      ) : cardData.box ? (
        <span style={{ color: frame.manaCostText, fontSize: '2.5em', fontWeight: 'bold', textTransform: 'uppercase' }}>{cardData.box}</span>
      ) : (
        (() => {
          // Prefer same icons as manaIcons via a symbol; fallback to frame.icon, else '?'
          const colorToSymbol: Record<string, string> = {
            Red: 'R', Red2: 'R',
            Blue: 'U', Blue2: 'U',
            Green: 'G',
            White: 'W', White2: 'W',
            Black: 'B', Black2: 'B',
            Yellow: 'Y',
            Artifact: 'A'
          };
          const symbol = (frame?.iconSymbol as string) || colorToSymbol[(frame?.color as string) || ''] || '';
          if (symbol && manaIcons[symbol]) {
            const iconColor = (frame?.manaIconColors?.[symbol]) || frame?.manaCostText || '#000';
            return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '70%', height: '70%', fontSize: '3.2em' }}>{manaIcons[symbol](iconColor)}</span>;
          }
          if (frame?.icon) {
            return <span style={{ color: frame.manaCostText, fontSize: '4.5em' }}>{frame.icon}</span>;
          }
          return <span style={{ color: frame.manaCostText, fontSize: '4.5em' }}>?</span>;
        })()
      )}
    </div>

    {/* Footer with bottom text / collector number */}
    <div style={{
      height: '36px',
      padding: '0.3em 0.6em',
      fontSize: '0.8em',
      color: frame.bottomInfoText,
      background: frame.bottomInfoBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
      zIndex: 2
    }}>
      <span>{cardData.bottomText || ''}</span>
    </div>

    {cardData.showPT !== false && (
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
    )}
  {/* Vertical right-side info (rarity • setCode • language • collectorNo) */}
  {(cardData?.collectorNo || cardData?.rarity || cardData?.setCode || cardData?.language) && (
      <div
        style={{
          position: 'absolute',
          top: '0.5em',
          bottom: '0.5em',
          // Slightly closer to the outer border so preview and
          // exported PDF match more tightly on the right edge.
          right: '0.05em',
          writingMode: 'vertical-rl',
          // Use upright orientation for Latin glyphs to get consistent
          // rendering across browsers and html2canvas captures.
          textOrientation: 'upright',
          fontSize: '0.45em', // very small
          lineHeight: 1.1,
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: frame.bottomInfoText || '#666',
          zIndex: 4,
          pointerEvents: 'none',
          opacity: 0.9
        }}
      >
        <span>
          {[
            cardData?.rarity,
            cardData?.setCode,
            cardData?.language,
            cardData?.collectorNo
          ].filter(Boolean).join('\u00A0•\u00A0')}
        </span>
      </div>
    )}
    </div>
  );
});

export default PokeMana;
