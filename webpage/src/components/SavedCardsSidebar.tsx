import React from 'react';

interface SavedCardsSidebarProps {
  savedCards: Array<{ data: any; style: string; mana: string[] }>;
  onLoadCard: (card: { data: any; style: string; mana: string[] }) => void;
  onExportAllPDF: () => void;
}

const SavedCardsSidebar: React.FC<SavedCardsSidebarProps> = ({ savedCards, onLoadCard, onExportAllPDF }) => (
  <div style={{ width: '120px', background: '#222', borderRadius: '8px', padding: '0.5em', boxShadow: '0 2px 8px #0002', height: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
    <h3 style={{ fontSize: '1em', marginBottom: '1em', color: '#fff' }}>Saved Cards</h3>
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1 }}>
      {savedCards.map((card, idx) => (
        <li key={idx} style={{ marginBottom: '0.5em' }}>
          <button
            style={{ width: '100%', background: '#333', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.3em', cursor: 'pointer', textAlign: 'left', fontSize: '0.8em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            onClick={() => onLoadCard(card)}
          >
            <span>{card.data.name}</span>
            <span style={{ color: '#aaa', fontSize: '0.75em', marginLeft: '0.5em' }}>{card.style}</span>
          </button>
        </li>
      ))}
    </ul>
    <button
      type="button"
      onClick={onExportAllPDF}
      style={{
        width: '100%',
        marginTop: '1em',
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
      Export All to PDF
    </button>
  </div>
);

export default SavedCardsSidebar;
