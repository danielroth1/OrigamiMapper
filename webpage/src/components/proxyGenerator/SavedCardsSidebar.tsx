import React from 'react';

interface SavedCardsSidebarProps {
  savedCards: Array<{ data: any; color: string; template: string; mana: string[] }>;
  onLoadCard: (card: { data: any; color: string; template: string; mana: string[] }, idx: number) => void;
  onExportAllPDF: () => void;
  currentCardIdx: number | null;
}

const SavedCardsSidebar: React.FC<SavedCardsSidebarProps> = ({ savedCards, onLoadCard, onExportAllPDF, currentCardIdx }) => (
  <div style={{ width: '120px', background: '#222', borderRadius: '8px', padding: '0.5em', boxShadow: '0 2px 8px #0002', height: '420px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
    <h3 style={{ fontSize: '1em', marginBottom: '1em', color: '#fff', flex: 'none' }}>Saved Cards</h3>
    <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1em' }}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {savedCards.map((card, idx) => {
          const isActive = idx === currentCardIdx;
          // Map card style to color
          // Map card style to color
          const styleColorMap: Record<string, string> = {
            Black: '#c786c5ff',
            Black2: '#914f8dff',
            White: '#eee',
            Blue: '#2196f3',
            Red: '#e53935',
            Green: '#43a047',
            Yellow: '#fbc02d',
            Artifact: '#b0bec5',
          };
          const fontColor = styleColorMap[card.color] || '#fff';
          // Card style (template type) is stored in card.data.cardStyleType or similar; fallback to 'PTG Style' if missing
          const cardStyleType = card.data.cardTemplateType || card.data.cardStyleType || 'PTG Style';
          return (
            <li key={idx} style={{ marginBottom: '0.5em' }}>
              <button
                style={{
                  width: '100%',
                  background: '#333',
                  color: fontColor,
                  border: isActive ? '2px solid #fff' : 'none',
                  borderRadius: '6px',
                  padding: '0.3em',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.8em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontWeight: 'normal',
                  boxSizing: 'border-box'
                }}
                onClick={() => onLoadCard(card, idx)}
              >
                <span>{card.data.name}</span>
                <span style={{ color: fontColor, fontSize: '0.75em', marginLeft: '0.5em' }}>{cardStyleType}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
      <button
        type="button"
        onClick={onExportAllPDF}
        style={{
          width: '100%',
          padding: '0.5em',
          background: '#222',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 2px 6px #0003',
          fontSize: '0.95em'
        }}
      >
        Export PDF
      </button>
    </div>
  </div>
);

export default SavedCardsSidebar;
