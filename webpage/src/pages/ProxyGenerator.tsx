import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { IoLeafSharp, IoSkullSharp, IoSunny, IoFlame, IoFlashSharp, IoWater } from 'react-icons/io5';

import Header from '../components/Header';
import ImageUpload from '../components/ImageUpload';
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

  const frame = frameDefs[cardStyle] || blackFrame;
  const cardRef = useRef<HTMLDivElement>(null);
  const cardPreviewRefs = useRef<Array<HTMLDivElement | null>>([]);
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
        {/* Saved Cards Sidebar - now directly next to preview, shorter and scrollable */}
  <div style={{ width: '120px', background: '#222', borderRadius: '8px', padding: '0.5em', boxShadow: '0 2px 8px #0002', height: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          <h3 style={{ fontSize: '1em', marginBottom: '1em', color: '#fff' }}>Saved Cards</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1 }}>
            {savedCards.map((card, idx) => (
              <li key={idx} style={{ marginBottom: '0.5em' }}>
                <button
                  style={{ width: '100%', background: '#333', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.3em', cursor: 'pointer', textAlign: 'left', fontSize: '0.8em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  onClick={() => handleLoadCard(card)}
                >
                  <span>{card.data.name}</span>
                  <span style={{ color: '#aaa', fontSize: '0.75em', marginLeft: '0.5em' }}>{card.style}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleExportAllPDF}
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
        <div style={{ flex: 1 }}>
          {/* Card Live Preview */}
          <div
            ref={cardRef}
            style={{
              margin: '2em auto',
              width: '300px',
              height: '420px',
              background: frame.cardFrame,
              border: `2px solid ${frame.cardFrame}`,
              borderRadius: '12px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              fontFamily: 'Trebuchet MS, Verdana, Arial, sans-serif',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
          {/* Inner Border */}
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
          {/* Title Bar (Name Bar) */}
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
            <span style={{
              fontFamily: 'monospace',
              color: frame.manaCostText,
              background: frame.manaCostBg,
              borderRadius: frame.manaCostRadius,
              padding: frame.manaCostPadding,
              marginLeft: '0.5em'
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '1.0em',
                height: '1.0em',
                borderRadius: '50%',
                background: frame.manaCostBg,
                border: `2px solid ${frame.manaCostText}`,
                fontSize: '1.0em',
                fontWeight: 'bold',
                color: frame.manaCostText,
                marginRight: '0.2em'
              }}>{cardData.manaCost}</span>
              {manaSelects.map((symbol, i) => {
                if (!symbol) return null;
                const color = frame.manaIconColors && frame.manaIconColors[symbol] ? frame.manaIconColors[symbol] : '#000';
                return (
                  <span key={i} style={{ marginLeft: '0.2em' }}>
                    {manaIcons[symbol] ? manaIcons[symbol](color) : symbol}
                  </span>
                );
              })}
            </span>
          </div>
          {/* Art Area */}
          <div style={{
            width: '92%', // bigger image area
            height: '48%', // bigger image area
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
          {/* Type Line */}
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
          {/* Text Box */}
          <div style={{
            background: frame.textBoxBg,
            padding: '0.5em 0.6em',
            fontSize: '0.8em',
            flex: '1',
            /* overflowY removed to prevent scrolling */
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
          {/* Bottom Info */}
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
          {/* Power/Toughness */}
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
          {/* Copyright */}
          <div style={{
            position: 'absolute',
            bottom: '0.4em',
            left: '18.0em',
            fontSize: '0.6em',
            color: frame.copyrightText,
            zIndex: 3
          }}>{cardData.copyright}</div>
        </div>
        {/* Export & Save Buttons */}
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
        {/* Configuration Form */}
        <form style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
          <div style={{ display: 'flex', gap: '2em', alignItems: 'center', marginBottom: '1em', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1em' }}>
              <label htmlFor="card-style-select">Card Style:</label>
              <select
                id="card-style-select"
                value={cardStyle}
                onChange={e => setCardStyle(e.target.value)}
                style={{ minWidth: '120px', padding: '0.3em', borderRadius: '6px' }}
              >
                <option value="Black">Black</option>
                <option value="Black2">Black2</option>
                <option value="Green">Green</option>
                <option value="White">White</option>
                <option value="Red">Red</option>
                <option value="Blue">Blue</option>
                <option value="Yellow">Yellow</option>
                <option value="Artifact">Artifact</option>
              </select>
            </div>
            <div style={{ textAlign: 'center' }}>
              <ImageUpload label="Choose Image" onImage={handleImageUpload} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <label>Name:</label>
            <input type="text" name="name" value={cardData.name} onChange={handleChange} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <label>Mana Cost:</label>
            <input type="text" name="manaCost" value={cardData.manaCost} onChange={handleChange} style={{ minWidth: '120px' }} />
            {[0,1,2,3].map(i => (
              <select key={i} style={{ minWidth: '50px' }} value={manaSelects[i]} onChange={e => handleManaSelect(i, e.target.value)}>
                <option value="">--</option>
                <option value="R">Red</option>
                <option value="U">Blue</option>
                <option value="G">Green</option>
                <option value="W">White</option>
                <option value="Y">Yellow</option>
                <option value="B">Black</option>
              </select>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <label>Type Line:</label>
            <input type="text" name="typeLine" value={cardData.typeLine} onChange={handleChange} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <label>Power:</label>
            <input type="number" name="power" value={cardData.power} onChange={handleChange} style={{ width: '60px' }} />
            <label>Toughness:</label>
            <input type="number" name="toughness" value={cardData.toughness} onChange={handleChange} style={{ width: '60px' }} />
          </div>
          <div>
            <label>Rules Text:</label>
            <textarea name="rulesText" rows={3} value={cardData.rulesText} onChange={handleChange} style={{ width: '100%', resize: 'vertical' }} />
          </div>
          <div>
            <label>Flavor Text:</label>
            <textarea name="flavorText" rows={3} value={cardData.flavorText} onChange={handleChange} style={{ width: '100%', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <label>Collector No.:</label>
            <input type="text" name="collectorNo" value={cardData.collectorNo} onChange={handleChange} style={{ width: '80px' }} />
            <label>Rarity:</label>
            <select name="rarity" value={cardData.rarity} onChange={handleChange} style={{ minWidth: '60px' }}>
              <option>R</option>
              <option>U</option>
              <option>C</option>
              <option>M</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <label>Set Code:</label>
            <input type="text" name="setCode" value={cardData.setCode} onChange={handleChange} style={{ width: '80px' }} />
            <label>Language:</label>
            <select name="language" value={cardData.language} onChange={handleChange} style={{ minWidth: '60px' }}>
              <option>EN</option>
              <option>DE</option>
              <option>FR</option>
              <option>JP</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <label>Copyright:</label>
            <input type="text" name="copyright" value={cardData.copyright} onChange={handleChange} style={{ flex: 1 }} />
          </div>
        </form>
        </div> {/* End main content */}
      </div> {/* End flex container */}
  </div>
  );
};

export default ProxyGenerator;
