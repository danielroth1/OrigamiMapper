import React from 'react';
import { NavLink, Link } from 'react-router-dom';

const Header: React.FC = () => (
  <header className="site-header" role="banner">
    <nav className="nav-grid" aria-label="Primary">
      <ul className="nav-group nav-left">
        <li>
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Box Generator
          </NavLink>
        </li>
        <li>
          <NavLink to="/proxy-generator" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Proxy Generator
          </NavLink>
        </li>
      </ul>

      <Link to="/" className="brand" aria-label="Origami Mapper Home">
        <img
          src="/origami-mapper/assets/logo.jpeg"
          alt="Origami Mapper"
        />
        <span className="sr-only">
          Magic the Gathering, Pokémon Cards, One Piece, Flesh and Blood, Digimon, Poker, and Yu-Gi-Oh!
        </span>
      </Link>

      <ul className="nav-group nav-right">
        <li>
          <NavLink to="/template-images" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Template Images
          </NavLink>
        </li>
        <li>
          <NavLink to="/mtg-rules" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            MTG Booklet
          </NavLink>
        </li>
      </ul>
    </nav>
  </header>
);

export default Header;
