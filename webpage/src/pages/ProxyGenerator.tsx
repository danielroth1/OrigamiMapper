import React, { useState, useRef, useMemo, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { PDFDocument, rgb } from 'pdf-lib';
import { computeAutoBgFromDataUrl, mmToPt } from './BackgroundImageUtils';
import { IoLeafSharp, IoSkullSharp, IoFlashSharp, IoWater, IoCog } from 'react-icons/io5';
import { GiSun, GiHand } from 'react-icons/gi';
import { BsFire } from 'react-icons/bs';
import CardPreview from '../components/proxyGenerator/CardPreview';
import SavedCardsSidebar from '../components/proxyGenerator/SavedCardsSidebar';
import CardConfigForm from '../components/proxyGenerator/CardConfigForm';
import './ProxyGenerator.css';
import blackFrame from '../cardStyles/black.json';
import black2Frame from '../cardStyles/black2.json';
import whiteFrame from '../cardStyles/white.json';
import white2Frame from '../cardStyles/white2.json';
import blueFrame from '../cardStyles/blue.json';
import blue2Frame from '../cardStyles/blue2.json';
import redFrame from '../cardStyles/red.json';
import red2Frame from '../cardStyles/red2.json';
import greenFrame from '../cardStyles/green.json';
import artifactFrame from '../cardStyles/artifact.json';
import yellowFrame from '../cardStyles/yellow.json';

const currentYear = new Date().getFullYear();
const initialCardData = {
  image: '',
  imageFit: 'contain', // contain | fill
  imageBgMode: 'auto',
  imageTransform: 'none', // none | rotate90 | rotate180 | rotate270 | flipH | flipV
  name: 'Electro Rat',
  // keep a separate copy of the regular (non-mana) name so we can restore it
  normalName: 'Electro Rat',
  manaCost: '3',
  typeLine: 'Creature — Plague Rat',
  power: 4,
  toughness: 4,
  rulesText: "Proxy the Gathering is the best game ever created.\n Pay {B} to draw two cards.",
  flavorText: "'This is a sample flavor text to show how it looks on the card.'",
  collectorNo: '0217',
  rarity: 'M',
  setCode: 'PTG',
  language: 'EN',
  artist: 'Jonas Roth',
  copyright: `©${currentYear} Jonas Roth`,
  showPT: true,
  // Planeswalker defaults
  pwEnabled: false,
  pwLife: 4,
  pwStat1: '+1',
  pwDesc1: 'Create a 1/1 black Zombie creature token with deathtouch.',
  pwStat2: '-2',
  pwDesc2: 'Up to one target creature gets -X/-X until your next turn, where X is the number of Zombies you control.',
  pwStat3: '-7',
  pwDesc3: 'Exile all creature cards from graveyards. For each card exiled this way, create a 2/2 black Zombie creature token.',
  showMana: true,
  useCustomTitle: false,
  bottomText: '',
};

const cloneInitialCardData = (): typeof initialCardData => JSON.parse(JSON.stringify(initialCardData));

const createEmptyManaSlots = (): string[] => ['', '', '', '', ''];

const COPIES_MIN = 1;
const COPIES_MAX = 99;

const sanitizeCopies = (value?: number | string | null): number => {
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return Math.max(COPIES_MIN, Math.min(COPIES_MAX, parsed));
    }
    return COPIES_MIN;
  }
  if (typeof value === 'number') {
    const normalized = Math.floor(value);
    if (!Number.isFinite(normalized)) return COPIES_MIN;
    return Math.max(COPIES_MIN, Math.min(COPIES_MAX, normalized));
  }
  return COPIES_MIN;
};

const normalizeManaSlots = (mana?: string[]): string[] => {
  if (!Array.isArray(mana)) return createEmptyManaSlots();
  const slots = mana.slice(0, 5);
  while (slots.length < 5) slots.push('');
  return slots;
};

type SavedCardEntry = {
  data: typeof initialCardData;
  color: string;
  template: string;
  mana: string[];
  numberOfCopies: number;
};

type ProjectConfig = {
  deckName?: string;
  savedCards: SavedCardEntry[];
  currentCardIdx: number | null;
};

const normalizeSavedCard = (card?: Partial<SavedCardEntry>): SavedCardEntry => {
  const mana = normalizeManaSlots(card?.mana);
  return {
    data: card?.data ?? cloneInitialCardData(),
    color: card?.color ?? 'Black',
    template: card?.template ?? 'PTG Style',
    mana,
    numberOfCopies: sanitizeCopies(card?.numberOfCopies),
  };
};

const frameDefs: Record<string, any> = {
  Black: blackFrame,
  Black2: black2Frame,
  White: whiteFrame,
  White2: white2Frame,
  Blue: blueFrame,
  Blue2: blue2Frame,
  Red: redFrame,
  Red2: red2Frame,
  Green: greenFrame,
  Yellow: yellowFrame,
  Artifact: artifactFrame,
};

