import React from 'react';
import './PokeManaConfigForm.css';
import {
  ImageControlsSection,
  ManaCostSection,
  PowerToughnessSection,
  CollectorInfoSection,
  CardColorSelect
} from './SharedCardFormComponents';

interface PokeManaConfigFormProps {
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

const PokeManaConfigForm: React.FC<PokeManaConfigFormProps> = (props) => {
  return (
    <form className="pokemana-config-form">
      {/* Card Style and Color selectors - first row */}
      <div className="pokemana-row pokemana-row--top" style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center' }}>
          <label htmlFor="card-template-select">Card Style:</label>
          <select
            id="card-template-select"
            value={props.templateType}
            onChange={e => props.setTemplateType(e.target.value)}
            style={{ minWidth: '120px' }}
          >
            <option value="PTG Style">PTG Style</option>
            <option value="Mana/Token">Mana/Token</option>
          </select>
        </div>
        <CardColorSelect cardStyle={props.cardStyle} setCardStyle={props.setCardStyle} />
      </div>

      {/* Image Controls Section - using shared component */}
      <div style={{ marginBottom: '1em' }}>
        <ImageControlsSection
          cardData={props.cardData}
          cardStyle={props.cardStyle}
          templateType={props.templateType}
          setTemplateType={props.setTemplateType}
          setCardStyle={props.setCardStyle}
          onImage={props.onImage}
          onChange={props.onChange}
        />
      </div>

      {/* Title Section - Specific to PokeMana template */}
      <div className="pokemana-row pokemana-row--title" style={{ display: 'flex', alignItems: 'center', gap: '1em' }}>
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

      {/* Mana Cost Section */}
      <div className="pokemana-row pokemana-row--mana" style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
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
        <ManaCostSection
          cardData={props.cardData}
          manaSelects={props.manaSelects}
          onChange={props.onChange}
          onManaSelect={props.onManaSelect}
        />
      </div>


      {/* Power / Toughness */}
      <PowerToughnessSection
        cardData={props.cardData}
        onChange={props.onChange}
      />





      <CollectorInfoSection
        cardData={props.cardData}
        onChange={props.onChange}
        variant="pokemana"
      />

      {/* Bottom text field */}
      <div className="pokemana-row pokemana-row--bottom" style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label>Bottom Text:</label>
        <input 
          type="text" 
          name="bottomText" 
          value={props.cardData.bottomText || ''} 
          onChange={props.onChange} 
          style={{ flex: 1 }}
          placeholder="Custom bottom text (optional)"
        />
      </div>
      </form>
  );
};

export default PokeManaConfigForm;
