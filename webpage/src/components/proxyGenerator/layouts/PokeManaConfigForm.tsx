import React from 'react';
import CardColorSelect from './CardColorSelect';

interface PokeManaConfigFormProps {
  cardData: any;
  cardStyle: string;
  templateType: string;
  setTemplateType: (template: string) => void;
  manaSelects: string[];
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onManaSelect: (index: number, value: string) => void;
  setCardStyle: (style: string) => void;
}

const PokeManaConfigForm: React.FC<PokeManaConfigFormProps> = (props) => {
  // Example: Only show name, color, and image for PokeMana

  return (
    <form style={{ display: 'flex', flexDirection: 'column', gap: '1em', borderRadius: '8px', padding: '1em' }}>
      <div style={{ display: 'flex', gap: '2em', alignItems: 'center', marginBottom: '1em', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1em' }}>
          <CardColorSelect cardStyle={props.cardStyle} setCardStyle={props.setCardStyle} />
          <label htmlFor="card-template-select" style={{ marginLeft: '2em' }}>Card Style:</label>
          <select
            id="card-template-select"
            value={props.templateType}
            onChange={e => props.setTemplateType(e.target.value)}
            style={{ minWidth: '120px', padding: '0.3em', borderRadius: '6px' }}
          >
            <option value="PTG Style">PTG Style</option>
            <option value="Mana/Token">Mana/Token</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1em' }}>
        <label>Title:</label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4em' }}>
          <input
            type="checkbox"
            name="useCustomTitle"
            checked={!!props.cardData.useCustomTitle}
            onChange={props.onChange}
          />
          Use custom title
        </label>
        <input
          type="text"
          name="name"
          value={props.cardData.name}
          onChange={props.onChange}
          placeholder="Enter custom title"
          style={{ minWidth: '160px', padding: '0.3em', borderRadius: '6px' }}
          disabled={!props.cardData.useCustomTitle}
        />
        <select name="name" value={props.cardData.name} onChange={props.onChange} style={{ minWidth: '160px', padding: '0.3em', borderRadius: '6px' }} disabled={!!props.cardData.useCustomTitle}>
          <option value="Mana">Mana</option>
          <option value="Energy">Energy</option>
          <option value="Token">Token</option>
          <option value="Treasure">Treasure</option>
          <option value="Clue">Clue</option>
          <option value="Food">Food</option>
          <option value="Gold">Gold</option>
          <option value="Blood">Blood</option>
          <option value="Powerstone">Powerstone</option>
          <option value="Map">Map</option>
          <option value="The Ring">The Ring</option>
          <option value="Emblem">Emblem</option>
          <option value="Poison">Poison</option>
          <option value="Experience">Experience</option>
          <option value="Monarch">Monarch</option>
          <option value="City's Blessing">City's Blessing</option>
          <option value="Initiative">Initiative</option>
          <option value="Energy Reserve">Energy Reserve</option>
          <option value="Zombie">Zombie</option>
          <option value="Goblin">Goblin</option>
          <option value="Soldier">Soldier</option>
          <option value="Angel">Angel</option>
          <option value="Dragon">Dragon</option>
          <option value="Beast">Beast</option>
          <option value="Saproling">Saproling</option>
          <option value="Spirit">Spirit</option>
          <option value="Elemental">Elemental</option>
          <option value="Elf">Elf</option>
          <option value="Cat">Cat</option>
          <option value="Bird">Bird</option>
          <option value="Construct">Construct</option>
          <option value="Human">Human</option>
          <option value="Knight">Knight</option>
          <option value="Wolf">Wolf</option>
          <option value="Rat">Rat</option>
          <option value="Snake">Snake</option>
          <option value="Demon">Demon</option>
          <option value="Wurm">Wurm</option>
          <option value="Dragon">Dragon</option>
          <option value="Golem">Golem</option>
          <option value="Plant">Plant</option>
          <option value="Thopter">Thopter</option>
          <option value="Servo">Servo</option>
          <option value="Fish">Fish</option>
          <option value="Insect">Insect</option>
          <option value="Dog">Dog</option>
          <option value="Bear">Bear</option>
          <option value="Fungus">Fungus</option>
          <option value="Horse">Horse</option>
          <option value="Pegasus">Pegasus</option>
          <option value="Squirrel">Squirrel</option>
          <option value="Troll">Troll</option>
          <option value="Unicorn">Unicorn</option>
          <option value="Vampire">Vampire</option>
          <option value="Warrior">Warrior</option>
          <option value="Wizard">Wizard</option>
          <option value="Shapeshifter">Shapeshifter</option>
          <option value="Sliver">Sliver</option>
          <option value="Merfolk">Merfolk</option>
          <option value="Minotaur">Minotaur</option>
          <option value="Ogre">Ogre</option>
          <option value="Orc">Orc</option>
          <option value="Pirate">Pirate</option>
          <option value="Zombie Army">Zombie Army</option>
        </select>
      </div>
      {/* Art image options for PokeMana, using same fields as PTG */}
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label htmlFor="pm-imageFit">Art Image Fit:</label>
        <select id="pm-imageFit" name="imageFit" value={props.cardData.imageFit || 'contain'} onChange={props.onChange} style={{ minWidth: '140px' }}>
          <option value="cover">All of the space should be filled (cover)</option>
          <option value="contain">Fit (contain)</option>
          <option value="fill">Stretch (fill)</option>
        </select>
        <label htmlFor="pm-imageTransform">Transform:</label>
        <select id="pm-imageTransform" name="imageTransform" value={props.cardData.imageTransform || 'none'} onChange={props.onChange} style={{ minWidth: '140px' }}>
          <option value="none">None</option>
          <option value="rotate90">Rotate 90°</option>
          <option value="rotate180">Rotate 180°</option>
          <option value="rotate270">Rotate 270°</option>
          <option value="flipH">Flip Horizontal</option>
          <option value="flipV">Flip Vertical</option>
        </select>
      </div>
      {/* Power / Toughness (same as PTG) */}
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label>
          <input
            type="checkbox"
            name="showPT"
            checked={props.cardData.showPT !== false}
            onChange={props.onChange}
            style={{ marginRight: '0.5em' }}
          />
          Power / Toughness enabled
        </label>
        <label>Power:</label>
        <input type="number" name="power" value={props.cardData.power || 0} onChange={props.onChange} style={{ width: '60px' }} disabled={props.cardData.showPT === false} />
        <label>Toughness:</label>
        <input type="number" name="toughness" value={props.cardData.toughness || 0} onChange={props.onChange} style={{ width: '60px' }} disabled={props.cardData.showPT === false} />
      </div>
      {/* Mana controls matching PTGConfigForm */}
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label>
          <input
            type="checkbox"
            name="showMana"
            checked={props.cardData.showMana !== false}
            onChange={props.onChange}
            style={{ marginRight: '0.5em' }}
          />
          Show Mana
        </label>
        <label>Mana Cost:</label>
        <input type="text" name="manaCost" value={props.cardData.manaCost || ''} onChange={props.onChange} style={{ minWidth: '120px' }} disabled={props.cardData.showMana === false} />
        {[0,1,2,3].map(i => (
          <select key={i} style={{ minWidth: '50px' }} value={props.manaSelects[i]} onChange={e => props.onManaSelect(i, e.target.value)} disabled={props.cardData.showMana === false}>
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
      {/* Bottom text field */}
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label>Bottom Text:</label>
        <input type="text" name="bottomText" value={props.cardData.bottomText || ''} onChange={props.onChange} style={{ flex: 1 }} />
      </div>
      </form>
  );
};

export default PokeManaConfigForm;
