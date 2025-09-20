import React, { useState, useRef } from 'react';

interface SavedCardsSidebarProps {
  savedCards: Array<{ data: any; color: string; template: string; mana: string[] }>;
  onLoadCard: (card: { data: any; color: string; template: string; mana: string[] }, idx: number) => void;
  onExportAllPDF: () => void;
  currentCardIdx: number | null;
  // Optional deck name from loaded project
  initialDeckName?: string;
  onLoadProject: (config: { deckName: string; savedCards: Array<{ data: any; color: string; template: string; mana: string[] }>; currentCardIdx: number | null }) => void;
  onReorder?: (newSavedCards: Array<{ data: any; color: string; template: string; mana: string[] }>) => void;
}

const SavedCardsSidebar: React.FC<SavedCardsSidebarProps> = ({ savedCards, onLoadCard, onExportAllPDF, currentCardIdx, initialDeckName, onLoadProject, onReorder }) => {
  // Modal state for deck name input
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deckNameInput, setDeckNameInput] = useState('');

  // Drag-and-drop state
  const dragSrcIndex = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    dragSrcIndex.current = idx;
    try { e.dataTransfer?.setData('text/plain', String(idx)); } catch {}
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const src = dragSrcIndex.current ?? parseInt(e.dataTransfer.getData('text/plain') || '', 10);
    if (isNaN(src) || src === idx) {
      dragSrcIndex.current = null;
      return;
    }
    const newArr = [...savedCards];
    const [moved] = newArr.splice(src, 1);
    newArr.splice(idx, 0, moved);
    dragSrcIndex.current = null;
    if (onReorder) onReorder(newArr);
  };

  const handleDragEnd = () => {
    dragSrcIndex.current = null;
  };

  const openSaveModal = () => {
    // Use loaded deck name with date suffix if available, else default
    const now = new Date();
  // Build date string with dashes to avoid dots
  const dd = now.getDate();
  const mm = now.getMonth() + 1;
  const yyyy = now.getFullYear();
  const dateStr = `${dd}-${mm}-${yyyy}`;
  const baseName = initialDeckName || 'Your_Proxy_The_Gathering_Deck';
  const defaultName = `${baseName}_${dateStr}`;
    setDeckNameInput(defaultName);
    setIsModalOpen(true);
  };
  const closeSaveModal = () => {
    setIsModalOpen(false);
  };
  const handleModalSave = () => {
    const deckName = deckNameInput.trim();
    if (!deckName) {
      return;
    }
    const projectConfig = { deckName, savedCards, currentCardIdx };
    const data = JSON.stringify(projectConfig, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fileName = deckName.toLowerCase().endsWith('.json') ? deckName : `${deckName}.json`;
    link.download = fileName;
    link.click();
    closeSaveModal();
  };
  // File input ref for load project
  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggerLoadProject = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const config = JSON.parse(reader.result as string);
        onLoadProject(config);
      } catch {
        console.error('Invalid project file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">Enter Deck Name</div>
            <div className="modal-body">
              <input
                className="input-field"
                type="text"
                value={deckNameInput}
                onChange={e => setDeckNameInput(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="action-button" onClick={closeSaveModal}>Cancel</button>
              <button className="action-button" onClick={handleModalSave}>Save</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ width: '120px', background: '#222', borderRadius: '8px', padding: '0.5em', boxShadow: '0 2px 8px #0002', height: '420px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
      <h3 style={{ fontSize: '1em', marginBottom: '1em', color: '#fff', flex: 'none' }}>Saved Cards</h3>
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1em' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {savedCards.map((card, idx) => {
            const isActive = idx === currentCardIdx;
            // Map card style to color
            const styleColorMap: Record<string, string> = {
              Black: '#d61ed0ff',
              Black2: '#b600aaff',
              White: '#eee',
              Blue: '#2196f3',
              Red: '#e53935',
              Green: '#43a047',
              Yellow: '#fbc02d',
              Artifact: '#b0bec5',
            };
            const fontColor = styleColorMap[card.color] || '#fff';
            // Card style (template type) is stored in the 'template' property, not color or card.data
            const cardStyleType = card.template || 'PTG Style';
            return (
              <li key={idx} style={{ marginBottom: '0.5em' }}>
                <button
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
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
                  <span>{card.data.name && card.data.name.length > 13 ? card.data.name.slice(0, 13) + '…' : card.data.name}</span>
                  <span style={{ color: fontColor, fontSize: '0.75em', marginLeft: '0.5em' }}>{cardStyleType}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="actions">
        <input type="file" accept="application/json" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
        <button type="button" onClick={openSaveModal} className="action-button">
          Save Project
        </button>
        <button type="button" onClick={triggerLoadProject} className="action-button">
          Load Project
        </button>
        <button type="button" onClick={onExportAllPDF} className="action-button">
          Export PDF
        </button>
      </div>
    </div>
    </>
  );
};

export default SavedCardsSidebar;
