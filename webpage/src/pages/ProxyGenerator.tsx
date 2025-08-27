import React, { useState, useRef, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { PDFDocument, rgb } from 'pdf-lib';
import { IoLeafSharp, IoSkullSharp, IoSunny, IoFlame, IoFlashSharp, IoWater } from 'react-icons/io5';
import Header from '../components/Header';
import CardPreview from '../components/proxyGenerator/CardPreview';
import SavedCardsSidebar from '../components/proxyGenerator/SavedCardsSidebar';
import CardConfigForm from '../components/proxyGenerator/CardConfigForm';
import ImageUploadProxy from '../components/proxyGenerator/ImageUploadProxy';
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
  imageFit: 'cover', // cover | contain | fill
  imageTransform: 'none', // none | rotate90 | rotate180 | rotate270 | flipH | flipV
  name: 'Electro Rat',
  manaCost: '3',
  typeLine: 'Creature — Plague Rat',
  power: 4,
  toughness: 4,
  rulesText: "Whenever this creature attacks, it deals 1 damage to any target. If you control another Electric creature, this gains haste.",
  flavorText: "A spark of energy and joy, always ready to light up the battlefield with a cheerful charge.",
  collectorNo: '0217',
  rarity: 'M',
  setCode: 'PTG',
  language: 'EN',
  artist: 'Jonas Roth',
  copyright: `© ${currentYear} Jonas Roth`,
  showPT: true,
  showMana: true,
  useCustomTitle: false,
  bottomText: '',
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
  const [cardColor, setCardColor] = useState('White2');
  const [templateType, setTemplateType] = useState('PTG Style');
  const [manaSelects, setManaSelects] = useState(['', '', '', '']);
  // savedCards entries now include color and template for switchable layouts
  const [savedCards, setSavedCards] = useState<Array<{ data: typeof initialCardData, color: string, template: string, mana: string[] }>>([]);
  const [currentCardIdx, setCurrentCardIdx] = useState<number | null>(null);
  // Autosave: update selected card in savedCards whenever cardData, cardStyle, or manaSelects change
  React.useEffect(() => {
    if (currentCardIdx !== null && currentCardIdx >= 0 && currentCardIdx < savedCards.length) {
      setSavedCards(prev => prev.map((card, idx) =>
        idx === currentCardIdx
          ? { data: cardData, color: cardColor, template: templateType, mana: [...manaSelects] }
          : card
      ));
    }
  }, [cardData, cardColor, templateType, manaSelects, currentCardIdx]);

  const handleLoadCard = (card: { data: typeof initialCardData, color: string, template: string, mana: string[] }, idx: number) => {
    if (currentCardIdx === idx) {
      setCurrentCardIdx(null);
      // reset defaults
      setCardData(initialCardData);
      setCardColor('Black');
      setTemplateType('PTG Style');
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
    setManaSelects(card.mana);
    setCurrentCardIdx(idx);
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
        setManaSelects(nextCard.mana);
        setCurrentCardIdx(nextIdx);
      } else {
        setCardData(initialCardData);
        setCardColor('Black');
        setTemplateType('PTG Style');
        setManaSelects(['', '', '', '']);
        setCurrentCardIdx(null);
      }
      return newCards;
    });
  };
  // Load project configuration from JSON
  const handleLoadProject = (config: { deckName: string; savedCards: typeof savedCards; currentCardIdx: number | null }) => {
    if (!config || !Array.isArray(config.savedCards)) return;
    setSavedCards(config.savedCards);
    setCurrentCardIdx(config.currentCardIdx);
    if (config.currentCardIdx !== null && config.savedCards[config.currentCardIdx]) {
      const card = config.savedCards[config.currentCardIdx];
      setCardData(card.data);
      setCardColor(card.color);
      setTemplateType(card.template);
      setManaSelects(card.mana);
    }
  };

  const manaIcons: Record<string, (color: string) => React.ReactNode> = {
    R: (color) => <IoFlame style={{ fontSize: '1.4em', color, verticalAlign: 'middle' }} />,
    U: (color) => <IoWater style={{ fontSize: '1.4em', color, verticalAlign: 'middle' }} />,
    G: (color) => <IoLeafSharp style={{ fontSize: '1.4em', color, verticalAlign: 'middle' }} />,
    W: (color) => <IoSunny style={{ fontSize: '1.4em', color, verticalAlign: 'middle' }} />,
    B: (color) => <IoSkullSharp style={{ fontSize: '1.4em', color, verticalAlign: 'middle' }} />,
    Y: (color) => <IoFlashSharp style={{ fontSize: '1.4em', color, verticalAlign: 'middle' }} />
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as any;
    const { name, type } = target;
    const newValue = type === 'checkbox' ? !!target.checked : target.value;
    setCardData(prev => ({ ...prev, [name]: newValue }));
  };

  const handleManaSelect = (index: number, value: string) => {
    setManaSelects(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleImageUpload = (dataUrl: string) => {
    setCardData(prev => ({ ...prev, image: dataUrl }));
  };

  const frame = useMemo(() => frameDefs[cardColor] || blackFrame, [cardColor]);
  const cardRef = useRef<HTMLDivElement>(null);
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
    tempDiv.style.padding = '0';
    tempDiv.style.margin = '0';
    tempDiv.style.boxSizing = 'border-box';
    tempDiv.style.overflow = 'hidden';
    tempDiv.style.display = 'block';
    tempDiv.style.backgroundColor = 'white';
    tempDiv.id = 'export-temp';

    const resetStyle = document.createElement('style');
    const exportFit = (cardData.imageFit || 'cover');
    resetStyle.textContent = `
      #export-temp, #export-temp * { margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; }
      #export-temp > div { margin: 0 !important; display: block !important; overflow: hidden !important; }
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
        template={templateType}
      />
    );

    await new Promise(resolve => setTimeout(resolve, 220));

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
    if (savedCards.length === 0) return;

    // Umrechnung: mm → pt (1 pt = 1/72 inch, 1 inch = 25.4 mm)
    const mmToPt = (mm: number) => (mm * 72) / 25.4;

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
    const pngs = [];
    for (let i = 0; i < savedCards.length; i++) {
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
      tempDiv.style.padding = '0';
      tempDiv.style.margin = '0';
      tempDiv.style.boxSizing = 'border-box';
      tempDiv.style.overflow = 'hidden';
      tempDiv.style.display = 'block';
      tempDiv.style.backgroundColor = 'white'; // Weißer Hintergrund für bessere Druckqualität
      // Reset all child element margins/padding to avoid unexpected top/bottom gaps
      // Use an id so we can override inline styles with !important when rendering for export
      tempDiv.id = 'export-temp';
      const resetStyle = document.createElement('style');
      const exportFit = (savedCards[i].data as any).imageFit || 'cover';
  resetStyle.textContent = `
      #export-temp, #export-temp * { margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; }
      /* Remove top margin on the CardPreview root but don't override its inline width/height */
      #export-temp > div { margin: 0 !important; display: block !important; overflow: hidden !important; }
  /* Ensure art area images obey selected fit */
  #export-temp img { width: 100% !important; height: 100% !important; object-fit: ${exportFit} !important; display: block !important; }
    `;
      tempDiv.appendChild(resetStyle);
      document.body.appendChild(tempDiv);

      const frame = frameDefs[savedCards[i].color] || blackFrame;
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(tempDiv);
      root.render(
        <CardPreview
          cardData={savedCards[i].data}
          frame={frame}
          manaSelects={savedCards[i].mana}
          manaIcons={manaIcons}
          template={savedCards[i].template}
        />
      );

      // Kurze Verzögerung, um sicherzustellen, dass alles gerendert ist
      await new Promise(resolve => setTimeout(resolve, 120));

      // Render the actual card element (first child) and measure it to avoid clipping
      const element = tempDiv.firstElementChild as HTMLElement || tempDiv;
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
  };




  return (
    <div className="App">
      <Header />
      <div style={{ display: 'flex', maxWidth: '900px', margin: '2em auto', background: '#181818', borderRadius: '12px', padding: '2em', color: '#fff', boxShadow: '0 2px 12px #0006', gap: 0 }}>
        <SavedCardsSidebar
          savedCards={savedCards}
          onLoadCard={(card, idx) => handleLoadCard(card, idx)}
          onExportAllPDF={handleExportAllPDF}
          currentCardIdx={currentCardIdx}
          onLoadProject={handleLoadProject}
        />
        <div style={{ flex: 1 }}>
          <CardPreview
            ref={cardRef}
            cardData={cardData}
            frame={frame}
            manaSelects={manaSelects}
            manaIcons={manaIcons}
            template={templateType}
          />
          <div style={{ display: 'flex', gap: '1em', justifyContent: 'center', margin: '1em 0' }}>
            <button
              type="button"
              onClick={handleExportSinglePNG}
              style={{
                padding: '0.6em 1.2em',
                background: '#222',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 2px 6px #0003'
              }}
            >
              Export Card as PNG
            </button>
            <button
              type="button"
              onClick={() => {
                setSavedCards(prev => [...prev, { data: cardData, color: cardColor, template: templateType, mana: [...manaSelects] }]);
                setCurrentCardIdx(savedCards.length); // select the new card
              }}
              style={{
                padding: '0.6em 1.2em',
                background: '#222',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 2px 6px #0003'
              }}
            >
              Add Card
            </button>
            <button
              type="button"
              onClick={handleRemoveCard}
              style={{
                padding: '0.6em 1.2em',
                background: 'rgba(73, 0, 0, 1)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 2px 6px #0003'
              }}
            >
              Remove Card
            </button>
          </div>
          <ImageUploadProxy label="Upload Card Image: " onImage={handleImageUpload} />
          <CardConfigForm
            cardData={cardData}
            cardStyle={cardColor}
            templateType={templateType}
            manaSelects={manaSelects}
            onChange={handleChange}
            onManaSelect={handleManaSelect}
            setCardStyle={setCardColor}
            setTemplateType={setTemplateType}
          />
        </div>
      </div>
    </div>
  );
};

export default ProxyGenerator;
