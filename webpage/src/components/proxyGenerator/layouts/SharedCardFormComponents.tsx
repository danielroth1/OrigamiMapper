import React from 'react';
import CardColorSelect from './CardColorSelect';
import ImageUploadProxy from '../ImageUploadProxy';
// Import card style definitions
import black from '../../../cardStyles/black.json';
import black2 from '../../../cardStyles/black2.json';
import green from '../../../cardStyles/green.json';
import white from '../../../cardStyles/white.json';
import white2 from '../../../cardStyles/white2.json';
import red from '../../../cardStyles/red.json';
import red2 from '../../../cardStyles/red2.json';
import blue from '../../../cardStyles/blue.json';
import blue2 from '../../../cardStyles/blue2.json';
import yellow from '../../../cardStyles/yellow.json';
import artifact from '../../../cardStyles/artifact.json';

// Common types and interfaces
export interface CardFormProps {
  cardData: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}

export interface ManaCostProps extends CardFormProps {
  manaSelects: string[];
  onManaSelect: (index: number, value: string) => void;
}

export interface ImageControlsProps extends CardFormProps {
  cardStyle: string;
  templateType: string;
  setTemplateType: (template: string) => void;
  setCardStyle: (style: string) => void;
  onImage: (dataUrl: string) => void;
}

