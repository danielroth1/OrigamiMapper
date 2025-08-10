import React from 'react';
import Header from '../components/Header';

const ProxyGenerator: React.FC = () => (
  <div className="App">
    <Header />
    <div style={{ maxWidth: '700px', margin: '2em auto', background: '#181818', borderRadius: '12px', padding: '2em', color: '#fff', boxShadow: '0 2px 12px #0006' }}>
      <h2 style={{ fontSize: '1.5em', marginBottom: '1em' }}>Proxy Generator</h2>
      <p>
        This page will allow you to generate proxies for your card games. <br />
        (Feature coming soon!)
      </p>
    </div>
  </div>
);

export default ProxyGenerator;
