import { useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './App.css';
import ImageUpload from './components/ImageUpload';
import ImagePreview from './components/ImagePreview';
import TemplateSelect from './components/TemplateSelect';
import { runMappingJS } from './OrigamiMapperJS';

function App() {
  const [outsideImg, setOutsideImg] = useState('');
  const [insideImg, setInsideImg] = useState('');
  const [template, setTemplate] = useState('Box');
  const [results, setResults] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    if (!outsideImg || !insideImg || !template) {
      alert('Please upload both images and select a template.');
      return;
    }
    setLoading(true);
    const dict = await runMappingJS(outsideImg, insideImg, template);
    setResults(dict);
    setLoading(false);
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const imageIds = ['output_page1', 'output_page2', 'output_outside_mapping', 'output_inside_mapping'];
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
              <button style={{ minWidth: '100px' }}>The Cube Project</button>
              <button style={{ minWidth: '100px' }} disabled>Box Builder</button>
            </div>
          <img src="/assets/logo.jpeg" className="App-logo" alt="logo" style={{ width: '380px', height: 'auto' }} />
          <div className="menu-left" style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
              <button style={{ minWidth: '100px' }}>Proxy Generator</button>
              <button style={{ minWidth: '100px' }}>FAQ</button>
            </div>
          </div>
        </header>
        <div className="reference-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '2em', marginBottom: '2em' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', marginBottom: '0.5em' }}>Outside Reference</div>
            <img src="/assets/box_outside_mapping.png" width={120} />
          </div>
          <div style={{ flex: '0 1 400px' }}>
            <section className="template-run-card" style={{ background: '#181818', borderRadius: '12px', padding: '1em', margin: '0 auto', maxWidth: '400px', boxShadow: '0 2px 12px #0006', display: 'flex', flexDirection: 'column', gap: '1em', alignItems: 'center' }}>
              <TemplateSelect onTemplate={setTemplate} />
              <div style={{ display: 'flex', gap: '1em', justifyContent: 'center' }}>
                <button onClick={handleRun} disabled={loading} className="menu-btn">
                  {loading ? 'Processing...' : 'Run Mapping'}
                </button>
                <button onClick={() => handleDownloadAll()} disabled={!results.output_page1} className="menu-btn">
                  Download All Results
                </button>
              </div>
            </section>
            <section className="upload-card" style={{ background: '#181818', borderRadius: '12px', padding: '1.5em', paddingTop: '0.1em', margin: '1.5em auto', maxWidth: '400px', boxShadow: '0 2px 12px #0006' }}>
              <h2 style={{ color: '#fff', fontSize: '1.3em', marginBottom: '1em' }}>Upload Images</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
                <ImageUpload label="Upload Outside Image" onImage={setOutsideImg} />
                <ImageUpload label="Upload Inside Image" onImage={setInsideImg} />
              </div>
            </section>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', marginBottom: '0.5em' }}>Inside Reference</div>
            <img src="/assets/box_inside_mapping.png" width={120} />
          </div>
        </div>
        <div className="images" style={{ display: 'flex', flexWrap: 'wrap', gap: '1em', justifyContent: 'center' }}>
          <ImagePreview src={outsideImg} label="Outside Input" />
          <ImagePreview src={insideImg} label="Inside Input" />
          <ImagePreview src={results.output_page1} label="Output Page 1" />
          <ImagePreview src={results.output_page2} label="Output Page 2" />
          <ImagePreview src={results.output_outside_mapping} label="Outside Mapping" />
          <ImagePreview src={results.output_inside_mapping} label="Inside Mapping" />
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
