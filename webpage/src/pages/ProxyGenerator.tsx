
import React, { useState, useRef, useMemo } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { IoLeafSharp, IoSkullSharp, IoSunny, IoFlame, IoFlashSharp, IoWater } from 'react-icons/io5';
import Header from '../components/Header';
import CardPreview from '../components/CardPreview';
import SavedCardsSidebar from '../components/SavedCardsSidebar';
import CardConfigForm from '../components/CardConfigForm';
import blackFrame from '../cardStyles/black.json';
import black2Frame from '../cardStyles/black2.json';
import whiteFrame from '../cardStyles/white.json';
import blueFrame from '../cardStyles/blue.json';
import redFrame from '../cardStyles/red.json';
import greenFrame from '../cardStyles/green.json';
import artifactFrame from '../cardStyles/artifact.json';
import yellowFrame from '../cardStyles/yellow.json';

const currentYear = new Date().getFullYear();
const initialCardData = {
  image: '',
  name: 'Electro Rat',
  manaCost: '3',
  typeLine: 'Creature — Plague Rat',
  power: 4,
  toughness: 4,
  rulesText: "Whenever this creature attacks, it deals 1 damage to any target. If you control another Electric creature, this gains haste.",
  flavorText: "A spark of energy and joy, always ready to light up the battlefield with a cheerful charge.",
  collectorNo: '0217',
  rarity: 'M',
  setCode: 'MYT',
  language: 'EN',
  artist: 'Jonas Roth',
  copyright: `© ${currentYear} Jonas Roth`,
};

const frameDefs: Record<string, any> = {
  Black: blackFrame,
  Black2: black2Frame,
  White: whiteFrame,
  Blue: blueFrame,
  Red: redFrame,
  Green: greenFrame,
  Yellow: yellowFrame,
  Artifact: artifactFrame,
};

