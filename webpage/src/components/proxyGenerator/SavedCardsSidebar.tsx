import React, { useState, useRef } from 'react';

interface SavedCardEntry {
  data: any;
  color: string;
  template: string;
  mana: string[];
  numberOfCopies: number;
}

interface ProjectConfig {
  deckName?: string;
  savedCards: SavedCardEntry[];
  currentCardIdx: number | null;
}

interface SavedCardsSidebarProps {
  savedCards: SavedCardEntry[];
  onLoadCard: (card: SavedCardEntry, idx: number) => void;
  onExportAllPDF: () => void;
  currentCardIdx: number | null;
  // Optional deck name from loaded project
  initialDeckName?: string;
  isExportingPDF?: boolean;
  onLoadProject: (config: ProjectConfig) => void;
  onReorder?: (newSavedCards: SavedCardEntry[]) => void;
}

const SavedCardsSidebar: React.FC<SavedCardsSidebarProps> = ({ savedCards, onLoadCard, onExportAllPDF, currentCardIdx, initialDeckName, isExportingPDF = false, onLoadProject, onReorder }) => {
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
        const config = JSON.parse(reader.result as string) as ProjectConfig;
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
      <div className="saved-cards-sidebar">
        <h3 className="saved-cards-title">Saved Cards</h3>
        <div className="saved-cards-list">
          <ul className="saved-cards-items">
            {savedCards.map((card, idx) => {
              if (!card) return null;
              const isActive = idx === currentCardIdx;
              // Map card style to color
              const styleColorMap: Record<string, string> = {
                Black: 'hsla(304, 100%, 78%, 1.00)',
                Black2: 'hsla(281, 100%, 60%, 1.00)',
                White: '#eee',
                White2: '#f5f5f5',
                Blue: '#2196f3',
                Blue2: '#64b5f6',
                Red: '#e53935',
                Red2: '#ef5350',
                Green: '#43a047',
                Yellow: '#fbc02d',
                Artifact: '#b0bec5',
              };
              const fontColor = styleColorMap[card.color ?? ''] || '#fff';
              const displayName = (card.data && card.data.name) ? card.data.name : 'Untitled Card';
              const copiesLabel = Number.isFinite(card.numberOfCopies) && card.numberOfCopies > 0
                ? card.numberOfCopies
                : 1;
              return (
                <li key={idx} className="saved-cards-item">
                  <button
                    type="button"
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`saved-card-button${isActive ? ' saved-card-button--active' : ''}`}
                    style={{ color: fontColor }}
                    onClick={() => onLoadCard(card, idx)}
                  >
                    <span className="saved-card-name" title={displayName}>{displayName}</span>
                    <span className="saved-card-copies" style={{ color: fontColor }} aria-label="Copies">x{copiesLabel}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="saved-cards-actions">
          <input type="file" accept="application/json" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
          <button type="button" onClick={openSaveModal} className="action-button">
            Save Project
          </button>
          <button type="button" onClick={triggerLoadProject} className="action-button">
            Load Deck
          </button>
          <button
            type="button"
            onClick={onExportAllPDF}
            className="action-button"
            disabled={isExportingPDF}
          >
            {isExportingPDF ? (
              <span className="action-button-label">
                <span className="inline-spinner" aria-hidden="true" />
                Exporting PDF…
              </span>
            ) : 'Export PDF'}
          </button>
        </div>
      </div>
    </>
  );
};

export default SavedCardsSidebar;
