import BoxGenerator from './pages/BoxGenerator';
import ProxyGenerator from './pages/ProxyGenerator.tsx';
import MTGRules from './pages/MTGRules';
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Routes>
  <Route path="/box-generator" element={<BoxGenerator />} />
  <Route path="/proxy-generator" element={<ProxyGenerator />} />
  <Route path="/mtg-rules" element={<MTGRules />} />
  <Route path="/origami-mapper" element={<BoxGenerator />} />
  <Route path="/" element={<BoxGenerator />} />
  <Route path="*" element={<BoxGenerator />} />
    </Routes>
  );
}

export default App;
