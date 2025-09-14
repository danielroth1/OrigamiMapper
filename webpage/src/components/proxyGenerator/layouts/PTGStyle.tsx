import React, { forwardRef, useState, useRef, useEffect } from 'react';

interface PTGStyleProps {
  cardData: any;
  frame: any;
  manaSelects: string[];
  manaIcons: Record<string, (color: string) => React.ReactNode>;
  onImageOffsetChange?: (x: number, y: number) => void;
}

const PTGStyle = forwardRef<HTMLDivElement, PTGStyleProps>(({ 
  cardData,
  frame,
  manaSelects,
  manaIcons,
  onImageOffsetChange
}, ref) => {
  const [offset, setOffset] = useState<{x:number,y:number}>({ x: cardData.imageOffsetX ?? 0, y: cardData.imageOffsetY ?? 0 });
  const draggingRef = useRef({ dragging: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 });

  useEffect(() => {
    // Sync local offset if cardData changes externally
    setOffset({ x: cardData.imageOffsetX ?? 0, y: cardData.imageOffsetY ?? 0 });
  }, [cardData.imageOffsetX, cardData.imageOffsetY]);

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

  const imageTransform = (() => {
    const parts: string[] = [];
    parts.push(`translate(${offset.x}px, ${offset.y}px)`);
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
    </div>
    <div style={{
      width: '92%',
      height: '48%',
      margin: '0 auto',
      position: 'relative',
      zIndex: 2,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: frame.artFallback,
      border: frame.artBorder ? `1px solid ${frame.artBorder}` : undefined
    }}>
      {cardData.image ? (
        <img
          src={cardData.image}
          alt="Card art preview"
          style={{
            width: '100%',
            height: '100%',
            objectFit: (cardData.imageFit || 'cover') as any,
            // Apply CSS transforms: translate (pan) + rotation/flips
        transform: imageTransform,
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
