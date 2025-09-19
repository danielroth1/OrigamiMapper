import React from 'react';
import CardColorSelect from './CardColorSelect';
import ImageUploadProxy from '../ImageUploadProxy';
import './PTGConfigForm.css';
// import card style definitions to read their artFallback defaults
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

interface PTGConfigFormProps {
  cardData: any;
  cardStyle: string;
  templateType: string;
  setTemplateType: (template: string) => void;
  manaSelects: string[];
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onManaSelect: (index: number, value: string) => void;
  setCardStyle: (style: string) => void;
  onImage: (dataUrl: string) => void;
}

const PTGConfigForm: React.FC<PTGConfigFormProps> = (props) => {
  // Extract a representative hex color from an automatic gradient string.
  const extractColorFromAuto = (auto?: string) => {
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
  const styleMap: Record<string, any> = {
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

  const getStyleFallback = (styleName?: string) => {
    if (!styleName) return '#ffffff';
    const s = styleMap[styleName];
    return (s && s.artFallback) ? s.artFallback : '#ffffff';
  };
  return (
    <form className="ptg-config-form">
      <div className="ptg-top-bar">
        <div className="ptg-color-template-group">
          <ImageUploadProxy label="Upload Card Image: " onImage={props.onImage} />
          <div className="ptg-color-style-group">
            <CardColorSelect cardStyle={props.cardStyle} setCardStyle={props.setCardStyle} />
            <label htmlFor="card-template-select">Card Style:</label>
            <select
              id="card-template-select"
              value={props.templateType}
              onChange={e => props.setTemplateType(e.target.value)}
            >
              <option value="PTG Style">PTG Style</option>
              <option value="Mana/Token">Mana/Token/Energy</option>
            </select>
            <label htmlFor="imageBg">Image BG:</label>
            <input
              id="imageBg"
              name="imageBg"
              type="color"
              value={
                props.cardData.imageBgMode === 'manual'
                  ? (props.cardData.imageBg || getStyleFallback(props.cardStyle))
                  : (props.cardData.imageBgAuto ? extractColorFromAuto(props.cardData.imageBgAuto) : getStyleFallback(props.cardStyle))
              }
              onChange={props.onChange}
              title="Pick a background color for the art area"
              style={{ width: '2.0rem', height: '1.6rem', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
              onMouseDown={() => {
                // If currently in automatic mode, switch to manual when the user clicks the color input
                if (props.cardData.imageBgMode === 'auto') {
                  // Pre-fill a manual color (use existing manual if present, else derive from auto gradient)
                  const color = props.cardData.imageBg || (props.cardData.imageBgAuto ? extractColorFromAuto(props.cardData.imageBgAuto) : getStyleFallback(props.cardStyle));
                  props.onChange({ target: { name: 'imageBg', value: color, type: 'color' } } as any);
                  // Then set mode to manual so the picker actually edits the manual color
                  props.onChange({ target: { name: 'imageBgMode', value: 'manual', type: 'select-one' } } as any);
                }
              }}
            />
            <label htmlFor="imageBgMode">Image BG Mode:</label>
            <select id="imageBgMode" name="imageBgMode" value={props.cardData.imageBgMode || 'manual'} onChange={props.onChange}>
              <option value="manual">Manual</option>
              <option value="auto">Automatic</option>
            </select>
            </div>
        </div>
          {/* Image fit/transform controls directly under upload */}
          <div style={{ marginLeft: '0.5em', display: 'flex', gap: '0.6em', alignItems: 'center' }}>
            <label htmlFor="imageFit">Image Fit:</label>
            <select id="imageFit" name="imageFit" value={props.cardData.imageFit || 'contain'} onChange={props.onChange}>
              <option value="contain">Fit (contain)</option>
              <option value="fill">Stretch (fill)</option>
            </select>

            <label htmlFor="imageFilter">Image Color Filter:</label>
            <select id="imageFilter" name="imageFilter" value={props.cardData.imageFilter || 'none'} onChange={props.onChange}>
              <option value="none">None</option>
              <option value="grayscale">Grayscale</option>
              <option value="invert">Invert</option>
              <option value="saturate">Saturate</option>
            </select>

            

            <label htmlFor="imageTransform">Transform:</label>
            <select id="imageTransform" name="imageTransform" value={props.cardData.imageTransform || 'none'} onChange={props.onChange}>
              <option value="none">None</option>
              <option value="rotate90">Rotate 90°</option>
              <option value="rotate180">Rotate 180°</option>
              <option value="rotate270">Rotate 270°</option>
              <option value="flipH">Flip Horizontal</option>
              <option value="flipV">Flip Vertical</option>
            </select>
          </div>
      </div>

      <div className="ptg-row">
        <label>Name:</label>
        <input type="text" name="name" value={props.cardData.name} onChange={props.onChange} />
      </div>

      <div className="ptg-mana-selects">
        <label>Mana Cost:</label>
        <input
          type="text"
          name="manaCost"
          value={props.cardData.manaCost}
          onChange={props.onChange}
          className="ptg-mana-cost-input"
          maxLength={2}
          placeholder="##"
          pattern="[0-9]{0,2}"
          title="0-99"
          inputMode="numeric"
        />

        {[0,1,2,3,4].map(i => (
          <select key={i} value={props.manaSelects[i]} onChange={e => props.onManaSelect(i, e.target.value)}>
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

      

      <div className="ptg-row">
        <label>Type Line:</label>
        <input type="text" name="typeLine" value={props.cardData.typeLine} onChange={props.onChange} />
      </div>

      <div className="ptg-row ptg-pt-row">
        <label className="ptg-checkbox-label" style={{ marginRight: '0.25rem' }}>
          <input
            type="checkbox"
            name="showPT"
            checked={props.cardData.showPT !== false}
            onChange={props.onChange}
            disabled={props.cardData.pwEnabled === true}
          />
          Power / Toughness enabled
        </label>
        <div className="ptg-pt-group">
          <label>Power:</label>
          <input
            type="number"
            name="power"
            value={props.cardData.power}
            onChange={props.onChange}
            className="ptg-very-small-input"
            disabled={props.cardData.showPT === false || props.cardData.pwEnabled === true}
          />
        </div>
        <div className="ptg-pt-group">
          <label>Toughness:</label>
          <input
            type="number"
            name="toughness"
            value={props.cardData.toughness}
            onChange={props.onChange}
            className="ptg-very-small-input"
            disabled={props.cardData.showPT === false || props.cardData.pwEnabled === true}
          />
        </div>
      </div>

      <div className="ptg-row ptg-pw-wrapper">
        <label className="ptg-checkbox-label">
          <input
            type="checkbox"
            name="pwEnabled"
            checked={props.cardData.pwEnabled === true}
            onChange={props.onChange}
          />
          Planeswalker Stats
        </label>
        <div className="ptg-pw-abilities">
          <div className="ptg-pw-ability ptg-pw-row" style={{ alignItems: 'center', gap: '0.5em' }}>
            <label style={{ fontSize: '0.85em', marginRight: '0.3em' }}>Life:</label>
            <input
              type="number"
              name="pwLife"
              value={props.cardData.pwLife ?? 0}
              onChange={props.onChange}
              className="ptg-small-input"
              disabled={!props.cardData.pwEnabled}
            />
          </div>
          {/* force next pwStat rows to start on a new grid row */}
          <div style={{ gridColumn: '1 / -1', height: 0 }} />
          <div className="ptg-pw-ability ptg-pw-row" style={{ alignItems: 'center', gap: '0.5em' }}>
            <input
              type="text"
              name="pwStat1"
              maxLength={3}
              value={props.cardData.pwStat1 ?? '+1'}
              onChange={props.onChange}
              className="ptg-very-small-input"
              disabled={!props.cardData.pwEnabled}
              style={{ marginRight: '0.3em' }}
            />
            <textarea
              name="pwDesc1"
              rows={2}
              maxLength={400}
              placeholder="20-50 words"
              value={props.cardData.pwDesc1 ?? 'Create a 1/1 black Zombie creature token with deathtouch.'}
              onChange={props.onChange}
              disabled={!props.cardData.pwEnabled}
              style={{ flex: 1 }}
            />
          </div>
          <div className="ptg-pw-ability ptg-pw-row" style={{ alignItems: 'center', gap: '0.5em' }}>
            <input
              type="text"
              name="pwStat2"
              maxLength={3}
              value={props.cardData.pwStat2 ?? '-2'}
              onChange={props.onChange}
              className="ptg-very-small-input"
              disabled={!props.cardData.pwEnabled}
              style={{ marginRight: '0.3em' }}
            />
            <textarea
              name="pwDesc2"
              rows={2}
              maxLength={400}
              placeholder="20-50 words"
              value={props.cardData.pwDesc2 ?? 'Up to one target creature gets -X/-X until your next turn, where X is the number of Zombies you control.'}
              onChange={props.onChange}
              disabled={!props.cardData.pwEnabled}
              style={{ flex: 1 }}
            />
          </div>
          <div className="ptg-pw-ability" style={{ alignItems: 'center', gap: '0.5em' }}>
            <input
              type="text"
              name="pwStat3"
              maxLength={3}
              value={props.cardData.pwStat3 ?? '-7'}
              onChange={props.onChange}
              className="ptg-very-small-input"
              disabled={!props.cardData.pwEnabled}
              style={{ marginRight: '0.3em' }}
            />
            <textarea
              name="pwDesc3"
              rows={2}
              maxLength={400}
              placeholder="20-50 words"
              value={props.cardData.pwDesc3 ?? 'Exile all creature cards from graveyards. For each card exiled this way, create a 2/2 black Zombie creature token.'}
              onChange={props.onChange}
              disabled={!props.cardData.pwEnabled}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </div>

      <div className="ptg-text-inline">
        <div className="ptg-inline-field">
          <label htmlFor="rulesText">Rules Text:</label>
          <textarea id="rulesText" name="rulesText" rows={4} value={props.cardData.rulesText} onChange={props.onChange} />
        </div>
        <div className="ptg-inline-field">
          <label htmlFor="flavorText">Flavor Text:</label>
          <textarea id="flavorText" name="flavorText" rows={4} value={props.cardData.flavorText} onChange={props.onChange} />
        </div>
      </div>

      <div className="ptg-row">
        <label>Collector No.:</label>
        <input type="text" name="collectorNo" value={props.cardData.collectorNo} onChange={props.onChange} className="ptg-small-input" />
        <label>Rarity:</label>
        <select name="rarity" value={props.cardData.rarity} onChange={props.onChange} className="ptg-small-input">
          <option>R</option>
          <option>U</option>
          <option>C</option>
          <option>M</option>
        </select>
      </div>

      <div className="ptg-row">
        <label>Set Code:</label>
        <input type="text" name="setCode" value={props.cardData.setCode} onChange={props.onChange} className="ptg-small-input" />
        <label>Language:</label>
        <select name="language" value={props.cardData.language} onChange={props.onChange} className="ptg-small-input">
          <option>EN</option>
          <option>DE</option>
          <option>FR</option>
          <option>JP</option>
          <option>CZ</option>
          <option>KZ</option>
          <option>UA</option>
          <option>RU</option>
          <option>CN</option>
          <option>ES</option>
          <option>PT</option>
          <option>PL</option>
          <option>IT</option>
          <option>KO</option>
          <option>TK</option>
        </select>
      </div>

      <div className="ptg-row">
        <label>Copyright:</label>
        <input type="text" name="copyright" value={props.cardData.copyright} onChange={props.onChange} />
      </div>
    </form>
  );
};

export default PTGConfigForm;
