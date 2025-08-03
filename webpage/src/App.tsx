import { useState } from 'react';
import './App.css';
import ImageUpload from './components/ImageUpload';
import ImagePreview from './components/ImagePreview';
import TemplateSelect from './components/TemplateSelect';
import { runMappingJS } from './OrigamiMapperJS';

function App() {
  const [outsideImg, setOutsideImg] = useState('');
  const [insideImg, setInsideImg] = useState('');
  const [template, setTemplate] = useState('');
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

  const handleDownloadAll = () => {
    ['output_page1', 'output_page2', 'output_outside_mapping', 'output_inside_mapping'].forEach(id => {
      const url = results[id];
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = id + '.png';
        link.click();
      }
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="menu-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2em' }}>
          <div className="menu-right" style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
            <button className="menu-btn" style={{ minWidth: '100px' }} disabled>The Cube Project</button>
            <button style={{ minWidth: '100px' }}>Box Builder</button>
          </div>
        <img src="/assets/logo.jpeg" className="App-logo" alt="logo" style={{ width: '350px', height: 'auto' }} />
        <div className="menu-left" style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
            <button style={{ minWidth: '100px' }}>Proxy Generator</button>
            <button style={{ minWidth: '100px' }}>FAQ</button>
          </div>
        </div>
        <ImageUpload label="Upload Outside Image: " onImage={setOutsideImg} />
        <ImageUpload label="Upload Inside Image: " onImage={setInsideImg} />
        <div>To fit your image to your box, you may use the following A4 sheets as reference.</div>
        <div className="images" style={{ display: 'flex', gap: '2em', justifyContent: 'center' }}>
          <div>
            outside:<br/>
            <img src="/assets/box_outside_mapping.png" width={300} />
          </div>
          <div>
            inside:<br/>
            <img src="/assets/box_inside_mapping.png" width={300} />
          </div>
        </div>
        <TemplateSelect onTemplate={setTemplate} />
        <div>
          <button onClick={handleRun} disabled={loading}>
            {loading ? 'Processing...' : 'Run Mapping'}
          </button>
          <button onClick={handleDownloadAll} disabled={!results.output_page1}>
            Download All Results
          </button>
        </div>
        <div className="images">
          <ImagePreview src={outsideImg} label="Outside Input" />
          <ImagePreview src={insideImg} label="Inside Input" />
          <ImagePreview src={results.output_page1} label="Output Page 1" />
          <ImagePreview src={results.output_page2} label="Output Page 2" />
          <ImagePreview src={results.output_outside_mapping} label="Outside Mapping" />
          <ImagePreview src={results.output_inside_mapping} label="Inside Mapping" />
        </div>
      </header>
    </div>
  );
}

export default App
