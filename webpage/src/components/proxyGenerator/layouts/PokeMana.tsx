import React, { forwardRef } from 'react';

interface PokeManaProps {
  cardData: any;
  frame: any;
  manaSelects: string[];
  manaIcons: Record<string, (color: string) => React.ReactNode>;
}

const PokeMana = forwardRef<HTMLDivElement, PokeManaProps>(({ cardData, frame, manaSelects, manaIcons }, ref) => (
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
      display: 'flex',
      flexDirection: 'column'
    }}
  >
    {/* Header with name and mana symbols */}
    <div style={{
      background: frame.titleBar,
      padding: '0.5em',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: frame.titleBarText,
      fontSize: '1.2em',
      textTransform: 'uppercase'
    }}>
      <span style={{ fontWeight: 'bold' }}>{cardData.name}</span>
      <span>
        {manaSelects.map((symbol, i) => {
          if (!symbol) return null;
          const color = frame.manaIconColors?.[symbol] || '#000';
          return (
            <span key={i} style={{ marginLeft: '0.3em' }}>
              {manaIcons[symbol] ? manaIcons[symbol](color) : symbol}
            </span>
          );
        })}
      </span>
    </div>

    {/* Main art or icon area (footer excluded) */}
    <div style={{
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
        <img
          src={cardData.image}
          alt="Card art preview"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block'
          }}
        />
      ) : cardData.box ? (
        <span style={{ color: frame.manaCostText, fontSize: '2.5em', fontWeight: 'bold', textTransform: 'uppercase' }}>{cardData.box}</span>
      ) : (
        <span style={{ color: frame.manaCostText, fontSize: '4em' }}>?</span>
      )}
    </div>

    {/* Footer with collector number (reserved area) */}
    <div style={{
      height: '36px',
      padding: '0.3em 0.6em',
      fontSize: '0.8em',
      color: frame.bottomInfoText,
      background: frame.bottomInfoBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      boxSizing: 'border-box',
      zIndex: 2
    }}>
      <span>{cardData.collectorNo}</span>
    </div>
  </div>
));

export default PokeMana;
