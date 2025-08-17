import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import CubeViewer, { type FaceTextures } from "../components/CubeViewer";
import type { OrigamiMapperTypes } from '../OrigamiMapperTypes';
import ImageUpload from '../components/ImageUpload';
import ImagePreview from '../components/ImagePreview';
import TemplateSelect from '../components/TemplateSelect';
import { runMappingJS } from '../OrigamiMapperJS';
import { ImageTransform } from '../components/ImageTransform';
import PolygonEditor, { type PolygonEditorHandle } from '../components/PolygonEditor';
import boxData from '../../public/templates/box.json';
import Header from '../components/Header';
import '../App.css';


function BoxGenerator() {
  const [outsideImgRaw, setOutsideImgRaw] = useState('');
  const [insideImgRaw, setInsideImgRaw] = useState('');
  const [outsideImgTransformed, setOutsideImgTransformed] = useState('');
  const [insideImgTransformed, setInsideImgTransformed] = useState('');
  const [, setTemplate] = useState('Box');
  const [transformMode, setTransformMode] = useState<'none' | 'scale' | 'tile' | 'tile4' | 'tile8'>('none');
  const [results, setResults] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [outsideFaces, setOutsideFaces] = useState<FaceTextures>({});
  const [insideFaces, setInsideFaces] = useState<FaceTextures>({});
  // Change this constant in code to control the initial zoom programmatically
  const DEFAULT_VIEWER_ZOOM = 1.0;

  // Build face textures from polygons + background images
  const buildFaceTextures = (polygons: OrigamiMapperTypes.Polygon[], imgDataUrl: string): FaceTextures => {
    if (!imgDataUrl) return {};
    const img = new Image();
    img.src = imgDataUrl; // synchronous set; ensure loaded before drawing via onload guard below
    const faceGroups: Record<string, OrigamiMapperTypes.Polygon[]> = {};
  polygons.forEach((p: OrigamiMapperTypes.Polygon) => {
      const faceLetter = p.id[0];
      if (!'RLUVH'.includes(faceLetter)) return; // skip unrelated
      // Combine numbered sub-polygons (1,2,3) per face
      (faceGroups[faceLetter] = faceGroups[faceLetter] || []).push(p);
    });
    const out: FaceTextures = {};
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return {};
    // Helper to rasterize polygons of one face into tight bbox and return dataURL
    const renderFace = (polys: OrigamiMapperTypes.Polygon[]) => {
      if (!polys.length) return null;
      // Combine 2D rotation metadata plus any rotation_3d present (average if differing)
      let sumRot=0, countRot=0;
      polys.forEach(p=>{ if (typeof p.rotation === 'number') { sumRot += p.rotation; countRot++; } });
      const baseRot = countRot ? (sumRot / countRot) : 0;
      let sumRot3=0, countRot3=0;
      polys.forEach(p=>{ console.log(p); });
      polys.forEach(p=>{ if (typeof p.rotation_3d === 'number') { sumRot3 += p.rotation_3d; countRot3++; } });
      const rot3d = countRot3 ? (sumRot3 / countRot3) : 0;
      const groupRot = baseRot + rot3d;
      const invRot = -groupRot; // rotate canvas by inverse to align content
      // Compute centroid (pivot)
      let cx=0, cy=0, count=0;
      polys.forEach(p=>p.vertices.forEach(([x,y])=>{ cx += x*img.width; cy += y*img.height; count++; }));
      if (count>0) { cx/=count; cy/=count; }
      // Compute bounding box in rotated (inverse) space
      const cosI = Math.cos(invRot); const sinI = Math.sin(invRot);
      let rminX=Infinity,rminY=Infinity,rmaxX=-Infinity,rmaxY=-Infinity;
      polys.forEach(p=>p.vertices.forEach(([x,y])=>{
        const px = x*img.width; const py = y*img.height;
        const ox = px - cx; const oy = py - cy;
        const rx = ox*cosI - oy*sinI + cx;
        const ry = ox*sinI + oy*cosI + cy;
        if (rx<rminX) rminX=rx; if (ry<rminY) rminY=ry; if (rx>rmaxX) rmaxX=rx; if (ry>rmaxY) rmaxY=ry;
      }));
      if (rminX===Infinity) return null;
      const rw = Math.max(2, Math.ceil(rmaxX - rminX));
      const rh = Math.max(2, Math.ceil(rmaxY - rminY));
      canvas.width = rw; canvas.height = rh;
      ctx.save();
      // Transform so that rotated bounding box top-left becomes (0,0) and rotation undone
      ctx.translate(-rminX, -rminY);
      ctx.translate(cx, cy);
      ctx.rotate(invRot);
      ctx.translate(-cx, -cy);
      // Draw each polygon path, clip, draw image
      polys.forEach(p => {
        ctx.save();
        ctx.beginPath();
        p.vertices.forEach(([x,y],i)=>{
          const px = x*img.width; const py = y*img.height;
          if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        });
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      });
      ctx.restore();
      return canvas.toDataURL('image/png');
    };
    // Ensure image loaded; if not, we'll return empty and user can retry
    if (!img.complete) {
      img.onload = () => { /* user can press button again after load */ };
      return {};
    }
    Object.entries(faceGroups).forEach(([letter, polys]) => {
      const tex = renderFace(polys);
      if (tex) out[letter as keyof FaceTextures] = tex;
    });
    return out;
  };

  const handleBuildCubeTextures = () => {
    if (!outsideEditorRef.current || !insideEditorRef.current) return;
    const outsideJson = outsideEditorRef.current.getCurrentJson();
    const insideJson = insideEditorRef.current.getCurrentJson();
    setOutsideFaces(buildFaceTextures(outsideJson.input_polygons, outsideImgTransformed));
    setInsideFaces(buildFaceTextures(insideJson.input_polygons, insideImgTransformed));
  };

  // Refs for PolygonEditors
  const outsideEditorRef = useRef<PolygonEditorHandle>(null);
  const insideEditorRef = useRef<PolygonEditorHandle>(null);

  // Transform image according to selected mode
  const transformImage = (dataUrl: string, mode: 'none' | 'scale' | 'tile' | 'tile4' | 'tile8', callback: (result: string) => void) => {
    if (mode === 'none') {
      callback(dataUrl);
    } else if (mode === 'scale') {
      ImageTransform.scaleToA4Ratio(dataUrl, callback);
    } else if (mode === 'tile') {
      ImageTransform.tileToA4Ratio(dataUrl, callback);
    } else if (mode === 'tile4') {
      ImageTransform.tile4Times(dataUrl, callback);
    } else if (mode === 'tile8') {
      ImageTransform.tile8Times(dataUrl, callback);
    }
  };

  // Set and transform outside image
  const setOutsideImg = (dataUrl: string) => {
    setOutsideImgRaw(dataUrl);
    transformImage(dataUrl, transformMode, setOutsideImgTransformed);
  };
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
    if (!outsideImgTransformed || !insideImgTransformed) {
      alert('Please upload both images.');
      return;
    }
    if (!outsideEditorRef.current || !insideEditorRef.current) {
      alert('Polygon editors not ready.');
      return;
    }
    setLoading(true);
    // Get JSONs from both editors
    const outsideJson = outsideEditorRef.current.getCurrentJson();
    const insideJson = insideEditorRef.current.getCurrentJson();
    // Combine them: merge input_polygons and output_polygons, keep other fields from outsideJson
    const combinedJson = {
      ...outsideJson,
      input_polygons: [
        ...(outsideJson.input_polygons ?? []),
        ...(insideJson.input_polygons ?? [])
      ],
      output_polygons: [
        ...(outsideJson.output_polygons ?? []),
        ...(insideJson.output_polygons ?? [])
      ]
    };
    const dict = await runMappingJS(outsideImgTransformed, insideImgTransformed, JSON.stringify(combinedJson));
    setResults(dict);
    setLoading(false);
  };

  // Auto-load demo images if present (public/assets/examples/input.jpg & output.jpg)
  useEffect(() => {
  // Debug gate: only run when in dev mode or explicit VITE_DEBUG flag
  const isDebug = (import.meta as any).env?.DEV || (import.meta as any).env?.VITE_DEBUG === 'true';
  if (!isDebug) return; // skip in production unless flag set
    // Only attempt if neither image is already set (avoid overriding user uploads)
    if (outsideImgRaw || insideImgRaw) return;
    const base = (import.meta as any).env?.BASE_URL || '/'; // Vite base path (e.g., '/origami-mapper/')
    const outsideUrl = base + 'assets/examples/outside.jpg';
    const insideUrl = base + 'assets/examples/inside.jpg';

    const fetchAsDataUrlIfExists = async (url: string): Promise<string | null> => {
      try {
        const res = await fetch(url, { method: 'GET', cache: 'no-cache' });
        if (!res.ok || res.status >= 400) return null;
        const blob = await res.blob();
        if (blob.size === 0) return null;
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
      } catch (_) {
        return null;
      }
    };

    (async () => {
      const [inputDataUrl, outputDataUrl] = await Promise.all([
        fetchAsDataUrlIfExists(outsideUrl),
        fetchAsDataUrlIfExists(insideUrl)
      ]);
      if (inputDataUrl) setOutsideImg(inputDataUrl); // treat example input as outside image
      if (outputDataUrl) setInsideImg(outputDataUrl); // treat example output as inside image
    })();
  }, [outsideImgRaw, insideImgRaw]);

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const imageIds = ['output_page1', 'output_page2'];
    const instructionIds = ['output_outside_mapping', 'output_inside_mapping'];
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
    // Add mapping images to Instruction subfolder
    for (const id of instructionIds) {
      const url = results[id];
      if (url) {
        const blob = await fetchImageAsBlob(url);
        zip.file('Instruction/' + id + '.png', blob);
      }
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'origami_mapper_results.zip');
  };

  return (
    <>
      <div className="App">
        {/* Fixed header for all pages */}
        <Header />
        <div style={{ color: '#fff', margin: '2em auto 0 auto', fontSize: '1.1em', maxWidth: '600px', textAlign: 'center' }}>
          Build your own Card Deck Box! <br />
          This tool generates printable templates from your images. <br />
          Perfect for holding a standard deck of 60 cards.
        </div>
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
                  <option value="tile8">Tile 8x (4x2)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1em', justifyContent: 'center' }}>
                <button onClick={handleRun} disabled={loading} className="menu-btn">
                  {loading ? 'Processing...' : 'Run Mapping'}
                </button>
                <button onClick={handleBuildCubeTextures} disabled={!outsideImgTransformed || !insideImgTransformed} className="menu-btn">
                  Map To 3D Box
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
        <div className="images" style={{ display: 'flex', flexDirection: 'column', gap: '1em', alignItems: 'center', justifyContent: 'center' }}>
          {/* Editors side by side */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: '2em', justifyContent: 'center', alignItems: 'flex-start' }}>
            <PolygonEditor
              ref={outsideEditorRef}
              data={{
                ...boxData,
                offset: (Array.isArray(boxData.offset) ? boxData.offset.slice(0, 2) as [number, number] : [0, 0]),
                input_polygons: (boxData.input_polygons ?? [])
                  .filter(p => !p.id.includes('i'))
                  .map(p => ({
                    ...p,
                    vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
                  })),
                output_polygons: (boxData.output_polygons ?? [])
                  .map(p => ({
                    ...p,
                    vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
                  }))
              }}
              label='Outside image mapping'
              backgroundImg={outsideImgTransformed}
            />
            <PolygonEditor
              ref={insideEditorRef}
              data={{
                ...boxData,
                offset: (Array.isArray(boxData.offset) ? boxData.offset.slice(0, 2) as [number, number] : [0, 0]),
                input_polygons: (boxData.input_polygons ?? [])
                  .filter(p => p.id.includes('i'))
                  .map(p => ({
                    ...p,
                    vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
                  })),
                output_polygons: (boxData.output_polygons ?? [])
                  .map(p => ({
                    ...p,
                    vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
                  }))
              }}
              label='Inside image mapping'
              backgroundImg={insideImgTransformed}
            />
          </div>
          {/* Shared info text below both editors */}
          <div style={{ fontSize: '0.65em', color: '#aaa', margin: '0.5em auto 0 auto', lineHeight: 1.2, maxWidth: '400px', wordBreak: 'break-word', whiteSpace: 'pre-line', textAlign: 'center' }}>
            Drag to move (auto group).
            Shift+Drag scale.
            Ctrl/Cmd+Drag rotate.
            Drag empty area to marquee select.
          </div>
          <div style={{ width: 320, height: 260 }}>
            {/* framed boundary for the canvas */}
            <div style={{
              width: '100%',
              height: '100%',
              padding: 8,
              borderRadius: 10,
              background: '#0f0f10',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 4px 18px rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1 }}>
                  <CubeViewer outsideFaces={outsideFaces} insideFaces={insideFaces} initialZoom={DEFAULT_VIEWER_ZOOM} />
                </div>
              </div>
            </div>
          </div>
          {/* Output previews side by side */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: '2em', justifyContent: 'center', alignItems: 'flex-start', marginTop: '1em' }}>
            <ImagePreview src={results.output_page1} label="Output Page 1" />
            <ImagePreview src={results.output_page2} label="Output Page 2" />
          </div>
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

export default BoxGenerator;