const ProxyGenerator: React.FC = () => {
  const [cardData, setCardData] = useState(initialCardData);
  // Card color (frame) and template layout (style)
  const [cardColor, setCardColor] = useState('Black');
  const [templateType, setTemplateType] = useState('PTG Style');
  const [manaSelects, setManaSelects] = useState<string[]>(createEmptyManaSlots());
  // savedCards entries now include color, template, and copy count for switchable layouts
  const [savedCards, setSavedCards] = useState<SavedCardEntry[]>([]);
  const [cardCopies, setCardCopies] = useState<number>(COPIES_MIN);
  const [currentCardIdx, setCurrentCardIdx] = useState<number | null>(null);
  const [deckName, setDeckName] = useState<string | undefined>(undefined);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  // Track if default project has been loaded to avoid re-adding it
  const [defaultLoaded, setDefaultLoaded] = useState(false);
  const DB_NAME = 'proxy-generator';
  const STORE_NAME = 'settings';
  const DB_VERSION = 1;
  const openDB = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const putItem = async (item: any) => {
    const db = await openDB();
    return new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const r = store.put(item);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  };
  const getItem = async (id: string) => {
    const db = await openDB();
    return new Promise<any>((res, rej) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const r = store.get(id);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  };
  // Autosave current state under id 'autosave'
  const saveAutosave = async () => {
    try {
      const item = {
        id: 'autosave',
        updatedAt: Date.now(),
        cardData,
        cardColor,
        templateType,
        manaSelects,
        savedCards,
        currentCardIdx,
        defaultLoaded,
        cardCopies,
        deckName,
      };
      await putItem(item);
    } catch (err) {
      console.warn('Failed to save settings:', err);
    }
  };
  // Load saved settings
  const loadAutosave = async () => {
    try {
      const rec = await getItem('autosave');
      if (!rec) return;
      setCardData(rec.cardData || initialCardData);
      setCardColor(rec.cardColor || 'Black');
      setTemplateType(rec.templateType || 'PTG Style');
      setManaSelects(normalizeManaSlots(rec.manaSelects));
      const normalizedSavedCards = Array.isArray(rec.savedCards)
        ? rec.savedCards.map((card: Partial<SavedCardEntry>) => normalizeSavedCard(card))
        : [];
      setSavedCards(normalizedSavedCards);
      const sanitizedCopies = sanitizeCopies(rec.cardCopies);
      if (typeof rec.currentCardIdx === 'number' && normalizedSavedCards[rec.currentCardIdx]) {
        setCurrentCardIdx(rec.currentCardIdx);
        setCardCopies(normalizedSavedCards[rec.currentCardIdx].numberOfCopies);
      } else {
        setCurrentCardIdx(null);
        setCardCopies(sanitizedCopies);
      }
      setDefaultLoaded(rec.defaultLoaded ?? false);
      setDeckName(rec.deckName);
    } catch (err) {
      console.warn('Failed to load settings:', err);
    }
  };
  // Debounced autosave when relevant state changes
  const autosaveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => { void saveAutosave(); }, 500);
    return () => { if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current); };
  }, [cardData, cardColor, templateType, manaSelects, savedCards, currentCardIdx, cardCopies, deckName]);
  // Load on mount
  useEffect(() => { void loadAutosave(); }, []);
  // Load default project if no saved cards and not already loaded
  useEffect(() => {
    if (!defaultLoaded && savedCards.length === 0) {
      fetch('/assets/Green_Tree_Proxy_The_Gathering.json')
        .then(r => r.json())
        .then(config => {
          handleLoadProject(config);
          setDefaultLoaded(true);
        })
        .catch(e => console.warn('Failed to load default project:', e));
    }
  }, [savedCards.length, defaultLoaded]);
  // Autosave: update selected card in savedCards whenever cardData, cardStyle, or manaSelects change
  React.useEffect(() => {
    if (currentCardIdx !== null && currentCardIdx >= 0 && currentCardIdx < savedCards.length) {
      setSavedCards(prev => prev.map((card, idx) =>
        idx === currentCardIdx
          ? { data: cardData, color: cardColor, template: templateType, mana: [...manaSelects], numberOfCopies: cardCopies }
          : card
      ));
    }
  }, [cardData, cardColor, templateType, manaSelects, currentCardIdx, cardCopies]);

  // When the selected template/style changes, adjust the visible card title/name.
  // - Switching to 'Mana/Token': if the user is not using a custom title, set a sensible default ('Mana')
  // - Switching away from 'Mana/Token': restore the saved `normalName` if present
  // - Switching to 'PTG Style': ensure mana cost is enabled
  React.useEffect(() => {
    setCardData(prev => {
      if (templateType === 'Mana/Token') {
        if (prev.useCustomTitle) return prev; // don't override a custom title
        // Save current non-mana name so we can restore it later when switching back
        const savedNormal = prev.normalName || prev.name;
        // If already a mana-like name, keep it; otherwise default to 'Mana'
        const manaDefaults = new Set(['Mana', 'Energy', 'Token', 'Treasure', 'Clue', 'Food']);
        const currentIsManaLike = typeof prev.name === 'string' && manaDefaults.has(prev.name);
        return { ...prev, normalName: savedNormal, name: currentIsManaLike ? prev.name : 'Mana' };
      }
      // switching back to PTG (or other) -> restore the saved `normalName` if available
      if (prev.normalName) {
        return { ...prev, name: prev.normalName };
      }
      // switching to PTG Style -> ensure mana cost is enabled
      if (templateType === 'PTG Style') {
        return { ...prev, showMana: true };
      }
      return prev;
    });
  }, [templateType]);

  const handleLoadCard = (card: SavedCardEntry, idx: number) => {
    if (currentCardIdx === idx) {
      // If there's only one saved card, do not allow deselecting it by clicking again.
      if (savedCards.length === 1) {
        return;
      }
      setCurrentCardIdx(null);
      // reset defaults
      setCardData(initialCardData);
      setCardColor('Black');
      setTemplateType('PTG Style');
      setManaSelects(createEmptyManaSlots());
      setCardCopies(COPIES_MIN);
      return;
    }
    // If switching to Poké Mana, set cardData.name to Title value
    if (card.template === 'Mana/Token') {
      setCardData({ ...card.data, name: card.data.name });
    } else {
      setCardData(card.data);
    }
    setCardColor(card.color);
    setTemplateType(card.template);
    setManaSelects([...card.mana]);
    setCurrentCardIdx(idx);
    setCardCopies(sanitizeCopies(card.numberOfCopies));
  };

  const handleRemoveCard = () => {
    setSavedCards(prev => {
      if (currentCardIdx === null || currentCardIdx < 0 || currentCardIdx >= prev.length) return prev;
      const newCards = prev.filter((_, idx) => idx !== currentCardIdx);
      // After removal, switch to next card if any remain
      if (newCards.length > 0) {
        const nextIdx = Math.min(currentCardIdx, newCards.length - 1);
        const nextCard = newCards[nextIdx];
        setCardData(nextCard.data);
        setCardColor(nextCard.color);
        setTemplateType(nextCard.template);
        setManaSelects([...nextCard.mana]);
        setCurrentCardIdx(nextIdx);
        setCardCopies(sanitizeCopies(nextCard.numberOfCopies));
      } else {
        setCardData(initialCardData);
        setCardColor('Black');
        setTemplateType('PTG Style');
        setManaSelects(createEmptyManaSlots());
        setCurrentCardIdx(null);
        setCardCopies(COPIES_MIN);
      }
      return newCards;
    });
  };
  // Load project configuration from JSON
  const handleLoadProject = (config: ProjectConfig) => {
    if (!config || !Array.isArray(config.savedCards)) return;
    const normalizedCards = config.savedCards.map(card => normalizeSavedCard(card));
    setSavedCards(normalizedCards);
    setDeckName(config.deckName);
    let nextIdx: number | null = null;
    if (typeof config.currentCardIdx === 'number' && normalizedCards[config.currentCardIdx]) {
      nextIdx = config.currentCardIdx;
    } else if (normalizedCards.length > 0) {
      nextIdx = 0;
    }
    setCurrentCardIdx(nextIdx);
    if (nextIdx !== null) {
      const card = normalizedCards[nextIdx];
      setCardData(card.data);
      setCardColor(card.color);
      setTemplateType(card.template);
      setManaSelects([...card.mana]);
      setCardCopies(card.numberOfCopies);
    } else {
      setCardData(initialCardData);
      setCardColor('Black');
      setTemplateType('PTG Style');
      setManaSelects(createEmptyManaSlots());
      setCardCopies(COPIES_MIN);
    }
  };

  const manaIcon = (Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>, sizeClass: string) =>
    (color: string) => <Icon className={`mana-icon ${sizeClass}`} style={{ color, fill: color }} />;

  const parseManaText = (text: string, manaIcons: Record<string, (color: string) => React.ReactNode>, frame: any, isContent: boolean = false) => {
    if (!text) return null;
    
    // Split text by mana symbols {symbol}
    const parts = text.split(/(\{[^}]+\})/g);
    
    return parts.map((part, index) => {
      const match = part.match(/^\{([^}]+)\}$/);
      if (match) {
        const symbol = match[1];
        // If the symbol is a plain number
        if (/^\d+$/.test(symbol)) {
          if (isContent) {
            // In content, render as plain black text without border
            return (
              <span key={index} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 0.05em', color: '#000000', fontWeight: 'bold' }}>
                {symbol}
              </span>
            );
          } else {
            // In title, render as circled mana icon
            const manaBg = frame.manaCostBg;
            const manaText = frame.manaCostText || '#000';
            const manaBorder = frame.manaCostBorder || frame.manaCostText || '#ffffff';
            const manaBorderWidth = typeof frame.manaCostBorderWidth === 'number' ? `${frame.manaCostBorderWidth}px` : (frame.manaCostBorderWidth || '2px');
            return (
              <span key={index} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 0.05em' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '1.05em',
                  height: '1.05em',
                  borderRadius: '50%',
                  background: manaBg,
                  border: `${manaBorderWidth} solid ${manaBorder}`,
                  fontSize: '0.95em',
                  fontWeight: 900,
                  color: manaText,
                  lineHeight: 1
                }}>{symbol}</span>
              </span>
            );
          }
        }
        // Use contentManaIconColors if available, otherwise fall back to manaIconColors
        const colorSource = frame.contentManaIconColors || frame.manaIconColors;
        const color = colorSource && colorSource[symbol] ? colorSource[symbol] : '#000';
        const iconFunc = manaIcons[symbol];
        if (iconFunc) {
          return <span key={index} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 0.05em' }}>{iconFunc(color)}</span>;
        }
      }
      return part;
    });
  };

  const manaIcons: Record<string, (color: string) => React.ReactNode> = {
    R: manaIcon(BsFire, 'mana-icon--lg'),
    W: manaIcon(GiSun, 'mana-icon--lg'),
    U: manaIcon(IoWater, 'mana-icon--md'),
    G: manaIcon(IoLeafSharp, 'mana-icon--md'),
    B: manaIcon(IoSkullSharp, 'mana-icon--md'),
    Y: manaIcon(IoFlashSharp, 'mana-icon--md'),
    A: manaIcon(IoCog, 'mana-icon--md'),
    T: (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontSize: '1.2em' }}>⤵</span>,
    // Generic mana symbols - display as styled inline icons to match other mana icons
    '0': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>0</span>,
    '1': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>1</span>,
    '2': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>2</span>,
    '3': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>3</span>,
    '4': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>4</span>,
    '5': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>5</span>,
    '6': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>6</span>,
    '7': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>7</span>,
    '8': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>8</span>,
    '9': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>9</span>,
    '10': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>10</span>,
    '11': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>11</span>,
    '12': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>12</span>,
    '13': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>13</span>,
    '14': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>14</span>,
    '15': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>15</span>,
    '16': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>16</span>,
    '17': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>17</span>,
    '18': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>18</span>,
    '19': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>19</span>,
    '20': (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>20</span>,
    X: (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>X</span>,
    C: (color: string) => <span className={`mana-icon mana-icon--md`} style={{ color, fontWeight: 'bold' }}>C</span>,
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as any;
    const { name, type } = target;
    const newValue = type === 'checkbox' ? !!target.checked : target.value;
    setCardData(prev => {
      const updated: any = { ...prev, [name]: newValue };
      // If the user picks an explicit Image BG color, switch mode to manual
      if (name === 'imageBg') {
        updated.imageBgMode = 'manual';
      }
      // If user explicitly switched the mode to manual, try to restore a sensible color
      if (name === 'imageBgMode' && newValue === 'manual') {
        // prefer existing manual color
        if (!updated.imageBg && (prev as any).imageBgAuto) {
          // try to parse first rgb(...) from the stored auto gradient and convert to hex
          const g = (prev as any).imageBgAuto || '';
          const m = g.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (m) {
            const r = parseInt(m[1], 10), gg = parseInt(m[2], 10), b = parseInt(m[3], 10);
            const toHex = (n:number) => n.toString(16).padStart(2, '0');
            updated.imageBg = `#${toHex(r)}${toHex(gg)}${toHex(b)}`;
          }
        }
      }
      // Keep a separate normalName for non-mana templates so we can restore it
      if (name === 'name' && templateType !== 'Mana/Token') {
        updated.normalName = newValue;
      }
      // If user toggles useCustomTitle on/off, do not clobber name here; the template-effect useEffect handles defaults
      return updated;
    });
  };

  const handleManaSelect = (index: number, value: string) => {
    setManaSelects(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleCopiesInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardCopies(sanitizeCopies(e.target.value));
  };

  const decrementCopies = () => {
    setCardCopies(prev => sanitizeCopies(prev - 1));
  };

  const incrementCopies = () => {
    setCardCopies(prev => sanitizeCopies(prev + 1));
  };

  const handleImageUpload = (dataUrl: string) => {
    // Immediately set image and switch to automatic background mode (the gradient will be computed)
    setCardData(prev => ({ ...prev, image: dataUrl, imageBg: undefined, imageBgMode: 'auto', imageBgAuto: null }));
    // Compute automatic background gradient from the uploaded image and set it on the card
    // (runs asynchronously; we don't block the UI)
    (async () => {
      try {
        const autoBg = await computeAutoBgFromDataUrl(dataUrl);
        // update computed auto background if available
        setCardData(prev => ({ ...prev, imageBgAuto: autoBg || null }));
      } catch (e) {
        // ignore
      }
    })();
  };

  

  const frame = useMemo(() => frameDefs[cardColor] || blackFrame, [cardColor]);
  const cardRef = useRef<HTMLDivElement>(null);
  // Copy computed styles from a source element into a target element to preserve layout during export
  const copyComputedStyles = (source: HTMLElement | null, target: HTMLElement | null) => {
    if (!source || !target) return;
    try {
      const cs = window.getComputedStyle(source);
      // Only copy essential layout and positioning properties, not typography
      // This preserves the inline styles in PTGStyle.tsx while ensuring layout consistency
      const layoutProps = [
        'position', 'display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content',
        'overflow', 'overflow-x', 'overflow-y', 'z-index', 'background', 'background-color', 'background-image',
        'border', 'border-radius', 'box-shadow', 'opacity', 'transform', 'transform-origin'
      ];
      
      let cssText = '';
      layoutProps.forEach(prop => {
        const val = cs.getPropertyValue(prop);
        if (val && val !== 'normal' && val !== 'none' && val !== 'auto') {
          cssText += `${prop}: ${val}; `;
        }
      });
      
      // Preserve any existing inline styles on the target (these take priority)
      const existing = target.getAttribute('style') || '';
      target.setAttribute('style', existing + cssText);
      
      // Ensure the exported root has the same pixel dimensions so absolute anchors compute the same
      const rect = source.getBoundingClientRect();
      target.style.width = `${Math.ceil(rect.width)}px`;
      target.style.height = `${Math.ceil(rect.height)}px`;
      // Ensure position/ display are set
      target.style.position = target.style.position || 'relative';
      target.style.display = target.style.display || 'flex';
    } catch (e) {
      // ignore if copy fails
    }
  };

  // Copy only the computed style properties relevant to the vertical right-side info element
  const copyVerticalSideInfo = (source: HTMLElement | null, target: HTMLElement | null) => {
    if (!source || !target) return;
    try {
      // Find the vertical element in the source by checking computed writing-mode
      const srcCandidates = Array.from(source.querySelectorAll('*')) as HTMLElement[];
      const srcVert = srcCandidates.find(el => {
        try { return window.getComputedStyle(el).getPropertyValue('writing-mode').startsWith('vertical'); } catch { return false; }
      });
      if (!srcVert) return;

      // Prefer to find a matching vertical element in the target by writing-mode first,
      // falling back to text-content match if necessary.
      const tgtCandidates = Array.from(target.querySelectorAll('*')) as HTMLElement[];
      let tgt: HTMLElement | undefined = tgtCandidates.find(el => {
        try { return window.getComputedStyle(el).getPropertyValue('writing-mode').startsWith('vertical'); } catch { return false; }
      });
      if (!tgt) {
        const srcText = (srcVert.textContent || '').trim();
        tgt = tgtCandidates.find(el => (el.textContent || '').trim() === srcText);
      }
      if (!tgt) return;

      const cs = window.getComputedStyle(srcVert);
      // Copy font and orientation properties to avoid reflow / glyph-direction differences
      const fontProps = ['writing-mode','text-orientation','font-family','font-size','font-weight','font-style','line-height','letter-spacing','color','direction','white-space'];
      fontProps.forEach(p => {
        try {
          const val = cs.getPropertyValue(p);
          if (val) tgt.style.setProperty(p, val);
        } catch (e) {}
      });

      // Compute bounding box of source element relative to the source root and apply
      // scaled absolute positioning to the target so it sits exactly where the source did.
      const srcRect = srcVert.getBoundingClientRect();
      const srcRootRect = source.getBoundingClientRect();
      const tgtRoot = target as HTMLElement;
      const tgtRootRect = tgtRoot.getBoundingClientRect();
      const relLeft = srcRect.left - srcRootRect.left;
      const relTop = srcRect.top - srcRootRect.top;
      const scaleX = tgtRootRect.width / srcRootRect.width || 1;
      const scaleY = tgtRootRect.height / srcRootRect.height || 1;

      // Ensure target is absolutely positioned within the export root
      tgt.style.position = 'absolute';
      // Set transform-origin to match source (copy if present)
      try {
        const origin = window.getComputedStyle(srcVert).getPropertyValue('transform-origin');
        if (origin) tgt.style.transformOrigin = origin;
      } catch {}

      // Copy any transforms (rotation/flips) from the source so orientation remains identical
      try {
        const transform = window.getComputedStyle(srcVert).getPropertyValue('transform');
        if (transform && transform !== 'none') tgt.style.setProperty('transform', transform);
      } catch {}

      // Apply scaled positioning and size
      tgt.style.left = `${Math.round(relLeft * scaleX)}px`;
      tgt.style.top = `${Math.round(relTop * scaleY)}px`;
      tgt.style.width = `${Math.round(srcRect.width * scaleX)}px`;
      tgt.style.height = `${Math.round(srcRect.height * scaleY)}px`;

      // Also ensure a matching font-size/line-height in px to avoid invisible reflow due to
      // differing root font-size or zoom during export
      try {
        const fontSize = cs.getPropertyValue('font-size');
        if (fontSize) tgt.style.setProperty('font-size', fontSize);
        const lh = cs.getPropertyValue('line-height');
        if (lh) tgt.style.setProperty('line-height', lh);
      } catch {}
    } catch (e) {
      // ignore
    }
  };
  // Export the currently shown card as a single PNG
  const handleExportSinglePNG = async () => {
    const tempDiv = document.createElement('div');
    const targetDPI = 300;
    const scale = targetDPI / 96;
    const designCssWidth = 300;
    const designCssHeight = 420;

    tempDiv.style.width = `${designCssWidth}px`;
    tempDiv.style.height = `${designCssHeight}px`;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
  // tiny non-zero padding + transparent border prevents margin collapse
  tempDiv.style.padding = '0.01px';
  tempDiv.style.border = '1px solid transparent';
    tempDiv.style.margin = '0';
    tempDiv.style.boxSizing = 'border-box';
    tempDiv.style.overflow = 'hidden';
    tempDiv.style.display = 'block';
    tempDiv.style.backgroundColor = 'white';
    tempDiv.id = 'export-temp';

    const resetStyle = document.createElement('style');
  const exportFit = (cardData.imageFit || 'contain');
   resetStyle.textContent = `
    /* Reset spacing but preserve layout/display of the CardPreview root so its flex/grid
      behavior and absolute children positioning are not broken for exported DOM. */
    #export-temp, #export-temp * { margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; }
    /* Ensure CardPreview root retains display:flex and position:relative so absolutely
      positioned children (vertical side text) remain anchored as in the live preview. */
    #export-temp > div:first-child { display: flex !important; position: relative !important; }
    /* Only enforce image sizing and object-fit for accurate exports. */
    #export-temp img { width: 100% !important; height: 100% !important; object-fit: ${exportFit} !important; display: block !important; }
   `;
    tempDiv.appendChild(resetStyle);
    document.body.appendChild(tempDiv);

    const { createRoot } = await import('react-dom/client');
    const root = createRoot(tempDiv);
    root.render(
      <CardPreview
        cardData={cardData}
        frame={frame}
        manaSelects={manaSelects}
        manaIcons={manaIcons}
        parseManaText={parseManaText}
        template={templateType}
      />
    );

    await new Promise(resolve => setTimeout(resolve, 220));

    // Copy computed styles from the live preview into the export root so layout/absolute
    // positioning (vertical side text) remains identical during html2canvas capture.
    try { copyComputedStyles(cardRef.current, tempDiv.firstElementChild as HTMLElement | null); } catch {}
  try { copyVerticalSideInfo(cardRef.current, tempDiv.firstElementChild as HTMLElement | null); } catch {}

    // Draw each <img> into a high-resolution canvas sized by the html2canvas export scale.
    // This prevents pixelation when the browser would otherwise upscale the image at export time.
    const replaceImgsWithCanvas = async () => {
      const imgs = Array.from(tempDiv.querySelectorAll('img')) as HTMLImageElement[];
      await Promise.all(imgs.map(img => new Promise<void>((resolve) => {
        try {
          const src = img.getAttribute('src') || '';
          const rect = img.getBoundingClientRect();
          // If rect is empty, fallback to parent's rect
          const parentRect = (img.parentElement && img.parentElement.getBoundingClientRect()) || rect;
          const cssW = parentRect.width || rect.width || 300;
          const cssH = parentRect.height || rect.height || 200;
          const canvas = document.createElement('canvas');
          // Set canvas to high-resolution pixel dimensions for export
          canvas.width = Math.max(1, Math.ceil(cssW * scale));
          canvas.height = Math.max(1, Math.ceil(cssH * scale));
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          canvas.style.display = 'block';
          // Preserve visual transforms on the element by copying transform to the canvas (css-level)
          canvas.style.transform = (img.style.transform as string) || '';
          canvas.style.transformOrigin = 'center center';
          const ctx = canvas.getContext('2d');
          if (!ctx) { img.parentNode?.replaceChild(canvas, img); resolve(); return; }
          ctx.imageSmoothingEnabled = true;
          // Use high quality smoothing when drawing
          (ctx as any).imageSmoothingQuality = 'high';
          const loadImg = new Image();
          // try to allow cross-origin images; if it's inline data:url it's fine
          loadImg.crossOrigin = 'anonymous';
          loadImg.onload = () => {
            try {
              // Draw the source image respecting the chosen object-fit.
              const iw = loadImg.naturalWidth || loadImg.width || canvas.width;
              const ih = loadImg.naturalHeight || loadImg.height || canvas.height;
              // Map selected imageFilter to a canvas filter string
              const exportFilterValue = ((cardData as any).imageFilter || 'none');
              let exportFilterCss = 'none';
              switch (exportFilterValue) {
                case 'grayscale': exportFilterCss = 'grayscale(100%)'; break;
                case 'invert': exportFilterCss = 'invert(100%)'; break;
                case 'saturate': exportFilterCss = 'saturate(180%)'; break;
                default: exportFilterCss = 'none'; break;
              }
              try { ctx.filter = exportFilterCss; } catch {}
              if (exportFit === 'contain') {
                const scale = Math.min(canvas.width / iw, canvas.height / ih);
                const dw = Math.round(iw * scale);
                const dh = Math.round(ih * scale);
                const dx = Math.round((canvas.width - dw) / 2);
                const dy = Math.round((canvas.height - dh) / 2);
                ctx.drawImage(loadImg, 0, 0, iw, ih, dx, dy, dw, dh);
              } else if (exportFit === 'fill') {
                // stretch to fill
                ctx.drawImage(loadImg, 0, 0, canvas.width, canvas.height);
              } else {
                // default: attempt to honor the fit value as a size string fallback
                ctx.drawImage(loadImg, 0, 0, canvas.width, canvas.height);
              }
              try { ctx.filter = 'none'; } catch {}
            } catch (err) {
              // fallback: fill transparent
            }
            img.parentNode?.replaceChild(canvas, img);
            resolve();
          };
          loadImg.onerror = () => {
            // If loading as Image fails, fall back to replacing with a simple div background (best-effort)
            const wrapper = document.createElement('div');
            wrapper.style.width = '100%';
            wrapper.style.height = '100%';
            wrapper.style.backgroundImage = `url("${src}")`;
            wrapper.style.backgroundRepeat = 'no-repeat';
            wrapper.style.backgroundPosition = 'center';
            if (exportFit === 'contain') wrapper.style.backgroundSize = 'contain';
            else if (exportFit === 'fill') wrapper.style.backgroundSize = '100% 100%';
            else wrapper.style.backgroundSize = exportFit;
            // Apply CSS filter to wrapper so fallback also respects selected filter
            const exportFilterValue = (((cardData as any).imageFilter) || 'none');
            switch (exportFilterValue) {
              case 'grayscale': wrapper.style.filter = 'grayscale(100%)'; break;
              case 'invert': wrapper.style.filter = 'invert(100%)'; break;
              case 'saturate': wrapper.style.filter = 'saturate(180%)'; break;
              default: wrapper.style.filter = 'none'; break;
            }
            wrapper.style.display = 'block';
            wrapper.style.margin = '0';
            img.parentNode?.replaceChild(wrapper, img);
            resolve();
          };
          loadImg.src = src;
        } catch (e) {
          // On any unexpected error, just continue
          try { const wrapper = document.createElement('div'); wrapper.style.width='100%'; wrapper.style.height='100%'; img.parentNode?.replaceChild(wrapper, img); } catch {}
          resolve();
        }
      })));
    };
    try {
      await replaceImgsWithCanvas();
    } catch (e) {
      // ignore
    }

    const element = tempDiv.firstElementChild as HTMLElement || tempDiv;
    const rect = element.getBoundingClientRect();
    const canvas = await html2canvas(element, {
      backgroundColor: null,
      scale,
      logging: false,
      useCORS: true,
      allowTaint: false,
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
      windowWidth: Math.ceil(rect.width),
      windowHeight: Math.ceil(rect.height),
    });

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${cardData.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    link.click();

    root.unmount();
    document.body.removeChild(tempDiv);
  };
  const handleExportAllPDF = async () => {
    if (savedCards.length === 0 || isExportingPDF) return;
    const cardsToExport: SavedCardEntry[] = savedCards.flatMap(card => {
      const copies = sanitizeCopies(card.numberOfCopies);
      return Array.from({ length: copies }, () => card);
    });
    if (cardsToExport.length === 0) return;

    setIsExportingPDF(true);
    try {

  // Umrechnung: mm → pt (1 pt = 1/72 inch, 1 inch = 25.4 mm)
  // use mmToPt helper from ./ProxyGenerator

    // Offizielle MTG-Kartenmaße
    const cardMmWidth = 63.5;
    const cardMmHeight = 88.9;

    // DIN A4-Maße
    const DIN_A4_WIDTH_MM = 210;
    const DIN_A4_HEIGHT_MM = 297;

    // 3x3-Raster
    const cardsPerRow = 3;
    const cardsPerCol = 3;

    // Small gap between cards to avoid overlapping borders when rendering to PDF
    const cardGapMm = 0.0; // mm
    // Grid size (no outer margin)
    const gridWidthMm = cardsPerRow * cardMmWidth + (cardsPerRow - 1) * cardGapMm;
    const gridHeightMm = cardsPerCol * cardMmHeight + (cardsPerCol - 1) * cardGapMm;

    // Center grid on DIN A4
    const offsetXmm = Math.max(0, (DIN_A4_WIDTH_MM - gridWidthMm) / 2);
    const offsetYmm = Math.max(0, (DIN_A4_HEIGHT_MM - gridHeightMm) / 2);

    // Schritt 1: PNGs generieren
    const pngs: string[] = [];
    for (let i = 0; i < cardsToExport.length; i++) {
      const cardEntry = cardsToExport[i];
      const tempDiv = document.createElement('div');
      // Target rendering DPI for the generated PNGs (higher = crisper print)
      const targetDPI = 300;
      const scale = targetDPI / 96; // html2canvas scale factor relative to CSS px
      // Render the CardPreview at its native design CSS size so internal px-based layout scales correctly
      // PTGStyle uses width: 300px and height: 420px as its base design
      const designCssWidth = 300;
      const designCssHeight = 420;
      tempDiv.style.width = `${designCssWidth}px`;
      tempDiv.style.height = `${designCssHeight}px`;
      // Ensure no extra margins/padding from child components and force full size
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
  // tiny non-zero padding + transparent border prevents margin collapse
  tempDiv.style.padding = '0.01px';
  tempDiv.style.border = '1px solid transparent';
      tempDiv.style.margin = '0';
      tempDiv.style.boxSizing = 'border-box';
      tempDiv.style.overflow = 'hidden';
      tempDiv.style.display = 'block';
      tempDiv.style.backgroundColor = 'white'; // Weißer Hintergrund für bessere Druckqualität
      // Use an id so we can override styles specifically for the export wrapper
      tempDiv.id = 'export-temp';
        const resetStyle = document.createElement('style');
      const exportFit = (cardEntry.data as any).imageFit || 'contain';
  resetStyle.textContent = `
      /* Keep the export root tightly sized, but do not wipe out all inner paddings/margins,
         otherwise typography and box spacing differ between cards. */
      #export-temp { margin: 0 !important; box-sizing: border-box !important; }
      #export-temp > div:first-child { display: flex !important; position: relative !important; }
      /* Ensure art area images obey selected fit without forcing container display */
      #export-temp img { width: 100% !important; height: 100% !important; object-fit: ${exportFit} !important; display: block !important; }
    `;
      tempDiv.appendChild(resetStyle);
      document.body.appendChild(tempDiv);

      const frame = frameDefs[cardEntry.color] || blackFrame;
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(tempDiv);
      root.render(
        <CardPreview
          cardData={cardEntry.data}
          frame={frame}
          manaSelects={cardEntry.mana}
          manaIcons={manaIcons}
          parseManaText={parseManaText}
          template={cardEntry.template}
        />
      );

        // Kurze Verzögerung, um sicherzustellen, dass alles gerendert ist
        await new Promise(resolve => setTimeout(resolve, 120));
        // For multi-card export, rely on the layout/styling defined in CardPreview/PTGStyle
        // itself for most elements, but explicitly sync the vertical right-side info
        // (rarity/setCode/language/collectorNo) so its writing-mode, font and positioning
        // exactly match the on-screen preview. This helper only affects that small element
        // and does not copy card frame colors, avoiding the earlier cross-card color leak.
        try { copyVerticalSideInfo(cardRef.current, tempDiv.firstElementChild as HTMLElement | null); } catch {}

      // Replace <img> elements with high-resolution canvases so the exported PNG is sharp
      const replaceImgsWithCanvasMulti = async () => {
        const imgs = Array.from(tempDiv.querySelectorAll('img')) as HTMLImageElement[];
        await Promise.all(imgs.map(img => new Promise<void>((resolve) => {
          try {
            const src = img.getAttribute('src') || '';
            const rect = img.getBoundingClientRect();
            const parentRect = (img.parentElement && img.parentElement.getBoundingClientRect()) || rect;
            const cssW = parentRect.width || rect.width || 300;
            const cssH = parentRect.height || rect.height || 200;
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.ceil(cssW * scale));
            canvas.height = Math.max(1, Math.ceil(cssH * scale));
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.display = 'block';
            canvas.style.transform = (img.style.transform as string) || '';
            canvas.style.transformOrigin = 'center center';
            const ctx = canvas.getContext('2d');
            if (!ctx) { img.parentNode?.replaceChild(canvas, img); resolve(); return; }
            ctx.imageSmoothingEnabled = true;
            (ctx as any).imageSmoothingQuality = 'high';
            const loadImg = new Image();
            loadImg.crossOrigin = 'anonymous';
            loadImg.onload = () => {
              try {
                const iw = loadImg.naturalWidth || loadImg.width || canvas.width;
                const ih = loadImg.naturalHeight || loadImg.height || canvas.height;
                // Apply selected filter from the saved card data when drawing
                const exportFilterValue = (((cardEntry.data as any).imageFilter) || 'none');
                let exportFilterCss = 'none';
                switch (exportFilterValue) {
                  case 'grayscale': exportFilterCss = 'grayscale(100%)'; break;
                  case 'invert': exportFilterCss = 'invert(100%)'; break;
                  case 'saturate': exportFilterCss = 'saturate(180%)'; break;
                  default: exportFilterCss = 'none'; break;
                }
                try { ctx.filter = exportFilterCss; } catch {}
                if (exportFit === 'contain') {
                  const scale = Math.min(canvas.width / iw, canvas.height / ih);
                  const dw = Math.round(iw * scale);
                  const dh = Math.round(ih * scale);
                  const dx = Math.round((canvas.width - dw) / 2);
                  const dy = Math.round((canvas.height - dh) / 2);
                  ctx.drawImage(loadImg, 0, 0, iw, ih, dx, dy, dw, dh);
                } else if (exportFit === 'fill') {
                  ctx.drawImage(loadImg, 0, 0, canvas.width, canvas.height);
                } else {
                  ctx.drawImage(loadImg, 0, 0, canvas.width, canvas.height);
                }
                try { ctx.filter = 'none'; } catch {}
              } catch (e) { /* ignore drawing errors */ }
              img.parentNode?.replaceChild(canvas, img);
              resolve();
            };
            loadImg.onerror = () => {
              const wrapper = document.createElement('div');
              wrapper.style.width = '100%';
              wrapper.style.height = '100%';
              wrapper.style.backgroundImage = `url("${src}")`;
              wrapper.style.backgroundRepeat = 'no-repeat';
              wrapper.style.backgroundPosition = 'center';
              if (exportFit === 'contain') wrapper.style.backgroundSize = 'contain';
              else if (exportFit === 'fill') wrapper.style.backgroundSize = '100% 100%';
              else wrapper.style.backgroundSize = exportFit;
              // Apply selected filter to the fallback wrapper
              const exportFilterVal = (((cardEntry.data as any).imageFilter) || 'none');
              switch (exportFilterVal) {
                case 'grayscale': wrapper.style.filter = 'grayscale(100%)'; break;
                case 'invert': wrapper.style.filter = 'invert(100%)'; break;
                case 'saturate': wrapper.style.filter = 'saturate(180%)'; break;
                default: wrapper.style.filter = 'none'; break;
              }
              wrapper.style.display = 'block';
              wrapper.style.margin = '0';
              img.parentNode?.replaceChild(wrapper, img);
              resolve();
            };
            loadImg.src = src;
          } catch (e) { try { const wrapper = document.createElement('div'); wrapper.style.width='100%'; wrapper.style.height='100%'; img.parentNode?.replaceChild(wrapper, img); } catch {} resolve(); }
        })));
      };
      try { await replaceImgsWithCanvasMulti(); } catch {}
      // Render the actual card element (first child) and measure it to avoid clipping.
      // Force a consistent design size so every card snapshot has identical dimensions.
      const element = (tempDiv.firstElementChild as HTMLElement) || tempDiv;
      element.style.width = `${designCssWidth}px`;
      element.style.height = `${designCssHeight}px`;
      element.style.margin = '0';
      const rect = element.getBoundingClientRect();
      // html2canvas: render at a higher pixel density (scale) so the PNG has enough resolution
      const canvas = await html2canvas(element, {
        backgroundColor: null,
        scale, // scale up from CSS px to target DPI
        logging: false,
        useCORS: true,
        allowTaint: false,
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        windowWidth: Math.ceil(rect.width),
        windowHeight: Math.ceil(rect.height),
      });

      pngs.push(canvas.toDataURL('image/png'));
      root.unmount();
      document.body.removeChild(tempDiv);
    }
    // Step 2: Create PDF
    const pdfDoc = await PDFDocument.create();
    for (let i = 0; i < pngs.length; i += cardsPerRow * cardsPerCol) {
      const page = pdfDoc.addPage([mmToPt(DIN_A4_WIDTH_MM), mmToPt(DIN_A4_HEIGHT_MM)]);
      const cardsOnPage = pngs.slice(i, i + cardsPerRow * cardsPerCol);
      for (let j = 0; j < cardsOnPage.length; j++) {
        const row = Math.floor(j / cardsPerRow);
        const col = j % cardsPerRow;
        const xMm = offsetXmm + col * cardMmWidth;
        const yMm = DIN_A4_HEIGHT_MM - (offsetYmm + (row + 1) * cardMmHeight);
        const pngImage = await pdfDoc.embedPng(cardsOnPage[j]);
        // PNGs were rendered to the card element size, so draw them to fill the card area exactly
        const cardXPt = mmToPt(xMm);
        const cardYPt = mmToPt(yMm);
        const drawWidthPt = mmToPt(cardMmWidth);
        const drawHeightPt = mmToPt(cardMmHeight);
        const offsetXPt = 0;
        const offsetYPt = 0;

        // Draw opaque background for the card to avoid overlap with adjacent cards
        page.drawRectangle({
          x: cardXPt,
          y: cardYPt,
          width: mmToPt(cardMmWidth),
          height: mmToPt(cardMmHeight),
          color: rgb(1, 1, 1),
        });

        page.drawImage(pngImage, {
          x: cardXPt + offsetXPt,
          y: cardYPt + offsetYPt,
          width: drawWidthPt,
          height: drawHeightPt,
        });
      }
    }
    const pdfBytes = await pdfDoc.save();
    const arrayBuffer = pdfBytes instanceof Uint8Array
      ? pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)
      : pdfBytes;
    const blob = new Blob([arrayBuffer as ArrayBuffer], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'mtg_cards.pdf';
    link.click();
  } catch (err) {
    console.error('Failed to export PDF', err);
  } finally {
    setIsExportingPDF(false);
  }
  };




  return (
    <div className="content-container proxy-generator-page">
        <div className="proxy-generator-layout">
          <SavedCardsSidebar
            savedCards={savedCards}
            onLoadCard={(card, idx) => handleLoadCard(card, idx)}
            onExportAllPDF={handleExportAllPDF}
            currentCardIdx={currentCardIdx}
            initialDeckName={deckName}
            isExportingPDF={isExportingPDF}
            onLoadProject={handleLoadProject}
            onReorder={(newSaved) => {
              // preserve the selected card if possible
              const prevSelected = currentCardIdx;
              setSavedCards(newSaved);
              if (prevSelected === null) {
                setCurrentCardIdx(null);
              } else {
                // try to find the previously selected card by reference equality
                const prev = savedCards[prevSelected];
                const newIdx = newSaved.findIndex(s => s === prev);
                setCurrentCardIdx(newIdx === -1 ? null : newIdx);
              }
            }}
          />
          <div className="card-preview-wrapper">
            <CardPreview
              ref={cardRef}
              cardData={cardData}
              frame={frame}
              manaSelects={manaSelects}
              manaIcons={manaIcons}
              parseManaText={parseManaText}
              template={templateType}
              onImageOffsetChange={(x:number,y:number) => setCardData(prev => ({ ...prev, imageOffsetX: x, imageOffsetY: y }))}
              onImageZoomChange={(z:number) => setCardData(prev => ({ ...prev, imageZoom: z }))}
            />
          </div>
        </div>
        <div>
          <div className="proxy-action-bar">
            <div className="copies-control">
              <label htmlFor="card-copies-input">Copies</label>
              <div className="copies-control-input">
                <button
                  type="button"
                  onClick={decrementCopies}
                  aria-label="Decrease number of copies"
                  disabled={cardCopies <= COPIES_MIN}
                >
                  -
                </button>
                <input
                  id="card-copies-input"
                  type="number"
                  min={COPIES_MIN}
                  max={COPIES_MAX}
                  value={cardCopies}
                  onChange={handleCopiesInputChange}
                  aria-label="Number of copies"
                />
                <button
                  type="button"
                  onClick={incrementCopies}
                  aria-label="Increase number of copies"
                  disabled={cardCopies >= COPIES_MAX}
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportSinglePNG}
              className="proxy-action-button"
            >
              Export Card as PNG
            </button>
            <button
              type="button"
              onClick={() => {
                // Use functional update so we can compute the new index atomically
                setSavedCards(prev => {
                  const newCard: SavedCardEntry = {
                    data: cardData,
                    color: cardColor,
                    template: templateType,
                    mana: [...manaSelects],
                    numberOfCopies: cardCopies,
                  };
                  const newArr = [...prev, newCard];
                  // select the newly added card
                  setCurrentCardIdx(newArr.length - 1);
                  return newArr;
                });
              }}
              className="proxy-action-button"
            >
              Add Card
            </button>
            <button
              type="button"
              onClick={() => {
                // Add a fresh empty card and switch to it
                const emptyData = cloneInitialCardData();
                setCardData(emptyData);
                setCardColor('Black');
                setTemplateType('PTG Style');
                const blankMana = createEmptyManaSlots();
                setManaSelects(blankMana);
                setCardCopies(COPIES_MIN);
                setSavedCards(prev => {
                  const newCard: SavedCardEntry = {
                    data: emptyData,
                    color: 'Black',
                    template: 'PTG Style',
                    mana: [...blankMana],
                    numberOfCopies: COPIES_MIN,
                  };
                  const newArr = [...prev, newCard];
                  setCurrentCardIdx(newArr.length - 1);
                  return newArr;
                });
              }}
              className="proxy-action-button"
            >
              Add Empty Card
            </button>
            <button
              type="button"
              onClick={handleRemoveCard}
              className="proxy-action-button proxy-action-button--remove"
            >
              Remove Card
            </button>
          </div>
          {isExportingPDF && (
            <div className="pdf-export-indicator" role="status" aria-live="polite">
              <span className="pdf-export-spinner" aria-hidden="true" />
              <span>Building PDF…</span>
            </div>
          )}
          <CardConfigForm
            cardData={cardData}
            cardStyle={cardColor}
            templateType={templateType}
            manaSelects={manaSelects}
            onChange={handleChange}
            onManaSelect={handleManaSelect}
            setCardStyle={setCardColor}
            setTemplateType={setTemplateType}
            onImage={handleImageUpload}
          />
        </div>
              <footer className="proxy-footer">
          <div className="proxy-footer-links">
            <a href="https://github.com/danielroth1/OrigamiMapper" target="_blank" rel="noopener noreferrer" className="proxy-footer-link">GitHub</a>
            <span className="proxy-footer-separator">|</span>
            <a href="https://blog.mailbase.info" target="_blank" rel="noopener noreferrer" className="proxy-footer-link">Blog</a>
            <span className="proxy-footer-separator">|</span>
            <a href="https://blog.mailbase.info/datenschutz/" target="_blank" rel="noopener noreferrer" className="proxy-footer-link">Datenschutz</a>
          </div>
        </footer>
      </div>
  );
};

export default ProxyGenerator;
