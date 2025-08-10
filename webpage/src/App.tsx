import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './App.css';
import ImageUpload from './components/ImageUpload';
import ImagePreview from './components/ImagePreview';
import TemplateSelect from './components/TemplateSelect';
import { runMappingJS } from './OrigamiMapperJS';

import { ImageTransform } from './components/ImageTransform';
import PolygonEditor from './components/PolygonEditor';
import boxData from '../../templates/box/box.json';

function App() {
  const [outsideImgRaw, setOutsideImgRaw] = useState('');
  const [insideImgRaw, setInsideImgRaw] = useState('');
  const [outsideImgTransformed, setOutsideImgTransformed] = useState('');
  const [insideImgTransformed, setInsideImgTransformed] = useState('');
  const [template, setTemplate] = useState('Box');
  const [transformMode, setTransformMode] = useState<'none' | 'scale' | 'tile' | 'tile4'>('scale');
  const [results, setResults] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);

  // Transform image according to selected mode
  const transformImage = (dataUrl: string, mode: 'none' | 'scale' | 'tile' | 'tile4', callback: (result: string) => void) => {
    if (mode === 'none') {
      callback(dataUrl);
    } else if (mode === 'scale') {
      ImageTransform.scaleToA4Ratio(dataUrl, callback);
    } else if (mode === 'tile') {
      ImageTransform.tileToA4Ratio(dataUrl, callback);
    } else if (mode === 'tile4') {
      ImageTransform.tile4Times(dataUrl, callback);
    }
  };

  // Set and transform outside image
  const setOutsideImg = (dataUrl: string) => {
    setOutsideImgRaw(dataUrl);
    transformImage(dataUrl, transformMode, setOutsideImgTransformed);
  };
  // Set and transform inside image
  const setInsideImg = (dataUrl: string) => {
    setInsideImgRaw(dataUrl);
    transformImage(dataUrl, transformMode, setInsideImgTransformed);
  };

  // Re-transform images when mode changes
  useEffect(() => {
    if (outsideImgRaw) transformImage(outsideImgRaw, transformMode, setOutsideImgTransformed);
    if (insideImgRaw) transformImage(insideImgRaw, transformMode, setInsideImgTransformed);
  }, [transformMode, outsideImgRaw, insideImgRaw]);

  const handleRun = async () => {
    if (!outsideImgTransformed || !insideImgTransformed || !template) {
      alert('Please upload both images and select a template.');
      return;
    }
    setLoading(true);
    const dict = await runMappingJS(outsideImgTransformed, insideImgTransformed, template);
    setResults(dict);
    setLoading(false);
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const imageIds = ['output_page1', 'output_page2'];
    const fetchImageAsBlob = async (dataUrl: string) => {
      // Convert dataURL to Blob
      const res = await fetch(dataUrl);
      return await res.blob();
    };
    for (const id of imageIds) {
      const url = results[id];
      if (url) {
        const blob = await fetchImageAsBlob(url);
        zip.file(id + '.png', blob);
      }
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'origami_mapper_results.zip');
  };

  return (
    <>
      <div className="App">
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
        <div className="reference-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '2em', marginBottom: '2em' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', marginBottom: '0.5em' }}>Outside Reference</div>
            <img src="/origami-mapper/assets/box_outside_mapping.png" width={120} />
          </div>
          <div style={{ flex: '0 1 400px' }}>
            <section className="upload-card" style={{ background: '#181818', borderRadius: '12px', padding: '1.5em', paddingTop: '0.1em', margin: '1.5em auto', maxWidth: '400px', boxShadow: '0 2px 12px #0006' }}>
              <h2 style={{ color: '#fff', fontSize: '1.3em', marginBottom: '1em' }}>Upload Images</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
                <ImageUpload label="Upload Outside Image" onImage={setOutsideImg} />
                <ImageUpload label="Upload Inside Image" onImage={setInsideImg} />
              </div>
            </section>
            <section className="template-run-card" style={{ background: '#181818', borderRadius: '12px', padding: '1em', margin: '0 auto', maxWidth: '400px', boxShadow: '0 2px 12px #0006', display: 'flex', flexDirection: 'column', gap: '1em', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1em', width: '100%', justifyContent: 'center' }}>
                <span style={{ color: '#fff' }}></span>
                <TemplateSelect onTemplate={setTemplate} />
                <span style={{ color: '#fff' }}>Transform:</span>
                <select value={transformMode} onChange={e => setTransformMode(e.target.value as any)} style={{ padding: '0.3em', borderRadius: '6px', minWidth: '90px' }}>
                  <option value="none">None</option>
                  <option value="scale">Scale</option>
                  <option value="tile">Tile (Fill A4)</option>
                  <option value="tile4">Tile 4x (2x2)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1em', justifyContent: 'center' }}>
                <button onClick={handleRun} disabled={loading} className="menu-btn">
                  {loading ? 'Processing...' : 'Run Mapping'}
                </button>
                <button onClick={() => handleDownloadAll()} disabled={!results.output_page1} className="menu-btn">
                  Download All Results
                </button>
              </div>
            </section>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', marginBottom: '0.5em' }}>Inside Reference</div>
            <img src="/origami-mapper/assets/box_inside_mapping.png" width={120} />
          </div>
        </div>
        <div className="images" style={{ display: 'flex', flexWrap: 'wrap', gap: '1em', justifyContent: 'center' }}>
          {/* Outside PolygonEditor: shows outsideImgTransformed and output polygons (id does not contain 'i') */}
          <PolygonEditor
            data={{
              ...boxData,
              input_polygons: (boxData.input_polygons ?? [])
                .filter(p => !p.id.includes('i'))
                .map(p => ({
                  ...p,
                  vertices: (p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2)
                })),
              backgroundImg: outsideImgTransformed
            }}
          />
          {/* Inside PolygonEditor: shows insideImgTransformed and input polygons (id contains 'i') */}
          <PolygonEditor
            data={{
              ...boxData,
              input_polygons: (boxData.input_polygons ?? [])
                .filter(p => p.id.includes('i'))
                .map(p => ({
                  ...p,
                  vertices: (p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2)
                })),
              backgroundImg: insideImgTransformed
            }}
          />
        </div>
      </div>
      <footer style={{ color: '#bbb', textAlign: 'center', padding: '1.5em 0', marginTop: '1em', fontSize: '1em' }}>
        <div>
          <br />
          <a href="https://github.com/danielroth1/OrigamiMapper" target="_blank" rel="noopener noreferrer" style={{ color: '#bbb', fontSize: '0.9em', textDecoration: 'underline', margin: '0 0.5em' }}>GitHub</a>
          |
          <a href="https://blog.mailbase.info" target="_blank" rel="noopener noreferrer" style={{ color: '#bbb', fontSize: '0.9em', textDecoration: 'underline', margin: '0 0.5em' }}>Blog</a>
          |
          <a href="https://blog.mailbase.info/datenschutz/" target="_blank" rel="noopener noreferrer" style={{ color: '#bbb', fontSize: '0.9em', textDecoration: 'underline', margin: '0 0.5em' }}>Datenschutz</a>
        </div>
      </footer>
    </>
  );
}

export default App