const ProxyGenerator: React.FC = () => {
  const [cardData, setCardData] = useState(initialCardData);
  const [cardStyle, setCardStyle] = useState('Modern');
  const [manaSelects, setManaSelects] = useState(['', '', '', '']);
  const [savedCards, setSavedCards] = useState<Array<{data: typeof initialCardData, style: string, mana: string[]}>>([]);
  const handleSaveCard = () => {
    setSavedCards(prev => [...prev, { data: cardData, style: cardStyle, mana: [...manaSelects] }]);
  };

  const handleLoadCard = (card: {data: typeof initialCardData, style: string, mana: string[]}) => {
    setCardData(card.data);
    setCardStyle(card.style);
    setManaSelects(card.mana);
  };

  const handleRemoveCard = () => {
    setSavedCards(prev => prev.filter(card => {
      // Remove card if all fields match
      return !(
        card.data.name === cardData.name &&
        card.data.manaCost === cardData.manaCost &&
        card.data.typeLine === cardData.typeLine &&
        card.data.power === cardData.power &&
        card.data.toughness === cardData.toughness &&
        card.data.rulesText === cardData.rulesText &&
        card.data.flavorText === cardData.flavorText &&
        card.data.collectorNo === cardData.collectorNo &&
        card.data.rarity === cardData.rarity &&
        card.data.setCode === cardData.setCode &&
        card.data.language === cardData.language &&
        card.data.artist === cardData.artist &&
        card.data.copyright === cardData.copyright &&
        card.style === cardStyle &&
        JSON.stringify(card.mana) === JSON.stringify(manaSelects)
      );
    }));
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
    const { name, value } = e.target as any;
    setCardData(prev => ({ ...prev, [name]: value }));
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

  const frame = useMemo(() => frameDefs[cardStyle] || blackFrame, [cardStyle]);
  const cardRef = useRef<HTMLDivElement>(null);
  const handleExportAllPDF = async () => {
    if (savedCards.length === 0) return;
    // A4 size in mm
    const a4Width = 210;
    const a4Height = 297;
    // Card size in px
    const cardPxWidth = 300;
    const cardPxHeight = 420;
    // Card size in mm (assuming 96 dpi)
    const pxToMm = 25.4 / 96;
    const cardMmWidth = cardPxWidth * pxToMm;
    const cardMmHeight = cardPxHeight * pxToMm;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    for (let i = 0; i < savedCards.length; i++) {
      // Create a temporary card preview for each saved card
      const tempDiv = document.createElement('div');
      tempDiv.style.width = '300px';
      tempDiv.style.height = '420px';
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);
      // Render the card preview
      const frame = frameDefs[savedCards[i].style] || blackFrame;
      tempDiv.innerHTML = `<div style="width:300px;height:420px;background:${frame.cardFrame};border:2px solid ${frame.cardFrame};border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,0.5);overflow:hidden;font-family:Trebuchet MS,Verdana,Arial,sans-serif;position:relative;display:flex;flex-direction:column;">
        <div style='background:${frame.titleBar};padding:0.4em 0.6em;color:${frame.titleBarText};font-weight:bold;font-size:1em;'>${savedCards[i].data.name}</div>
        <div style='height:48%;background:${frame.artFallback};display:flex;align-items:center;justify-content:center;'>${savedCards[i].data.image ? `<img src='${savedCards[i].data.image}' style='max-width:100%;max-height:100%;object-fit:cover;'/>` : ''}</div>
        <div style='background:${frame.typeLineBg};padding:0.3em 0.6em;font-style:italic;font-size:0.85em;color:${frame.typeLineText};'>${savedCards[i].data.typeLine}</div>
        <div style='background:${frame.textBoxBg};padding:0.5em 0.6em;font-size:0.8em;color:${frame.textBoxText};white-space:pre-line;'>${savedCards[i].data.rulesText}${savedCards[i].data.flavorText ? `<div style='font-style:italic;margin-top:0.5em;color:${frame.flavorTextColor || '#444'};'>${savedCards[i].data.flavorText}</div>` : ''}</div>
        <div style='font-size:0.7em;padding:0.3em 0.6em;color:${frame.bottomInfoText};background:${frame.bottomInfoBg};'>${savedCards[i].data.collectorNo} • ${savedCards[i].data.rarity} • ${savedCards[i].data.setCode} • ${savedCards[i].data.language}</div>
        <div style='position:absolute;bottom:0.4em;right:0.4em;border:1px solid ${frame.powerToughnessBorder};background:${frame.powerToughnessBg};padding:0 0.2em;font-weight:bold;font-size:0.9em;color:${frame.powerToughnessTextColor || '#000'};'>${savedCards[i].data.power}/${savedCards[i].data.toughness}</div>
        <div style='position:absolute;bottom:0.4em;left:18.0em;font-size:0.6em;color:${frame.copyrightText};'>${savedCards[i].data.copyright}</div>
      </div>`;
      const canvas = await html2canvas(tempDiv, { backgroundColor: null });
      const imgData = canvas.toDataURL('image/png');
      if (i > 0) pdf.addPage('a4', 'portrait');
      // Center card on A4 page
      const x = (a4Width - cardMmWidth) / 2;
      const y = (a4Height - cardMmHeight) / 2;
      pdf.addImage(imgData, 'PNG', x, y, cardMmWidth, cardMmHeight);
      document.body.removeChild(tempDiv);
    }
    pdf.save('cards.pdf');
  };

  const handleExport = async () => {
    if (cardRef.current) {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null });
      const link = document.createElement('a');
      link.download = `${cardData.name.replace(/\s+/g, '_')}_card.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  return (
    <div className="App">
      <Header />
      <div style={{ display: 'flex', maxWidth: '900px', margin: '2em auto', background: '#181818', borderRadius: '12px', padding: '2em', color: '#fff', boxShadow: '0 2px 12px #0006', gap: 0 }}>
        <SavedCardsSidebar
          savedCards={savedCards}
          onLoadCard={handleLoadCard}
          onExportAllPDF={handleExportAllPDF}
        />
        <div style={{ flex: 1 }}>
          <CardPreview
            cardData={cardData}
            frame={frame}
            manaSelects={manaSelects}
            manaIcons={manaIcons}
          />
          <div style={{ display: 'flex', gap: '1em', justifyContent: 'center', margin: '1em 0' }}>
            <button
              type="button"
              onClick={handleExport}
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
              onClick={handleSaveCard}
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
              Save Card
            </button>
            <button
              type="button"
              onClick={handleRemoveCard}
              style={{
                padding: '0.6em 1.2em',
                background: 'rgba(118, 0, 0, 1)',
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
          <CardConfigForm
            cardData={cardData}
            cardStyle={cardStyle}
            manaSelects={manaSelects}
            onChange={handleChange}
            onManaSelect={handleManaSelect}
            onImageUpload={handleImageUpload}
            setCardStyle={setCardStyle}
          />
        </div>
      </div>
    </div>
  );
};

export default ProxyGenerator;