// Shared utility functions
export const extractColorFromAuto = (auto?: string): string => {
  if (!auto) return '#ffffff';
  // Try to find a hex color first
  const hexMatch = auto.match(/#([0-9a-fA-F]{3,6})/);
  if (hexMatch) {
    let hex = hexMatch[0];
    // expand short form #rgb -> #rrggbb
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    return hex;
  }
  // Try to find an rgb(...) color
  const rgbMatch = auto.match(/rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/);
  if (rgbMatch) {
    const r = Math.max(0, Math.min(255, Number(rgbMatch[1])));
    const g = Math.max(0, Math.min(255, Number(rgbMatch[2])));
    const b = Math.max(0, Math.min(255, Number(rgbMatch[3])));
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  return '#ffffff';
};

// Map of available styles to their JSON definitions
export const styleMap: Record<string, any> = {
  Black: black,
  Black2: black2,
  Green: green,
  White: white,
  White2: white2,
  Red: red,
  Red2: red2,
  Blue: blue,
  Blue2: blue2,
  Yellow: yellow,
  Artifact: artifact,
};

export const getStyleFallback = (styleName?: string): string => {
  if (!styleName) return '#ffffff';
  const s = styleMap[styleName];
  return (s && s.artFallback) ? s.artFallback : '#ffffff';
};

// Re-export CardColorSelect for use in other components
export { default as CardColorSelect } from './CardColorSelect';

// Image Controls Section
export const ImageControlsSection: React.FC<ImageControlsProps> = ({
  cardData,
  cardStyle,
  templateType,
  setTemplateType,
  setCardStyle,
  onImage,
  onChange
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
      {/* Top controls row */}
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center', flexWrap: 'wrap' }}>
        <ImageUploadProxy label="Upload Card Image" onImage={onImage} />
      </div>

      {/* Image Background controls - separate row */}
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center' }}>
          <label htmlFor="imageBg">Image BG:</label>
          <input
            id="imageBg"
            name="imageBg"
            type="color"
            value={
              cardData.imageBgMode === 'manual'
                ? (cardData.imageBg || getStyleFallback(cardStyle))
                : (cardData.imageBgAuto ? extractColorFromAuto(cardData.imageBgAuto) : getStyleFallback(cardStyle))
            }
            onChange={onChange}
            title="Pick a background color for the art area"
            style={{ width: '40px', height: '30px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
            onMouseDown={() => {
              // If currently in automatic mode, switch to manual when the user clicks the color input
              if (cardData.imageBgMode === 'auto') {
                // Pre-fill a manual color (use existing manual if present, else derive from auto gradient)
                const color = cardData.imageBg || (cardData.imageBgAuto ? extractColorFromAuto(cardData.imageBgAuto) : getStyleFallback(cardStyle));
                onChange({ target: { name: 'imageBg', value: color, type: 'color' } } as any);
                // Then set mode to manual so the picker actually edits the manual color
                onChange({ target: { name: 'imageBgMode', value: 'manual', type: 'select-one' } } as any);
              }
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center' }}>
          <label htmlFor="imageBgMode">BG Mode:</label>
          <select id="imageBgMode" name="imageBgMode" value={cardData.imageBgMode || 'manual'} onChange={onChange}>
            <option value="manual">Manual</option>
            <option value="auto">Automatic</option>
          </select>
        </div>
      </div>

      {/* Image transform controls */}
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center' }}>
          <label htmlFor="imageFit">Image Fit:</label>
          <select id="imageFit" name="imageFit" value={cardData.imageFit || 'contain'} onChange={onChange}>
            <option value="contain">Fit (contain)</option>
            <option value="fill">Stretch (fill)</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center' }}>
          <label htmlFor="imageFilter">Image Filter:</label>
          <select id="imageFilter" name="imageFilter" value={cardData.imageFilter || 'none'} onChange={onChange}>
            <option value="none">None</option>
            <option value="grayscale">Grayscale</option>
            <option value="invert">Invert</option>
            <option value="saturate">Saturate</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center' }}>
          <label htmlFor="imageTransform">Transform:</label>
          <select id="imageTransform" name="imageTransform" value={cardData.imageTransform || 'none'} onChange={onChange}>
            <option value="none">None</option>
            <option value="rotate90">Rotate 90°</option>
            <option value="rotate180">Rotate 180°</option>
            <option value="rotate270">Rotate 270°</option>
            <option value="flipH">Flip Horizontal</option>
            <option value="flipV">Flip Vertical</option>
          </select>
        </div>
      </div>
    </div>
  );
};

// Mana Cost Section
export const ManaCostSection: React.FC<ManaCostProps> = ({
  cardData,
  manaSelects,
  onChange,
  onManaSelect
}) => {
  const isDisabled = cardData.showMana === false;
  
  return (
    <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
      <label>Mana Cost:</label>
      <input
        type="text"
        name="manaCost"
        value={cardData.manaCost || ''}
        onChange={onChange}
        style={{ width: '60px' }}
        maxLength={2}
        placeholder="##"
        pattern="[0-9]{0,2}"
        title="0-99"
        inputMode="numeric"
        disabled={isDisabled}
      />

      {[0,1,2,3,4].map(i => (
        <select key={i} style={{ minWidth: '70px' }} value={manaSelects[i]} onChange={e => onManaSelect(i, e.target.value)} disabled={isDisabled}>
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
  );
};

// Power/Toughness Section
export const PowerToughnessSection: React.FC<CardFormProps> = ({
  cardData,
  onChange
}) => {
  return (
    <div className="ptg-pt-section">
      <label className="ptg-pt-toggle">
        <input
          type="checkbox"
          name="showPT"
          checked={cardData.showPT !== false}
          onChange={onChange}
          disabled={cardData.pwEnabled === true}
        />
        Power / Toughness enabled
      </label>
      <div className="ptg-pt-field">
        <label htmlFor="power-input">Power:</label>
        <input
          id="power-input"
          type="number"
          name="power"
          value={cardData.power || 0}
          onChange={onChange}
          className="ptg-pt-number"
          disabled={cardData.showPT === false || cardData.pwEnabled === true}
        />
      </div>
      <div className="ptg-pt-field">
        <label htmlFor="toughness-input">Toughness:</label>
        <input
          id="toughness-input"
          type="number"
          name="toughness"
          value={cardData.toughness || 0}
          onChange={onChange}
          className="ptg-pt-number"
          disabled={cardData.showPT === false || cardData.pwEnabled === true}
        />
      </div>
    </div>
  );
};

// Collector Info Section
export interface CollectorInfoProps extends CardFormProps {
  className?: string;
  inputClassName?: string;
  variant?: 'ptg' | 'pokemana';
}

export const CollectorInfoSection: React.FC<CollectorInfoProps> = ({
  cardData,
  onChange,
  className = '',
  inputClassName = '',
  variant = 'pokemana'
}) => {
  if (variant === 'ptg') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
        <div className={`ptg-row ${className}`.trim()}>
          <label>Collector No.:</label>
          <input 
            type="text" 
            name="collectorNo" 
            value={cardData.collectorNo || ''} 
            onChange={onChange} 
            className={`ptg-small-input ${inputClassName}`.trim()}
          />
          <label>Rarity:</label>
          <select name="rarity" value={cardData.rarity || 'C'} onChange={onChange} className={`ptg-small-input ${inputClassName}`.trim()}>
            <option value="R">R</option>
            <option value="U">U</option>
            <option value="C">C</option>
            <option value="M">M</option>
          </select>
        </div>

        <div className={`ptg-row ${className}`.trim()}>
          <label>Set Code:</label>
          <input 
            type="text" 
            name="setCode" 
            value={cardData.setCode || ''} 
            onChange={onChange} 
            className={`ptg-small-input ${inputClassName}`.trim()}
          />
          <label>Language:</label>
          <select name="language" value={cardData.language || 'EN'} onChange={onChange} className={`ptg-small-input ${inputClassName}`.trim()}>
            <option value="EN">EN</option>
            <option value="DE">DE</option>
            <option value="FR">FR</option>
            <option value="JP">JP</option>
            <option value="CZ">CZ</option>
            <option value="KZ">KZ</option>
            <option value="UA">UA</option>
            <option value="RU">RU</option>
            <option value="CN">CN</option>
            <option value="ES">ES</option>
            <option value="PT">PT</option>
            <option value="PL">PL</option>
            <option value="IT">IT</option>
            <option value="KO">KO</option>
            <option value="TK">TK</option>
          </select>
        </div>

        <div className={`ptg-row ${className}`.trim()}>
          <label>Copyright:</label>
          <input 
            type="text" 
            name="copyright" 
            value={cardData.copyright || ''} 
            onChange={onChange}
          />
        </div>
      </div>
    );
  }

  // Default PokeMana variant
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
      {/* Collector details row */}
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label>Collector No.:</label>
        <input 
          type="text" 
          name="collectorNo" 
          value={cardData.collectorNo || ''} 
          onChange={onChange} 
          style={{ width: '80px' }}
          placeholder="0001"
        />
        <label>Rarity:</label>
        <select name="rarity" value={cardData.rarity || 'C'} onChange={onChange} style={{ width: '60px' }}>
          <option value="C">C</option>
          <option value="U">U</option>
          <option value="R">R</option>
          <option value="M">M</option>
        </select>
        <label>Set Code:</label>
        <input 
          type="text" 
          name="setCode" 
          value={cardData.setCode || ''} 
          onChange={onChange} 
          style={{ width: '80px' }}
          placeholder="PTG"
        />
        <label>Language:</label>
        <select name="language" value={cardData.language || 'EN'} onChange={onChange} style={{ width: '80px' }}>
          <option value="EN">EN</option>
          <option value="DE">DE</option>
          <option value="FR">FR</option>
          <option value="JP">JP</option>
          <option value="CZ">CZ</option>
          <option value="KZ">KZ</option>
          <option value="UA">UA</option>
          <option value="RU">RU</option>
          <option value="CN">CN</option>
          <option value="ES">ES</option>
          <option value="PT">PT</option>
          <option value="PL">PL</option>
          <option value="IT">IT</option>
          <option value="KO">KO</option>
          <option value="TK">TK</option>
        </select>
      </div>

      {/* Artist and Copyright */}
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label>Artist:</label>
        <input 
          type="text" 
          name="artist" 
          value={cardData.artist || ''} 
          onChange={onChange} 
          style={{ flex: 1 }}
          placeholder="Artist name"
        />
      </div>

      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label>Copyright:</label>
        <input 
          type="text" 
          name="copyright" 
          value={cardData.copyright || ''} 
          onChange={onChange} 
          style={{ flex: 1 }}
          placeholder="©2025 Your Name"
        />
      </div>
    </div>
  );
};