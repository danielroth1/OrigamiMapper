import BoxGenerator from './pages/BoxGenerator';
import ProxyGenerator from './pages/ProxyGenerator.tsx';
import MTGRules from './pages/MTGRules';
import Header from './components/Header';
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <div className="App">
      <Header />
      <Routes>
        <Route path="/box-generator" element={<BoxGenerator />} />
        <Route path="/proxy-generator" element={<ProxyGenerator />} />
        <Route path="/mtg-rules" element={<MTGRules />} />
        <Route path="/origami-mapper" element={<BoxGenerator />} />
        <Route path="/" element={<BoxGenerator />} />
        <Route path="*" element={<BoxGenerator />} />
      </Routes>
    </div>
  );
}

export default App;
