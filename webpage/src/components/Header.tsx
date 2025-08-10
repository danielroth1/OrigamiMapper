import React from 'react';

const Header: React.FC = () => (
  <header className="App-header">
    <div className="menu-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2em' }}>
      <div className="menu-right" style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
        <button className="menu-btn" style={{ minWidth: '100px' }}>The Cube Project</button>
        <button className="menu-btn" style={{ minWidth: '100px' }} disabled>Box Builder</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img src="/origami-mapper/assets/logo.jpeg" className="App-logo" alt="logo" style={{ width: '380px', height: 'auto' }} />
        <div style={{ color: '#fff', marginTop: '1em', fontSize: '1.1em', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
          Build your own Card Deck Box! <br />
          This tool generates printable templates from your images. <br />
          Perfect for holding a standard deck of 60 cards. <br />
          <span style={{ display: 'none' }}>
            Magic the Gathering, Pokémon Cards, One Piece, Flesh and Blood, Digimon, Poker, and Yu-Gi-Oh!
          </span>
        </div>
      </div>
      <div className="menu-left" style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
        <button className="menu-btn" style={{ minWidth: '100px' }}>Proxy Generator</button>
        <button className="menu-btn" style={{ minWidth: '100px' }}>FAQ</button>
      </div>
    </div>
  </header>
);

export default Header;
