import React from 'react';
import { Link } from 'react-router-dom';

const Header: React.FC = () => (
  <header className="App-header">
    <div className="menu-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2em' }}>
      <div className="menu-left" style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <button className="menu-btn" style={{ minWidth: '100px' }}>Box Generator</button>
        </Link>
        <Link to="/proxy-generator" style={{ textDecoration: 'none' }}>
          <button className="menu-btn" style={{ minWidth: '100px' }}>Proxy Generator</button>
        </Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img src="/origami-mapper/assets/logo.jpeg" className="App-logo" alt="logo" style={{ width: '380px', height: 'auto' }} />          <span style={{ display: 'none' }}>
            Magic the Gathering, Pokémon Cards, One Piece, Flesh and Blood, Digimon, Poker, and Yu-Gi-Oh!
          </span>
      </div>
      <div className="menu-right" style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
        <Link to="/template-images" style={{ textDecoration: 'none' }}>
          <button className="menu-btn" style={{ minWidth: '100px' }}>Template Images</button>
        </Link>
        <Link to="/mtg-rules" style={{ textDecoration: 'none' }}>
          <button className="menu-btn" style={{ minWidth: '100px' }}>MTG Booklet</button>
        </Link>
      </div>
    </div>
  </header>
);

export default Header;
