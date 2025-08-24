import React, { forwardRef } from 'react';

interface PTGStyleProps {
  cardData: any;
  frame: any;
  manaSelects: string[];
  manaIcons: Record<string, (color: string) => React.ReactNode>;
}

const PTGStyle = forwardRef<HTMLDivElement, PTGStyleProps>(({
  cardData,
  frame,
  manaSelects,
  manaIcons
}, ref) => (
  <div
    ref={ref}
    style={{
      margin: '0 auto',
      width: '300px',
      height: '420px',
      background: frame.cardFrame,
  // Prefer an explicit outerBorder. Only fall back to cardFrame when it's a solid color (hex).
  border: (() => {
    const outer = frame.outerBorder;
    if (outer) return `2px solid ${outer}`;
    const cf = frame.cardFrame;
    if (typeof cf === 'string' && cf.trim().startsWith('#')) return `2px solid ${cf}`;
    return undefined;
  })(),
      borderRadius: '12px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
      overflow: 'hidden',
      fontFamily: 'Trebuchet MS, Verdana, Arial, sans-serif',
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
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'cover',
            boxShadow: '0 2px 8px #0004'
          }}
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
      {cardData.rulesText}
      {cardData.flavorText && (
        <div className="card-flavor-text" style={{ fontStyle: 'italic', marginTop: '0.5em', color: frame.flavorTextColor || '#444' }}>
          {cardData.flavorText}
        </div>
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
    <div style={{
      position: 'absolute',
      bottom: '0.4em',
      left: '18.0em',
      fontSize: '0.6em',
      color: frame.copyrightText,
      zIndex: 3
    }}>{cardData.copyright}</div>
  </div>
));

export default PTGStyle;
