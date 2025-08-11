import React, { useState } from 'react';

import Header from '../components/Header';
import ImageUpload from '../components/ImageUpload';
import blackFrame from '../cardStyles/black.json';
import whiteFrame from '../cardStyles/white.json';
import blueFrame from '../cardStyles/blue.json';
import redFrame from '../cardStyles/red.json';
import greenFrame from '../cardStyles/green.json';
import artifactFrame from '../cardStyles/artifact.json';
import yellowFrame from '../cardStyles/yellow.json';

const currentYear = new Date().getFullYear();
const initialCardData = {
  image: '/assets/colorfullskulls.jpeg',
  name: 'Electro Rat',
  manaCost: '3 {R} {U}',
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target as any;
    setCardData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (dataUrl: string) => {
    setCardData(prev => ({ ...prev, image: dataUrl }));
  };

  const frame = frameDefs[cardStyle] || blackFrame;

  return (
    <div className="App">
      <Header />
  <div style={{ maxWidth: '700px', margin: '2em auto', background: '#181818', borderRadius: '12px', padding: '2em', color: '#fff', boxShadow: '0 2px 12px #0006' }}>
        {/* Card Live Preview */}
        <div
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
              fontSize: '0.9em',
              color: frame.manaCostText,
              background: frame.manaCostBg,
              borderRadius: frame.manaCostRadius,
              padding: frame.manaCostPadding,
              marginLeft: '0.5em'
            }}>{cardData.manaCost}</span>
          </div>
          {/* Art Area */}
          <div style={{
            width: `${(48.5/63.5)*100}%`,
            height: `${(39/88.9)*100}%`,
            margin: '0 auto',
            position: 'relative',
            zIndex: 2,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
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
            {cardData.flavorText && <div style={{ fontStyle: 'italic', marginTop: '0.5em', color: '#444' }}>{cardData.flavorText}</div>}
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
            <select style={{ minWidth: '50px' }}>
              <option value="">--</option>
              <option value="W">W</option>
              <option value="U">U</option>
              <option value="B">B</option>
              <option value="R">R</option>
              <option value="G">G</option>
              <option value="C">C</option>
            </select>
            <select style={{ minWidth: '50px' }}>
              <option value="">--</option>
              <option value="W">W</option>
              <option value="U">U</option>
              <option value="B">B</option>
              <option value="R">R</option>
              <option value="G">G</option>
              <option value="C">C</option>
            </select>
            <select style={{ minWidth: '50px' }}>
              <option value="">--</option>
              <option value="W">W</option>
              <option value="U">U</option>
              <option value="B">B</option>
              <option value="R">R</option>
              <option value="G">G</option>
              <option value="C">C</option>
            </select>
            <select style={{ minWidth: '50px' }}>
              <option value="">--</option>
              <option value="W">W</option>
              <option value="U">U</option>
              <option value="B">B</option>
              <option value="R">R</option>
              <option value="G">G</option>
              <option value="C">C</option>
            </select>
            <select style={{ minWidth: '50px' }}>
              <option value="">--</option>
              <option value="W">W</option>
              <option value="U">U</option>
              <option value="B">B</option>
              <option value="R">R</option>
              <option value="G">G</option>
              <option value="C">C</option>
            </select>
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
      </div>
    </div>
  );
};

export default ProxyGenerator;
