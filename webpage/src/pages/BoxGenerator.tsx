import { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { mirrorOutsidePolygons, mirrorInsidePolygons } from '../utils/polygons';
import { saveAs } from 'file-saver';
import CubeViewer, { type FaceTextures } from "../components/boxGenerator/CubeViewer";
import type { OrigamiMapperTypes } from '../OrigamiMapperTypes';
import ImagePreview from '../components/boxGenerator/ImagePreview';
import TemplateSelect from '../components/boxGenerator/TemplateSelect';
import { runMappingJS } from '../OrigamiMapperJS';
import { ImageTransform } from '../components/ImageTransform';
import PolygonEditor, { type PolygonEditorHandle } from '../components/boxGenerator/PolygonEditor';
import boxData from '../templates/box.json';
import Header from '../components/Header';
import '../App.css';
import { IoSave, IoCloudUpload, IoSwapHorizontal, IoCube, IoChevronUpCircle, IoChevronDownCircle } from 'react-icons/io5';

const SHOW_TEMPLATES = false;
const SHOW_TRANSFORMS = false;
const SHOW_OUTPUT_PAGES = false;

function BoxGenerator() {
  const [outsideImgTopRaw, setOutsideImgTopRaw] = useState('');
  const [insideImgTopRaw, setInsideImgTopRaw] = useState('');
  const [outsideImgBottomRaw, setOutsideImgBottomRaw] = useState('');
  const [insideImgBottomRaw, setInsideImgBottomRaw] = useState('');
  const [outsideImgTransformed, setOutsideImgTransformed] = useState('');
  const [insideImgTransformed, setInsideImgTransformed] = useState('');
  const [, setTemplate] = useState('Box');
  const [transformMode, setTransformMode] = useState<'none' | 'scale' | 'tile' | 'tile4' | 'tile8'>('none');
  const [results, setResults] = useState<{ [key: string]: string }>({});
  const [outputDpi, setOutputDpi] = useState<number>(300);
  const [scalePercent, setScalePercent] = useState(0); // percent (0..100+): amount to reduce the printed box on each side
  const [triangleOffsetPct, setTriangleOffsetPct] = useState(2); // percent (0..100): triangle growth offset relative to max(width,height)
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [withFoldLines, setWithFoldLines] = useState(true);
  const [withCutLines, setWithCutLines] = useState(true);
  // Bottom (existing) faces
  const [outsideFaces, setOutsideFaces] = useState<FaceTextures>({});
  const [insideFaces, setInsideFaces] = useState<FaceTextures>({});
  // Top faces
  const [topOutsideFaces, setTopOutsideFaces] = useState<FaceTextures>({});
  const [topInsideFaces, setTopInsideFaces] = useState<FaceTextures>({});
  // Which boxes exist
  const [hasBottomBox, setHasBottomBox] = useState<boolean>(true);
  const [hasTopBox, setHasTopBox] = useState<boolean>(false);
  // 3D open percentage and per-box scales (percent like global Scale slider)
  const [openPercent, setOpenPercent] = useState<number>(50);
  // Note: Preview ignores global scalePercent; PDF export applies scalePercent per page
  // Top-Bottom ratio slider: 0..100 where 50 is neutral (no override). Values <50 favor Top, >50 favor Bottom.
  const [topBottomRatio, setTopBottomRatio] = useState<number>(55);
  // Mirroring state: 'down' means bottom mirrors from top, 'up' means top mirrors from bottom
  const [, setMirrorDirection] = useState<'none' | 'down' | 'up'>('none');
  const [suppressAutoDemo, setSuppressAutoDemo] = useState(false);
  // Viewer selection: which boxes to show in 3D and which canvases to show on the left
  const [viewMode, setViewMode] = useState<'both' | 'top' | 'bottom'>('both');
  // Custom dropdown for view selector
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement | null>(null);
  // Measure viewer frame height to size vertical slider (rotated range input)
  const viewerFrameRef = useRef<HTMLDivElement | null>(null);
  const [viewerHeight, setViewerHeight] = useState<number>(0);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!viewMenuRef.current) return;
      if (!viewMenuOpen) return;
      if (!viewMenuRef.current.contains(e.target as Node)) setViewMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [viewMenuOpen]);
  useEffect(() => {
    const el = viewerFrameRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = 0.8 * (entry.contentRect?.height ?? el.clientHeight ?? 0);
        setViewerHeight(Math.max(0, Math.round(h)));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Canvas side filter: show only outside or only inside editors
  const [sideFilter, setSideFilter] = useState<'outside' | 'inside'>('outside');
  // Rotation selectors (0, 90, 180, 270 degrees) per image
  const [outsideRotation, setOutsideRotation] = useState<0 | 90 | 180 | 270>(0);
  const [insideRotation, setInsideRotation] = useState<0 | 90 | 180 | 270>(0);
  // Change this constant in code to control the initial zoom programmatically
  const DEFAULT_VIEWER_ZOOM = 1.0;
  // 1x1 transparent PNG used as placeholder when one image is missing for mapping
  // const BLANK_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

  // Build face textures from polygons + background images (async: waits for image load)
  const buildFaceTextures = async (polygons: OrigamiMapperTypes.Polygon[], imgDataUrl: string): Promise<FaceTextures> => {
    if (!imgDataUrl) return {};
    const img = new Image();
    img.src = imgDataUrl; // synchronous set
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
      let sumRot = 0, countRot = 0;
      polys.forEach(p => { if (typeof p.rotation === 'number') { sumRot += p.rotation; countRot++; } });
      const baseRot = countRot ? (sumRot / countRot) : 0;
      let sumRot3 = 0, countRot3 = 0;
      polys.forEach(p => { if (typeof p.rotation_3d === 'number') { sumRot3 += p.rotation_3d; countRot3++; } });
      const rot3d = countRot3 ? (sumRot3 / countRot3) : 0;
      const groupRot = baseRot + rot3d;
      const invRot = -groupRot; // rotate canvas by inverse to align content
      // Compute centroid (pivot)
      let cx = 0, cy = 0, count = 0;
      polys.forEach(p => p.vertices.forEach(([x, y]) => { cx += x * img.width; cy += y * img.height; count++; }));
      if (count > 0) { cx /= count; cy /= count; }
      // Compute bounding box in rotated (inverse) space
      const cosI = Math.cos(invRot); const sinI = Math.sin(invRot);
      let rminX = Infinity, rminY = Infinity, rmaxX = -Infinity, rmaxY = -Infinity;
      polys.forEach(p => p.vertices.forEach(([x, y]) => {
        const px = x * img.width; const py = y * img.height;
        const ox = px - cx; const oy = py - cy;
        const rx = ox * cosI - oy * sinI + cx;
        const ry = ox * sinI + oy * cosI + cy;
        if (rx < rminX) rminX = rx; if (ry < rminY) rminY = ry; if (rx > rmaxX) rmaxX = rx; if (ry > rmaxY) rmaxY = ry;
      }));
      if (rminX === Infinity) return null;
      const rw = Math.max(2, Math.ceil(rmaxX - rminX));
      const rh = Math.max(2, Math.ceil(rmaxY - rminY));
      canvas.width = rw; canvas.height = rh;
      ctx.save();
      // Transform so that rotated bounding box top-left becomes (0,0) and rotation undone
      ctx.translate(-rminX, -rminY);
      ctx.translate(cx, cy);
      ctx.rotate(invRot);
      ctx.translate(-cx, -cy);
      // disable smoothing to keep pixel-exact tiling
      ctx.imageSmoothingEnabled = false;
      // Draw each polygon path, clip, draw image
      polys.forEach(p => {
        ctx.save();
        ctx.beginPath();
        p.vertices.forEach(([x, y], i) => {
          const px = x * img.width; const py = y * img.height;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.clip();
        // Tile the source image across the polygon's bounding box so texture repeats when polygons
        // reference coordinates outside the 0..1 range.
        try {
          const startX = Math.floor(rminX / img.width) * img.width;
          const startY = Math.floor(rminY / img.height) * img.height;
          for (let tx = startX; tx <= rmaxX; tx += img.width) {
            for (let ty = startY; ty <= rmaxY; ty += img.height) {
              // Determine tile indices relative to start
              const ix = Math.round((tx - 0) / img.width);
              const iy = Math.round((ty - 0) / img.height);
              const flipH = (ix % 2) !== 0; // flip horizontally on odd columns
              const flipV = (iy % 2) !== 0; // flip vertically on odd rows
              ctx.save();
              try {
                // Move to tile origin. Draw with a 1px overlap to avoid seam gaps caused by clipping/rounding.
                const drawX = tx;
                const drawY = ty;
                if (flipH || flipV) {
                  const transX = drawX + (flipH ? img.width : 0);
                  const transY = drawY + (flipV ? img.height : 0);
                  ctx.translate(transX, transY);
                  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
                  ctx.drawImage(img, 0, 0);
                } else {
                  ctx.drawImage(img, drawX, drawY);
                }
              } catch (err) {
                // fallback to simple draw without overlap
                try { ctx.drawImage(img, tx, ty); } catch { }
              }
              ctx.restore();
            }
          }
        } catch (err) {
          // Fallback: draw single image at origin
          try { ctx.drawImage(img, 0, 0); } catch { }
        }
        ctx.restore();
      });
      ctx.restore();
      return canvas.toDataURL('image/png');
    };
    // Wait for image to load if necessary
    if (!img.complete) {
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // resolve on error too to avoid hanging; will just produce empty textures
      });
    }
    Object.entries(faceGroups).forEach(([letter, polys]) => {
      const tex = renderFace(polys);
      if (tex) out[letter as keyof FaceTextures] = tex;
    });
    return out;
  };

  // Rotate a data URL by given degrees and return a new data URL
  const rotateDataUrlDegrees = (dataUrl: string, degrees: 0 | 90 | 180 | 270): Promise<string> =>
    new Promise((resolve) => {
      if (!dataUrl || degrees % 360 === 0) return resolve(dataUrl);
      ImageTransform.rotateDegrees(dataUrl, degrees, (res: string) => resolve(res));
    });

  // Removed: combined build in favor of side-specific builders

  // Build-only-bottom helper
  const handleBuildBottomTextures = (
    outsidePolys?: OrigamiMapperTypes.Polygon[],
    insidePolys?: OrigamiMapperTypes.Polygon[]
  ) => {
    const outPolys = outsidePolys
      ?? outsideEditorRef.current?.getCurrentJson().input_polygons
      ?? getEditorData(false).input_polygons;
    const inPolys = insidePolys
      ?? insideEditorRef.current?.getCurrentJson().input_polygons
      ?? getEditorData(true).input_polygons;
    buildFaceTextures(outPolys, outsideImgTransformed).then(tex => setOutsideFaces(tex));
    buildFaceTextures(inPolys, insideImgTransformed).then(tex => setInsideFaces(tex));
  };

  // Build-only-top helper
  const handleBuildTopTextures = (
    outsidePolys?: OrigamiMapperTypes.Polygon[],
    insidePolys?: OrigamiMapperTypes.Polygon[]
  ) => {
    const topOutPolys = topOutsideEditorRef.current?.getCurrentJson().input_polygons
      ?? getTopEditorData(false).input_polygons;
    const topInPolys = topInsideEditorRef.current?.getCurrentJson().input_polygons
      ?? getTopEditorData(true).input_polygons;
    if (hasTopBox) {
      buildFaceTextures(outsidePolys ?? topOutPolys, topOutsideImgTransformed).then(tex => setTopOutsideFaces(tex));
      buildFaceTextures(insidePolys ?? topInPolys, topInsideImgTransformed).then(tex => setTopInsideFaces(tex));
    } else {
      setTopOutsideFaces({});
      setTopInsideFaces({});
    }
  };

  // Refs for PolygonEditors
  const outsideEditorRef = useRef<PolygonEditorHandle>(null);
  const insideEditorRef = useRef<PolygonEditorHandle>(null);
  const topOutsideEditorRef = useRef<PolygonEditorHandle>(null);
  const topInsideEditorRef = useRef<PolygonEditorHandle>(null);

  const getEditorData = (isInside: boolean) => ({
    ...boxData,
    offset: (Array.isArray(boxData.offset) ? (boxData.offset.slice(0, 2) as [number, number]) : ([0, 0] as [number, number])),
    input_polygons: (boxData.input_polygons ?? []).filter(p => isInside ? p.id.includes('i') : !p.id.includes('i')).map(p => ({
      ...p,
      vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
    })),
    output_polygons: (boxData.output_polygons ?? []).map(p => ({
      ...p,
      vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
    }))
  });

  // Separate helpers for top box use same template but can diverge later
  const getTopEditorData = (isInside: boolean) => ({
    ...boxData,
    offset: (Array.isArray(boxData.offset) ? (boxData.offset.slice(0, 2) as [number, number]) : ([0, 0] as [number, number])),
    input_polygons: (boxData.input_polygons ?? []).filter(p => isInside ? p.id.includes('i') : !p.id.includes('i')).map(p => ({
      ...p,
      vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
    })),
    output_polygons: (boxData.output_polygons ?? []).map(p => ({
      ...p,
      vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
    }))
  });

  // Transform image according to selected mode
  const transformImage = (
    dataUrl: string,
    mode: 'none' | 'scale' | 'tile' | 'tile4' | 'tile8',
    rotation: 0 | 90 | 180 | 270,
    callback: (result: string) => void
  ) => {
    // First rotate (if needed), then apply tiling/scaling mode
    const afterRotate = (rotated: string) => {
      if (mode === 'none') {
        callback(rotated);
      } else if (mode === 'scale') {
        ImageTransform.scaleToA4Ratio(rotated, callback);
      } else if (mode === 'tile') {
        ImageTransform.tileToA4Ratio(rotated, callback);
      } else if (mode === 'tile4') {
        ImageTransform.tile4Times(rotated, callback);
      } else if (mode === 'tile8') {
        ImageTransform.tile8Times(rotated, callback);
      }
    };
    ImageTransform.rotateDegrees(dataUrl, rotation, afterRotate);
  };

  // Debounced auto-build when polygon editors or images change. PolygonEditor will call onChange with new JSON.
  const bottomBuildDebounceRef = useRef<number | null>(null);
  const topBuildDebounceRef = useRef<number | null>(null);
  const scheduleBuildBottom = (
    outsidePolys?: OrigamiMapperTypes.Polygon[],
    insidePolys?: OrigamiMapperTypes.Polygon[]
  ) => {
    if (bottomBuildDebounceRef.current) window.clearTimeout(bottomBuildDebounceRef.current);
    bottomBuildDebounceRef.current = window.setTimeout(() => {
      handleBuildBottomTextures(outsidePolys, insidePolys);
      bottomBuildDebounceRef.current = null;
    }, 120);
  };
  const scheduleBuildTop = (
    outsidePolys?: OrigamiMapperTypes.Polygon[],
    insidePolys?: OrigamiMapperTypes.Polygon[]
  ) => {
    if (topBuildDebounceRef.current) window.clearTimeout(topBuildDebounceRef.current);
    topBuildDebounceRef.current = window.setTimeout(() => {
      handleBuildTopTextures(outsidePolys, insidePolys);
      topBuildDebounceRef.current = null;
    }, 120);
  };

  // Set and transform outside image
  const setOutsideImg = (dataUrl: string, top: boolean) => {
    if (top) {
      // Top: write to top raw and build top-transformed using top rotation/state
      setOutsideImgTopRaw(dataUrl);
      transformImage(dataUrl, transformMode, topOutsideRotation, setTopOutsideImgTransformed);
    } else {
      // Bottom: write to bottom raw and bottom-transformed using bottom rotation/state
      setOutsideImgBottomRaw(dataUrl);
      transformImage(dataUrl, transformMode, outsideRotation, setOutsideImgTransformed);
    }
  };
  const setInsideImg = (dataUrl: string, top: boolean) => {
    if (top) {
      // Top: write to top raw and build top-transformed using top rotation/state
      setInsideImgTopRaw(dataUrl);
      transformImage(dataUrl, transformMode, topInsideRotation, setTopInsideImgTransformed);
    } else {
      // Bottom: write to bottom raw and bottom-transformed using bottom rotation/state
      setInsideImgBottomRaw(dataUrl);
      transformImage(dataUrl, transformMode, insideRotation, setInsideImgTransformed);
    }
  };
  // Top image transforms
  const [topOutsideImgRaw, setTopOutsideImgRaw] = useState('');
  const [topInsideImgRaw, setTopInsideImgRaw] = useState('');
  const [topOutsideImgTransformed, setTopOutsideImgTransformed] = useState('');
  const [topInsideImgTransformed, setTopInsideImgTransformed] = useState('');
  const [topOutsideRotation, setTopOutsideRotation] = useState<0 | 90 | 180 | 270>(0);
  const [topInsideRotation, setTopInsideRotation] = useState<0 | 90 | 180 | 270>(0);
  const setTopOutsideImg = (dataUrl: string) => {
    setTopOutsideImgRaw(dataUrl);
    // Keep autosave-compatible mirror in legacy top raw as well
    setOutsideImgTopRaw(dataUrl);
    transformImage(dataUrl, transformMode, topOutsideRotation, setTopOutsideImgTransformed);
  };
  const setTopInsideImg = (dataUrl: string) => {
    setTopInsideImgRaw(dataUrl);
    // Keep autosave-compatible mirror in legacy top raw as well
    setInsideImgTopRaw(dataUrl);
    transformImage(dataUrl, transformMode, topInsideRotation, setTopInsideImgTransformed);
  };

  // Re-transform images when mode or raw/top-raw changes
  useEffect(() => {
    if (outsideImgBottomRaw) transformImage(outsideImgBottomRaw, transformMode, outsideRotation, setOutsideImgTransformed);
    if (insideImgBottomRaw) transformImage(insideImgBottomRaw, transformMode, insideRotation, setInsideImgTransformed);
    if (topOutsideImgRaw) transformImage(topOutsideImgRaw, transformMode, topOutsideRotation, setTopOutsideImgTransformed);
    if (topInsideImgRaw) transformImage(topInsideImgRaw, transformMode, topInsideRotation, setTopInsideImgTransformed);
  }, [transformMode, outsideRotation, insideRotation, outsideImgBottomRaw, insideImgBottomRaw, topOutsideImgRaw, topInsideImgRaw, topOutsideRotation, topInsideRotation]);

  // Rebuild cube textures when transformed images change (debounced)
  useEffect(() => {
    scheduleBuildBottom();
  }, [outsideImgTransformed, insideImgTransformed]);
  useEffect(() => {
    scheduleBuildTop();
  }, [topOutsideImgTransformed, topInsideImgTransformed, hasTopBox]);


  const handleRun = async (showProgress = false) => {
    setLoading(true);
    if (showProgress) {
      // show the shared progress bar while mapping runs
      setPdfLoading(true);
      setPdfProgress(5);
      // yield so progress UI shows before heavy mapping work
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    // Helper to produce default json from boxData for missing side
    const makeDefaultForSide = (isInside: boolean) => ({
      ...boxData,
      offset: (Array.isArray(boxData.offset) ? boxData.offset.slice(0, 2) as [number, number] : [0, 0]),
      input_polygons: (boxData.input_polygons ?? [])
        .filter(p => isInside ? p.id.includes('i') : !p.id.includes('i'))
        .map(p => ({
          ...p,
          vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
        })),
      output_polygons: (boxData.output_polygons ?? [])
        .map(p => ({
          ...p,
          vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
        }))
    });

    // Get JSONs from mounted editors or defaults when editor is not present (BOTTOM ONLY for preview)
    const outsideJson = outsideEditorRef.current ? outsideEditorRef.current.getCurrentJson() : makeDefaultForSide(false);
    const insideJson = insideEditorRef.current ? insideEditorRef.current.getCurrentJson() : makeDefaultForSide(true);
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
    // indicate mapping has started
    if (showProgress) setPdfProgress(20);
    let dict;
    let mappingSucceeded = false;
    try {
      // If one side is missing, pass a white canvas image as replacement (do not show on canvas).
      const makeWhiteDataUrl = () => {
        const c = document.createElement('canvas');
        c.width = 800; c.height = 600;
        const cx = c.getContext('2d');
        if (cx) { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, c.width, c.height); }
        return c.toDataURL('image/png');
      };
      const leftImg = outsideImgTransformed || makeWhiteDataUrl();
      const rightImg = insideImgTransformed || makeWhiteDataUrl();
      dict = await runMappingJS(leftImg, rightImg, JSON.stringify(combinedJson), outputDpi, Math.max(0, (triangleOffsetPct || 0) / 100));
      // mapping done
      if (showProgress) {
        // mapping progress stays within 0..50 so PDF generation can continue from 50..100
        setPdfProgress(40);
        // give UI a moment
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      setResults(dict);
      if (showProgress) {
        // near-complete for mapping, leave at 50 for PDF stage
        setPdfProgress(50);
        // small delay so users can see near-final progress
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      mappingSucceeded = true;
    } finally {
      setLoading(false);
      // If mapping was started for the purpose of a combined run+download and it succeeded,
      // keep the shared PDF progress UI active so the subsequent PDF generation continues
      // the same progress bar. Only clear the progress UI on failure.
      if (showProgress && !mappingSucceeded) {
        setPdfLoading(false);
        setPdfProgress(0);
      }
    }
    return dict;
  };

  // Auto-load demo images if present (public/assets/examples/input.jpg & output.jpg)
  useEffect(() => {
    // Debug gate: only run when in dev mode or explicit VITE_DEBUG flag
    const isDebug = (import.meta as any).env?.DEV || (import.meta as any).env?.VITE_DEBUG === 'true';
    if (!isDebug) return; // skip in production unless flag set
    if (suppressAutoDemo) return; // user explicitly deleted images; don't auto-reload them
    // Only attempt if neither image is already set (avoid overriding user uploads)
    if ((outsideImgTopRaw && insideImgTopRaw) && (outsideImgBottomRaw && insideImgBottomRaw) && (topOutsideImgRaw && topInsideImgRaw)) return;
    const base = (import.meta as any).env?.BASE_URL || '/'; // Vite base path (e.g., '/origami-mapper/')
    const outsideUrlTop = base + 'assets/examples/example_outside_top.png';
    // Note: if top/bottom variants for inside don't exist, these fetches will simply return null
    const insideUrlTop = base + 'assets/examples/example_inside_top.png';
    const outsideUrlBottom = base + 'assets/examples/example_outside_bottom.png';
    const insideUrlBottom = base + 'assets/examples/example_inside_bottom.png';

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
      const [outputDataTopUrl, inputDataTopUrl, outputDataBottomUrl, inputDataBottomUrl] = await Promise.all([
        fetchAsDataUrlIfExists(outsideUrlTop),
        fetchAsDataUrlIfExists(insideUrlTop),
        fetchAsDataUrlIfExists(outsideUrlBottom),
        fetchAsDataUrlIfExists(insideUrlBottom)
      ]);
      if (inputDataTopUrl) {
        setHasTopBox(true);
        // Use top-specific setter so transformed image is stored in top state
        setTopInsideImg(inputDataTopUrl);
      }
      if (outputDataTopUrl) {
        setHasTopBox(true);
        // Use top-specific setter so transformed image is stored in top state
        setTopOutsideImg(outputDataTopUrl);
      }
      if (inputDataBottomUrl) {
        setInsideImg(inputDataBottomUrl, false);
      }
      if (outputDataBottomUrl) {
        setOutsideImg(outputDataBottomUrl, false);
      }
    })();
  }, [outsideImgTopRaw, insideImgTopRaw, outsideImgBottomRaw, insideImgBottomRaw, topOutsideImgRaw, topInsideImgRaw]);

  // const ensureDataUrl = async (url: string): Promise<string> => {
  //   if (!url) throw new Error('No URL');
  //   if (url.startsWith('data:')) return url;
  //   const res = await fetch(url);
  //   const blob = await res.blob();
  //   return await new Promise<string>((resolve, reject) => {
  //     const reader = new FileReader();
  //     reader.onloadend = () => resolve(reader.result as string);
  //     reader.onerror = reject;
  //     reader.readAsDataURL(blob);
  //   });
  // };

  // -------------------------
  // Autosave (IndexedDB) & .mapper file save/load helpers
  // -------------------------
  const DB_NAME = 'origami-mapper';
  const STORE_NAME = 'projects';
  const DB_VERSION = 1;

  const openDB = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const putItem = async (item: any) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const r = store.put(item);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  };

  const getItem = async (id: string) => {
    const db = await openDB();
    return new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const r = store.get(id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  };

  const dataUrlToBlob = async (dataUrl?: string | null) => {
    if (!dataUrl) return null;
    try {
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch {
      return null;
    }
  };

  const blobToDataUrl = (blob?: Blob | null) => new Promise<string | null>((resolve, reject) => {
    if (!blob) return resolve(null);
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Autosave current app state under id 'autosave'
  const saveAutosave = async () => {
    try {
      const outsideJson = outsideEditorRef.current ? outsideEditorRef.current.getCurrentJson() : null;
      const insideJson = insideEditorRef.current ? insideEditorRef.current.getCurrentJson() : null;
      const outsideTopBlob = await dataUrlToBlob(outsideImgTopRaw || null);
      const insideTopBlob = await dataUrlToBlob(insideImgTopRaw || null);
      const outsideBottomBlob = await dataUrlToBlob(outsideImgBottomRaw || null);
      const insideBottomBlob = await dataUrlToBlob(insideImgBottomRaw || null);
      const item = {
        id: 'autosave',
        updatedAt: Date.now(),
        outsideTopBlob,
        insideTopBlob,
        outsideBottomBlob,
        insideBottomBlob,
        outsideJson,
        insideJson,
        transformMode,
        scalePercent,
        triangleOffsetPct,
        outputDpi,
        withFoldLines,
        withCutLines
      };
      await putItem(item);
    } catch (err) {
      // non-fatal
      console.warn('Failed to autosave:', err);
    }
  };

  const loadAutosave = async () => {
    try {
      const rec = await getItem('autosave');
      if (!rec) return;
      // Prevent demo auto-load from racing with autosave restore
      setSuppressAutoDemo(true);
      const outDataTopUrl = await blobToDataUrl(rec.outsideTopBlob);
      const inDataTopUrl = await blobToDataUrl(rec.insideTopBlob);
      const outDataBottomUrl = await blobToDataUrl(rec.outsideBottomBlob);
      const inDataBottomUrl = await blobToDataUrl(rec.insideBottomBlob);
      // Set which boxes should exist based on available images
      const hasAnyBottom = Boolean(outDataBottomUrl || inDataBottomUrl);
      const hasAnyTop = Boolean(outDataTopUrl || inDataTopUrl);
      if (hasAnyBottom) setHasBottomBox(true);
      if (hasAnyTop) setHasTopBox(true);
      // Bottom images
      setOutsideImg(outDataBottomUrl ?? "", false);
      setInsideImg(inDataBottomUrl ?? "", false);
      // Top images: use top-specific setters so both raw and transformed top states are updated
      if (outDataTopUrl) setTopOutsideImg(outDataTopUrl);
      else { setTopOutsideImgRaw(""); setTopOutsideImgTransformed(""); }
      if (inDataTopUrl) setTopInsideImg(inDataTopUrl);
      else { setTopInsideImgRaw(""); setTopInsideImgTransformed(""); }
      if (rec.transformMode) setTransformMode(rec.transformMode);
      if (typeof rec.scalePercent === 'number') setScalePercent(rec.scalePercent);
      if (typeof rec.triangleOffsetPct === 'number') setTriangleOffsetPct(rec.triangleOffsetPct);
      if (typeof rec.outputDpi === 'number') setOutputDpi(rec.outputDpi);
      if (typeof rec.withFoldLines === 'boolean') setWithFoldLines(rec.withFoldLines);
      if (typeof rec.withCutLines === 'boolean') setWithCutLines(rec.withCutLines);
      // restore editor JSONs if editors are mounted later; use a small timeout to allow refs to attach
      try { if (rec.outsideJson && outsideEditorRef.current) outsideEditorRef.current.setFromJson(rec.outsideJson); } catch (e) { }
      try { if (rec.insideJson && insideEditorRef.current) insideEditorRef.current.setFromJson(rec.insideJson); } catch (e) { }
    } catch (err) {
      console.warn('Failed to load autosave:', err);
    }
  };

  // Save to .mapper (zip) file
  const saveToMapperFile = async () => {
    try {
      // Build combined JSON like handleRun does
      const outsideJson = outsideEditorRef.current ? outsideEditorRef.current.getCurrentJson() : boxData;
      const insideJson = insideEditorRef.current ? insideEditorRef.current.getCurrentJson() : boxData;
      const combinedJson = {
        ...outsideJson,
        input_polygons: [...(outsideJson.input_polygons ?? []), ...(insideJson.input_polygons ?? [])],
        output_polygons: [...(outsideJson.output_polygons ?? []), ...(insideJson.output_polygons ?? [])]
      };

      const zip = new JSZip();
      zip.file('box.json', JSON.stringify(combinedJson, null, 2));
      // add raw images if present
      if (outsideImgTopRaw) {
        const outBlob = await dataUrlToBlob(outsideImgTopRaw);
        if (outBlob) zip.file('outside_top.png', outBlob);
      }
      if (insideImgTopRaw) {
        const inBlob = await dataUrlToBlob(insideImgTopRaw);
        if (inBlob) zip.file('inside_top.png', inBlob);
      }
      if (outsideImgBottomRaw) {
        const outBlob = await dataUrlToBlob(outsideImgBottomRaw);
        if (outBlob) zip.file('outside_bottom.png', outBlob);
      }
      if (insideImgBottomRaw) {
        const inBlob = await dataUrlToBlob(insideImgBottomRaw);
        if (inBlob) zip.file('inside_bottom.png', inBlob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'origami_project.mapper');
    } catch (err) {
      console.error('Failed to save .mapper file:', err);
      alert('Failed to save project file: ' + String(err));
    }
  };

  // Hidden file input ref for loading .mapper files
  const mapperInputRef = useRef<HTMLInputElement | null>(null);

  const onMapperFileSelected = async (file: File | null) => {
    if (!file) return;
    try {
      const ab = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(ab);
      // read box.json
      if (zip.file('box.json')) {
        const txt = await zip.file('box.json')!.async('string');
        try {
          const parsed = JSON.parse(txt);
          // Split parsed JSON into outside/inside variants and set into respective editors
          const outsideParsed = {
            ...parsed,
            input_polygons: (parsed.input_polygons ?? []).filter((p: any) => !String(p.id).includes('i'))
          };
          const insideParsed = {
            ...parsed,
            input_polygons: (parsed.input_polygons ?? []).filter((p: any) => String(p.id).includes('i'))
          };
          try { if (outsideParsed && outsideEditorRef.current) outsideEditorRef.current.setFromJson(outsideParsed); } catch (e) { }
          try { if (insideParsed && insideEditorRef.current) insideEditorRef.current.setFromJson(insideParsed); } catch (e) { }
        } catch (e) { console.warn('box.json parse error', e); }
      }
      // images
      let dataUrl = "";
      if (zip.file('outside_top.png')) {
        const blob = await zip.file('outside_top.png')!.async('blob');
        dataUrl = await blobToDataUrl(blob) ?? "";
      }
      // Use top-specific setter
      setTopOutsideImg(dataUrl);
      dataUrl = "";
      if (zip.file('inside_top.png')) {
        const blob = await zip.file('inside_top.png')!.async('blob');
        dataUrl = await blobToDataUrl(blob) ?? "";
      }
      // Use top-specific setter
      setTopInsideImg(dataUrl);

      if (zip.file('outside_bottom.png')) {
        const blob = await zip.file('outside_bottom.png')!.async('blob');
        dataUrl = await blobToDataUrl(blob) ?? "";
      }
      setOutsideImg(dataUrl, false);
      dataUrl = "";
      if (zip.file('inside_bottom.png')) {
        const blob = await zip.file('inside_bottom.png')!.async('blob');
        dataUrl = await blobToDataUrl(blob) ?? "";
      }
      setInsideImg(dataUrl, false);
    } catch (err) {
      console.error('Failed to load .mapper file:', err);
      alert('Failed to load project file: ' + String(err));
    }
  };

  // Wire autosave: debounce changes
  const autosaveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => { void saveAutosave(); }, 600);
    return () => { if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outsideImgTopRaw, outsideImgBottomRaw, insideImgTopRaw, insideImgBottomRaw, transformMode, scalePercent, triangleOffsetPct, outputDpi, withFoldLines, withCutLines]);

  // Load autosave on mount
  useEffect(() => { void loadAutosave(); }, []);

  // Keep viewMode valid if boxes are created/deleted
  useEffect(() => {
    if (!hasTopBox && !hasBottomBox) {
      setViewMode('both'); // no boxes yet
      return;
    }
    if (!hasTopBox && viewMode === 'top') setViewMode('bottom');
    if (!hasBottomBox && viewMode === 'bottom') setViewMode('top');
  }, [hasTopBox, hasBottomBox, viewMode]);


  // Run mapping for a specific box (bottom or top)
  const runMappingForBox = async (which: 'bottom' | 'top') => {
    // Helper default json
    const makeDefaultForSide = (isInside: boolean) => ({
      ...boxData,
      offset: (Array.isArray(boxData.offset) ? boxData.offset.slice(0, 2) as [number, number] : [0, 0]),
      input_polygons: (boxData.input_polygons ?? [])
        .filter(p => isInside ? p.id.includes('i') : !p.id.includes('i'))
        .map(p => ({
          ...p,
          vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
        })),
      output_polygons: (boxData.output_polygons ?? [])
        .map(p => ({
          ...p,
          vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
        }))
    });

    const isTop = which === 'top';
    const outsideJson = (isTop ? topOutsideEditorRef.current : outsideEditorRef.current)?.getCurrentJson() || makeDefaultForSide(false);
    const insideJson = (isTop ? topInsideEditorRef.current : insideEditorRef.current)?.getCurrentJson() || makeDefaultForSide(true);
    const combinedJson = {
      ...outsideJson,
      input_polygons: [...(outsideJson.input_polygons ?? []), ...(insideJson.input_polygons ?? [])],
      output_polygons: [...(outsideJson.output_polygons ?? []), ...(insideJson.output_polygons ?? [])]
    };
    const makeWhiteDataUrl = () => {
      const c = document.createElement('canvas');
      c.width = 800; c.height = 600;
      const cx = c.getContext('2d');
      if (cx) { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, c.width, c.height); }
      return c.toDataURL('image/png');
    };
    const leftImg = (isTop ? topOutsideImgTransformed : outsideImgTransformed) || makeWhiteDataUrl();
    const rightImg = (isTop ? topInsideImgTransformed : insideImgTransformed) || makeWhiteDataUrl();
    return await runMappingJS(leftImg, rightImg, JSON.stringify(combinedJson), outputDpi, Math.max(0, (triangleOffsetPct || 0) / 100));
  };

  // Generate a PDF from an array of page images (all page1 or all page2)
  const generatePdfFromPages = async (
    pages: string[],
    pageKind: 1 | 2,
    fileName: string,
    pageScalePercents?: number[] // optional per-page scale overrides (0..100). If omitted, uses global scalePercent
  ) => {
    // A4 dimensions in mm
    const PAGE_W = 210;
    const PAGE_H = 297;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    for (let i = 0; i < pages.length; i++) {
      setPdfProgress(50 + Math.round((i / Math.max(1, pages.length)) * 40));
      await new Promise(resolve => setTimeout(resolve, 10));
      const perPageScale = Array.isArray(pageScalePercents) ? (pageScalePercents[i] ?? scalePercent) : scalePercent;
      const frac = Math.max(0, (perPageScale || 0) / 100);
      const innerW = PAGE_W * (1 - 2 * frac);
      const innerH = PAGE_H * (1 - 2 * frac);
      const x = (PAGE_W - innerW) / 2;
      const y = (PAGE_H - innerH) / 2;
      let dataUrl = pages[i];
      if (!dataUrl) {
        // blank
        const c = document.createElement('canvas');
        const pxW = Math.max(1, Math.round((innerW / 25.4) * 96));
        const pxH = Math.max(1, Math.round((innerH / 25.4) * 96));
        c.width = pxW; c.height = pxH;
        const cx = c.getContext('2d');
        if (cx) { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, pxW, pxH); }
        dataUrl = c.toDataURL('image/png');
      }
      doc.addImage(dataUrl, 'PNG', x, y, innerW, innerH, undefined, 'FAST');
      // helper lines per kind
      const base = (import.meta as any).env?.BASE_URL || '/';
      const helperPath = base + 'assets/lines_page' + pageKind + '.png';
      if (withFoldLines) {
        try {
          const resp = await fetch(helperPath);
          if (resp.ok) {
            const blob = await resp.blob();
            const reader = new FileReader();
            const helperDataUrl: string = await new Promise((resolve) => { reader.onloadend = () => resolve(reader.result as string); reader.readAsDataURL(blob); });
            // Rotate 180deg like before
            const imgEl = new Image();
            imgEl.src = helperDataUrl;
            await new Promise<void>((resolve) => { imgEl.onload = () => resolve(); imgEl.onerror = () => resolve(); });
            try {
              const cw = imgEl.naturalWidth || imgEl.width || 1;
              const ch = imgEl.naturalHeight || imgEl.height || 1;
              const c2 = document.createElement('canvas');
              c2.width = cw; c2.height = ch;
              const cx2 = c2.getContext('2d');
              if (cx2) {
                cx2.translate(cw / 2, ch / 2);
                cx2.rotate(Math.PI);
                cx2.globalAlpha = 1;
                cx2.drawImage(imgEl, -cw / 2, -ch / 2, cw, ch);
                const rotatedDataUrl = c2.toDataURL('image/png');
                doc.addImage(rotatedDataUrl, 'PNG', x, y, innerW, innerH, undefined, 'FAST');
              } else {
                doc.addImage(helperDataUrl, 'PNG', x, y, innerW, innerH, undefined, 'FAST');
              }
            } catch {
              doc.addImage(helperDataUrl, 'PNG', x, y, innerW, innerH, undefined, 'FAST');
            }
          }
        } catch { }
      }
      if (withCutLines) {
        try {
          const DPI = 96;
          const pxW = Math.max(1, Math.round((innerW / 25.4) * DPI));
          const pxH = Math.max(1, Math.round((innerH / 25.4) * DPI));
          const c3 = document.createElement('canvas');
          c3.width = pxW; c3.height = pxH;
          const cx3 = c3.getContext('2d');
          if (cx3) {
            cx3.clearRect(0, 0, pxW, pxH);
            cx3.strokeStyle = 'rgba(0,0,0,0.6)';
            cx3.lineWidth = 1; cx3.setLineDash([2, 2]);
            const inset = 0.5; cx3.strokeRect(inset, inset, pxW - 1, pxH - 1);
            const overlay = c3.toDataURL('image/png');
            doc.addImage(overlay, 'PNG', x, y, innerW, innerH, undefined, 'FAST');
          }
        } catch { }
      }
      if (i < pages.length - 1) doc.addPage();
    }
    doc.save(fileName);
  };

  // Run mapping for bottom/top and download two PDFs: outer (page1s) then inner (page2s)
  const handleRunThenDownloadDual = async () => {
    if (loading) return;
    setPdfLoading(true);
    setPdfProgress(5);
    setLoading(true);
    try {
      const runs: Array<Promise<{ [k: string]: string }>> = [];
      if (hasBottomBox) runs.push(runMappingForBox('bottom'));
      if (hasTopBox) runs.push(runMappingForBox('top'));
      const dicts = await Promise.all(runs);
      setPdfProgress(50);
      // Build page arrays
      const outerPages: string[] = [];
      const innerPages: string[] = [];
      const outerScales: number[] = [];
      const innerScales: number[] = [];

      const ratio = topBottomRatio; // 0..100
      const factors = (() => {
        if (ratio < 50) return { top: (50 - ratio) / 50, bottom: 0 };
        if (ratio > 50) return { top: 0, bottom: (ratio - 50) / 50 };
        return { top: 0, bottom: 0 };
      })();

      // Helper push with corresponding scale for which box it belongs to
      const pushPagesWithScale = (which: 'bottom' | 'top', d: { [k: string]: string } | undefined) => {
        if (!d) return;
        const factor = which === 'top' ? factors.top : factors.bottom;
        const eff = Math.max(0, Math.round((scalePercent || 0) * factor));
        if (d.output_page1) { outerPages.push(d.output_page1); outerScales.push(eff); }
        if (d.output_page2) { innerPages.push(d.output_page2); innerScales.push(eff); }
      };

      // Determine mapping from dict order to box which
      let idx = 0;
      if (hasBottomBox) { pushPagesWithScale('bottom', dicts[idx]); idx++; }
      if (hasTopBox) { pushPagesWithScale('top', dicts[idx]); idx++; }
      // Fallback: if no boxes, still allow blank pages (or just abort)
      if (outerPages.length === 0 && innerPages.length === 0) {
        setPdfLoading(false); setPdfProgress(0); setLoading(false); return;
      }
      // Generate PDFs sequentially
      await generatePdfFromPages(outerPages, 1, 'origami_boxes_outer.pdf', outerScales);
      setPdfProgress(70);
      await generatePdfFromPages(innerPages, 2, 'origami_boxes_inner.pdf', innerScales);
      setPdfProgress(100);
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDFs: ' + String((err as any)?.message || err));
    } finally {
      setLoading(false);
      setTimeout(() => { setPdfLoading(false); setPdfProgress(0); }, 600);
    }
  };

  const getCanvasHeight = () =>
  {
    return Math.max(100, Math.min(500, viewerHeight));
  }

  const getCanvasWidth = () =>
  {
    return getCanvasHeight() * 3 / 4;
  }

  // (Replaced by handleRunThenDownloadDual)

  return (
    <>
      <div className="App">
        {/* Fixed header for all pages */}
        <Header />
        <div style={{ color: '#fff', margin: '2em auto 2em auto', fontSize: '1.1em', maxWidth: '600px', textAlign: 'center' }}>
          Build your own Card Deck Box! <br />
          This tool generates printable templates from your images. <br />
          Perfect for holding a standard deck of 60 cards.
        </div>

        {/* 3D cube preview + 2D Editors (canvases on the left) */}
        <div className="images" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3.5em', alignItems: 'flex-start', justifyContent: 'center', width: '100%' }}>
          {/* Left column: Editors and controls */}
          <div ref={viewerFrameRef} style={{ display: 'flex', flexDirection: 'column', gap: '1em', alignItems: 'center', justifyContent: 'flex-start' }}>
            {/* Side filter toggle and create box buttons */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button
                className="menu-btn"
                onClick={() => setSideFilter(sideFilter === 'outside' ? 'inside' : 'outside')}
                title={sideFilter === 'outside' ? 'Show only Inside canvas' : 'Show only Outside canvas'}
                aria-label={sideFilter === 'outside' ? 'Show only Inside canvas' : 'Show only Outside canvas'}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '6px 0px' }}
              >
                <IoSwapHorizontal style={{ verticalAlign: 'middle' }} /> {sideFilter === 'outside' ? 'Outside' : 'Inside'}
              </button>
              <div style={{ display: 'flex', gap: '0.5em' }}>
                {!hasBottomBox && (
                  <button className="menu-btn" onClick={() => setHasBottomBox(true)}>Create Bottom Box</button>
                )}
                {!hasTopBox && (
                  <button className="menu-btn" onClick={() => setHasTopBox(true)}>Create Top Box</button>
                )}
              </div>
            </div>

            {/* Top box editors (only when visible by viewMode) */}
            {hasTopBox && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75em', alignItems: 'center' }} hidden={viewMode === 'bottom'}>
                <div hidden={sideFilter !== 'outside'}>
                  <PolygonEditor
                    ref={topOutsideEditorRef}
                    zoomGroup={'top'}
                    applyResetTransform={true}
                    onChange={() => scheduleBuildTop()}
                    onOutsave={() => { void saveAutosave(); }}
                    data={getTopEditorData(false)}
                    label='Top Outside image'
                    backgroundImg={topOutsideImgTransformed}
                    rotation={topOutsideRotation}
                    onRotationChange={(r) => { setTopOutsideRotation(r); transformImage(topOutsideImgRaw, transformMode, r, setTopOutsideImgTransformed); }}
                    onUploadImage={(dataUrl) => { setSuppressAutoDemo(true); setTopOutsideImg(dataUrl); }}
                    onDelete={() => {
                      if (!confirm('Clear top outside image? This cannot be undone.')) return;
                      setTopOutsideImgRaw(''); setTopOutsideImgTransformed(''); scheduleBuildTop(); setSuppressAutoDemo(true);
                    }}
                    onDeleteBox={() => {
                      if (!confirm('Delete Top Box? This cannot be undone.')) return;
                      setHasTopBox(false);
                    }}
                  />
                </div>
                <div hidden={sideFilter !== 'inside'}>
                  <PolygonEditor
                    ref={topInsideEditorRef}
                    zoomGroup={'top'}
                    applyResetTransform={true}
                    onChange={() => scheduleBuildTop()}
                    onOutsave={() => { void saveAutosave(); }}
                    data={getTopEditorData(true)}
                    label='Top Inside image'
                    backgroundImg={topInsideImgTransformed}
                    rotation={topInsideRotation}
                    onRotationChange={(r) => { setTopInsideRotation(r); transformImage(topInsideImgRaw, transformMode, r, setTopInsideImgTransformed); }}
                    onUploadImage={(dataUrl) => { setSuppressAutoDemo(true); setTopInsideImg(dataUrl); }}
                    onDelete={() => {
                      if (!confirm('Clear top inside image? This cannot be undone.')) return;
                      setTopInsideImgRaw(''); setTopInsideImgTransformed(''); scheduleBuildTop(); setSuppressAutoDemo(true);
                    }}
                    onDeleteBox={() => {
                      if (!confirm('Delete Top Box? This cannot be undone.')) return;
                      setHasTopBox(false);
                    }}
                  />
                </div>
                {/* per-box scale removed: replaced by global top-bottom ratio */}
              </div>
            )}

            {/* Mirror toggles between bottom and top */}
            {hasBottomBox && hasTopBox && (
              <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center', justifyContent: 'center' }}>
                <button onClick={async () => {
                  setMirrorDirection('down');
                  // Also copy TOP images down to BOTTOM
                  setSuppressAutoDemo(true);
                  // Mirror only the selected side
                  if (sideFilter === 'outside') {
                    // Pre-rotate raw outside image by rotation delta so bottom keeps its own rotation state
                    const deltaOut = (((topOutsideRotation - outsideRotation) % 360) + 360) % 360 as 0 | 90 | 180 | 270;
                    if (topOutsideImgRaw) {
                      const rotated = deltaOut ? await rotateDataUrlDegrees(topOutsideImgRaw, deltaOut) : topOutsideImgRaw;
                      setOutsideImgBottomRaw(rotated);
                    }
                    const srcOut = topOutsideEditorRef.current?.getCurrentJson().input_polygons ?? [];
                    if (outsideEditorRef.current) {
                      const target = outsideEditorRef.current.getCurrentJson().input_polygons;
                      outsideEditorRef.current.setFromJson({ ...getEditorData(false), input_polygons: mirrorOutsidePolygons(srcOut, target) });
                    }
                  } else if (sideFilter === 'inside') {
                    // Pre-rotate raw inside image by rotation delta so bottom keeps its own rotation state
                    const deltaIn = (((topInsideRotation - insideRotation) % 360) + 360) % 360 as 0 | 90 | 180 | 270;
                    if (topInsideImgRaw) {
                      const rotated = deltaIn ? await rotateDataUrlDegrees(topInsideImgRaw, deltaIn) : topInsideImgRaw;
                      setInsideImgBottomRaw(rotated);
                    }
                    const srcIn = topInsideEditorRef.current?.getCurrentJson().input_polygons ?? [];
                    if (insideEditorRef.current) {
                      const target = insideEditorRef.current.getCurrentJson().input_polygons;
                      insideEditorRef.current.setFromJson({ ...getEditorData(true), input_polygons: mirrorInsidePolygons(srcIn, target) });
                    }
                  }
                  // Build once after mirroring
                  scheduleBuildBottom();
                }} title="Bottom mirrors from Top">↓</button>
                <button onClick={async () => {
                  setMirrorDirection('up');
                  // Also copy BOTTOM images up to TOP
                  setSuppressAutoDemo(true);
                  // Mirror only the selected side
                  if (sideFilter === 'outside') {
                    // Pre-rotate raw outside image by rotation delta so top keeps its own rotation state
                    const deltaOut = (((outsideRotation - topOutsideRotation) % 360) + 360) % 360 as 0 | 90 | 180 | 270;
                    if (outsideImgBottomRaw) {
                      const rotated = deltaOut ? await rotateDataUrlDegrees(outsideImgBottomRaw, deltaOut) : outsideImgBottomRaw;
                      setTopOutsideImg(rotated);
                    }
                    const srcOut = outsideEditorRef.current?.getCurrentJson().input_polygons ?? [];
                    if (topOutsideEditorRef.current) {
                      const target = topOutsideEditorRef.current.getCurrentJson().input_polygons;
                      topOutsideEditorRef.current.setFromJson({ ...getTopEditorData(false), input_polygons: mirrorOutsidePolygons(srcOut, target) });
                    }
                  } else if (sideFilter === 'inside') {
                    // Pre-rotate raw inside image by rotation delta so top keeps its own rotation state
                    const deltaIn = (((insideRotation - topInsideRotation) % 360) + 360) % 360 as 0 | 90 | 180 | 270;
                    if (insideImgBottomRaw) {
                      const rotated = deltaIn ? await rotateDataUrlDegrees(insideImgBottomRaw, deltaIn) : insideImgBottomRaw;
                      setTopInsideImg(rotated);
                    }
                    const srcIn = insideEditorRef.current?.getCurrentJson().input_polygons ?? [];
                    if (topInsideEditorRef.current) {
                      const target = topInsideEditorRef.current.getCurrentJson().input_polygons;
                      topInsideEditorRef.current.setFromJson({ ...getTopEditorData(true), input_polygons: mirrorInsidePolygons(srcIn, target) });
                    }
                  }
                  // Build once after mirroring
                  scheduleBuildTop();
                }} title="Top mirrors from Bottom">↑</button>
              </div>
            )}

            {/* Bottom box editors (only when visible by viewMode) */}
            {hasBottomBox && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75em', alignItems: 'center' }} hidden={viewMode === 'top'}>
                <div hidden={sideFilter !== 'outside'}>
                  <PolygonEditor
                    ref={outsideEditorRef}
                    zoomGroup={'bottom'}
                    applyResetTransform={true}
                    onChange={json => scheduleBuildBottom(json.input_polygons, undefined)}
                    onOutsave={() => { void saveAutosave(); }}
                    data={getEditorData(false)}
                    label='Bottom Outside image'
                    backgroundImg={outsideImgTransformed}
                    rotation={outsideRotation}
                    onRotationChange={(r) => { setOutsideRotation(r); transformImage(outsideImgBottomRaw, transformMode, r, setOutsideImgTransformed); }}
                    onUploadImage={(dataUrl) => { setSuppressAutoDemo(true); setOutsideImg(dataUrl, false); }}
                    onDelete={() => {
                      if (!confirm('Clear bottom outside image? This cannot be undone.')) return;
                      setOutsideImgBottomRaw(''); setOutsideImgTransformed(''); scheduleBuildBottom([], undefined); setSuppressAutoDemo(true);
                    }}
                    onDeleteBox={() => {
                      if (!confirm('Delete Bottom Box (both canvases)? This cannot be undone.')) return;
                      setHasBottomBox(false);
                    }}
                  />
                </div>
                <div hidden={sideFilter !== 'inside'}>
                  <PolygonEditor
                    ref={insideEditorRef}
                    zoomGroup={'bottom'}
                    applyResetTransform={true}
                    onChange={json => scheduleBuildBottom(undefined, json.input_polygons)}
                    onOutsave={() => { void saveAutosave(); }}
                    data={getEditorData(true)}
                    label='Bottom Inside image'
                    backgroundImg={insideImgTransformed}
                    rotation={insideRotation}
                    onRotationChange={(r) => { setInsideRotation(r); transformImage(insideImgBottomRaw, transformMode, r, setInsideImgTransformed); }}
                    onUploadImage={(dataUrl) => { setSuppressAutoDemo(true); setInsideImg(dataUrl, false); }}
                    onDelete={() => {
                      if (!confirm('Clear bottom inside image? This cannot be undone.')) return;
                      setInsideImgBottomRaw(''); setInsideImgTransformed(''); scheduleBuildBottom(undefined, []); setSuppressAutoDemo(true);
                    }}
                    onDeleteBox={() => {
                      if (!confirm('Delete Bottom Box (both canvases)? This cannot be undone.')) return;
                      setHasBottomBox(false);
                    }}
                  />
                </div>
                {/* per-box scale removed: replaced by global top-bottom ratio */}
              </div>
            )}

            {/* Helper text */}
            <div style={{ fontSize: '0.65em', color: '#aaa', margin: '0.25em 0 0 0', lineHeight: 1.2, whiteSpace: 'normal', textAlign: 'center', display: 'inline-block', maxWidth: '40ch', overflowWrap: 'anywhere' }}>
              Drag to move (auto group).
              Shift+Drag scale.
              Ctrl/Cmd+Drag rotate.
              Drag empty area to marquee select.
            </div>
          </div>

          {/* Right column: Cube viewer with toolbar and open slider */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gridTemplateRows: 'auto auto', justifyContent: 'stretch', alignItems: 'stretch', gap: 12, flex: '1 1 0', minWidth: 300 }}>
            {/* Canvas frame */}
            <div style={{ gridColumn: 1, gridRow: 1, width: '100%', position: 'relative', aspectRatio: '3 / 4' }}>
              {/* Toolbar on top of canvas */}
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'start', gap: 8 }}>
                <div ref={viewMenuRef} style={{ position: 'relative' }}>
                  <button
                    className="menu-btn"
                    onClick={() => setViewMenuOpen(v => !v)}
                    disabled={!hasBottomBox && !hasTopBox}
                    aria-haspopup="listbox"
                    aria-expanded={viewMenuOpen}
                    title="Select which box to view"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 16px 6px 8px' }}
                  >
                    {viewMode === 'both' && <IoCube style={{ verticalAlign: 'middle' }} />}
                    {viewMode === 'top' && <IoChevronUpCircle style={{ verticalAlign: 'middle' }} />}
                    {viewMode === 'bottom' && <IoChevronDownCircle style={{ verticalAlign: 'middle' }} />}
                    <span>{viewMode === 'both' ? 'Both' : viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}</span>
                  </button>
                  {viewMenuOpen && (
                    <div role="listbox" aria-label="View Mode" style={{ position: 'absolute', top: '110%', left: 0, background: '#1b1b1b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, minWidth: 140, boxShadow: '0 6px 18px rgba(0,0,0,0.5)', zIndex: 20 }}>
                      <button
                        role="option"
                        aria-selected={viewMode === 'both'}
                        onClick={() => { if (hasBottomBox && hasTopBox) { setViewMode('both'); setViewMenuOpen(false); } }}
                        disabled={!(hasBottomBox && hasTopBox)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', width: '100%', background: 'transparent', color: '#fff', opacity: (hasBottomBox && hasTopBox) ? 1 : 0.5 }}
                        title="Show both boxes"
                      >
                        <IoCube /> Both
                      </button>
                      <button
                        role="option"
                        aria-selected={viewMode === 'top'}
                        onClick={() => { if (hasTopBox) { setViewMode('top'); setViewMenuOpen(false); } }}
                        disabled={!hasTopBox}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', width: '100%', background: 'transparent', color: '#fff', opacity: hasTopBox ? 1 : 0.5 }}
                        title="Show only the Top box"
                      >
                        <IoChevronUpCircle /> Top
                      </button>
                      <button
                        role="option"
                        aria-selected={viewMode === 'bottom'}
                        onClick={() => { if (hasBottomBox) { setViewMode('bottom'); setViewMenuOpen(false); } }}
                        disabled={!hasBottomBox}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', width: '100%', background: 'transparent', color: '#fff', opacity: hasBottomBox ? 1 : 0.5 }}
                        title="Show only the Bottom box"
                      >
                        <IoChevronDownCircle /> Bottom
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{
                width: (getCanvasWidth() || '100%') as number | string,
                height: (getCanvasHeight() || '100%') as number | string,
                padding: 8,
                borderRadius: 10,
                background: '#0f0f10',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 4px 18px rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{ width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
                  {(() => {
                    const ratio = topBottomRatio; // 0..100
                    const topFactor = ratio < 50 ? (50 - ratio) / 50 : 0;
                    const bottomFactor = ratio > 50 ? (ratio - 50) / 50 : 0;
                    // Preview should ignore global scalePercent; use a fixed max preview reduction percent
                    const PREVIEW_RATIO_MAX_PCT = 30; // decoupled from scalePercent
                    const effTopPct = PREVIEW_RATIO_MAX_PCT * topFactor;
                    const effBottomPct = PREVIEW_RATIO_MAX_PCT * bottomFactor;
                    const previewTopScale = Math.max(0.2, 1 - 2 * (effTopPct / 100));
                    const previewBottomScale = Math.max(0.2, 1 - 2 * (effBottomPct / 100));
                    return (
                      <CubeViewer
                        bottomOutsideFaces={(hasBottomBox && viewMode !== 'top') ? outsideFaces : undefined}
                        bottomInsideFaces={(hasBottomBox && viewMode !== 'top') ? insideFaces : undefined}
                        topOutsideFaces={(hasTopBox && viewMode !== 'bottom') ? topOutsideFaces : undefined}
                        topInsideFaces={(hasTopBox && viewMode !== 'bottom') ? topInsideFaces : undefined}
                        bottomScale={previewBottomScale}
                        topScale={previewTopScale}
                        openPercent={(hasBottomBox && hasTopBox && viewMode === 'both') ? openPercent : 0}
                        initialZoom={DEFAULT_VIEWER_ZOOM}
                      />
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Right: vertical slider placed OUTSIDE the colored frame */}
            {(hasBottomBox && hasTopBox && viewMode === 'both') && (
              <div style={{ gridColumn: 2, gridRow: 1, flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ color: '#fff', fontSize: '0.8em' }}>Open Box</div>
                  <div style={{ height: (0.8 * getCanvasHeight() || '100%') as number | string, position: 'relative' }}>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={openPercent}
                      onChange={e => setOpenPercent(Number(e.target.value))}
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: (0.8 * getCanvasHeight() || 0),
                        transform: 'translateX(-50%) translateY(-50%) rotate(-90deg)'
                      } as React.CSSProperties}
                      aria-label="Open Box"
                      title={`Open Box: ${openPercent}%`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Top-Bottom ratio slider under viewer */}
            <div style={{ gridColumn: 1, gridRow: 2, width: '100%', display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ color: '#fff', fontSize: '0.8em' }} title={"Adjust relative scale: move left to emphasize Top (Bottom reduced), right to emphasize Bottom (Top reduced)."}>
                  Top-Bottom ratio: {topBottomRatio}
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={topBottomRatio}
                  onChange={e => setTopBottomRatio(Number(e.target.value))}
                  aria-label="Top-Bottom ratio"
                  title={"Move left to increase Top relative scale and reduce Bottom to 0. Move right to increase Bottom and reduce Top to 0. Center is neutral."}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Settings / Export controls / Reference images */}
        {(() => {
          // Build asset URLs using Vite base path so it works in dev and production (GH Pages)
          const basePath = (import.meta as any).env?.BASE_URL || '/';
          const refOutsideTop = basePath + 'assets/reference_outside_top.png';
          const refOutsideBottom = basePath + 'assets/reference_outside_bottom.png';
          const refInside = basePath + 'assets/reference_inside.png';
          return (
        <div className="reference-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '2em', marginTop: '1em', marginBottom: '2em' }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection:'column', gap: '0.5em', alignItems: 'center'}}>
            <div style={{ color: '#fff'}}>Outside Reference</div>
            <a href={refOutsideTop} download={"reference_outside_top.png"} title="Download Outside Top reference">
              <img style={{ background: '#fff', cursor: 'pointer' }} src={refOutsideTop} width={120} alt="Outside Top Reference" />
            </a>
            <a href={refOutsideBottom} download={"reference_outside_bottom.png"} title="Download Outside Bottom reference">
              <img style={{ background: '#fff', cursor: 'pointer' }} src={refOutsideBottom} width={120} alt="Outside Bottom Reference" />
            </a>
          </div>
          <div style={{ flex: '0 1 400px' }}>
            {/* Uploads are handled inside each PolygonEditor to avoid duplicate inputs */}
            <section className="template-run-card" style={{ background: '#181818', borderRadius: '12px', padding: '1em', margin: '0 auto', maxWidth: '400px', boxShadow: '0 2px 12px #0006', display: 'flex', flexDirection: 'column', gap: '1em', alignItems: 'center' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75em', width: '100%', alignItems: 'start', justifyItems: 'start' }}>
                {SHOW_TEMPLATES && <div style={{ width: '100%', display: 'flex', alignItems: 'start', justifyContent: 'start' }}>
                  <TemplateSelect onTemplate={setTemplate} />
                </div>}
                {SHOW_TRANSFORMS && <div style={{ width: '100%', display: 'flex', alignItems: 'start', justifyContent: 'start', gap: '0.5em' }}>
                  <span style={{ color: '#fff' }}>Transform:</span>
                  <select value={transformMode} onChange={e => setTransformMode(e.target.value as any)} style={{ padding: '0.3em', borderRadius: '6px', minWidth: '90px' }}>
                    <option value="none">None</option>
                    <option value="scale">Scale</option>
                    <option value="tile">Tile (Fill A4)</option>
                    <option value="tile4">Tile 4x (2x2)</option>
                    <option value="tile8">Tile 8x (4x2)</option>
                  </select>
                </div>}
                {/* Rotation selectors moved into each PolygonEditor sidebar */}
                <div style={{ width: '100%', display: 'flex', alignItems: 'start', justifyContent: 'start', gap: '0.5em' }}>
                  <span style={{ color: '#fff' }}>Output DPI:</span>
                  <select value={outputDpi} onChange={e => setOutputDpi(Number(e.target.value))} style={{ padding: '0.3em', borderRadius: '6px', minWidth: '80px' }}>
                    <option value={200}>200</option>
                    <option value={300}>300</option>
                    <option value={600}>600</option>
                  </select>
                </div>
                {/* buttons moved below grid */}
              </div>
              <div style={{ width: '100%', display: 'flex', gap: '1em', justifyContent: 'center', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: '0.5em' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: '0.25em' }}>
                    <label
                      title={"Add fold lines that show how to fold the paper. The lines will not be visible in the finished box."}
                      style={{ color: '#fff', fontSize: '0.95em', display: 'flex', alignItems: 'center', gap: '0.5em' }}
                    >
                      <input
                        type="checkbox"
                        checked={withFoldLines}
                        onChange={e => setWithFoldLines(e.target.checked)}
                        title={"Add fold lines that show how to fold the paper. The lines will not be visible in the finished box."}
                        aria-label={"With fold helper lines"}
                      />
                      With fold helper lines
                    </label>
                    <label
                      title={"Add guide lines indicating where the printed sheet should be trimmed. Useful because many printers cannot print to the paper edge."}
                      style={{ color: '#fff', fontSize: '0.95em', display: 'flex', alignItems: 'center', gap: '0.5em' }}
                    >
                      <input
                        type="checkbox"
                        checked={withCutLines}
                        onChange={e => setWithCutLines(e.target.checked)}
                        title={"Add guide lines indicating where the printed sheet should be trimmed. Useful because many printers cannot print to the paper edge."}
                        aria-label={"With cut lines"}
                      />
                      With cut lines
                    </label>
                  </div>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5em' }}>
                    <div
                      title={"Reduce the box size by this percentage. The value is applied to each side of the page when generating the PDF."}
                      style={{ color: '#fff', fontSize: '0.9em' }}
                    >
                      Scale: {scalePercent}%
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      value={scalePercent}
                      onChange={e => {
                        // prevent negative values: clamp to 0 or above
                        const v = Math.max(0, Number(e.target.value));
                        setScalePercent(v);
                      }}
                      title={"Reduce the box size by this percentage. The value is applied to each side of the page when generating the PDF."}
                      aria-label={"Reduce the box size by percentage"}
                      style={{ width: '85%' }}
                    />
                  </div>
                  {/* Triangle growth slider */}
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5em' }}>
                    <div
                      title={"Increase the size of triangles by this percentage of the page/image max dimension. Applied to both input and output triangles."}
                      style={{ color: '#fff', fontSize: '0.9em' }}
                    >
                      Triangle growth: {triangleOffsetPct}%
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={triangleOffsetPct}
                      onChange={e => {
                        const v = Math.max(0, Number(e.target.value));
                        setTriangleOffsetPct(v);
                      }}
                      title={"Increase triangle size by a fixed offset of this percentage times max(width,height)."}
                      aria-label={"Triangle growth percent"}
                      style={{ width: '85%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '1em' }}>
                    <button onClick={() => handleRun(false)} disabled={loading || pdfLoading} className="menu-btn">
                      {loading ? 'Processing...' : 'Run Mapping'}
                    </button>
                    <button onClick={() => handleRunThenDownloadDual()} disabled={pdfLoading || loading} className="menu-btn">
                      {pdfLoading ? 'Preparing PDF...' : 'Download'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '1em', marginTop: '0.5em' }}>
                    <button onClick={() => saveToMapperFile()} disabled={loading || pdfLoading} className="menu-btn" title="Save project (.mapper)">
                      <IoSave style={{ verticalAlign: 'middle', marginRight: 8 }} /> Save
                    </button>
                    <button onClick={() => mapperInputRef.current?.click()} disabled={loading || pdfLoading} className="menu-btn" title="Load project (.mapper)">
                      <IoCloudUpload style={{ verticalAlign: 'middle', marginRight: 8 }} /> Load
                    </button>
                    <input ref={mapperInputRef} type="file" accept=".mapper,application/zip" style={{ display: 'none' }} onChange={e => onMapperFileSelected(e.target.files?.[0] ?? null)} />
                  </div>
                </div>
                {/* simple progress bar shown while PDF is being generated */}
                {(pdfLoading || pdfProgress > 0) && (
                  <div style={{ width: '90%', maxWidth: 360, marginTop: 8 }}>
                    <div style={{ height: 10, background: '#2b2b2b', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ width: `${pdfProgress}%`, height: '100%', background: '#4caf50', transition: 'width 200ms ease' }} />
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection:'column', gap: '0.5em', alignItems: 'center'}}>
            <div style={{ color: '#fff'}}>Inside Reference</div>
            <a href={refInside} download={"reference_inside.png"} title="Download Inside reference">
              <img style={{ background: '#fff', cursor: 'pointer' }} src={refInside} width={120} alt="Inside Reference" />
            </a>
          </div>
        </div>
          );
        })()}

        {/* Output previews side by side */}
        {SHOW_OUTPUT_PAGES && <div style={{ display: 'flex', flexDirection: 'row', gap: '2em', justifyContent: 'center', alignItems: 'flex-start', marginTop: '1em' }}>
          <ImagePreview src={results.output_page1} label="Output Page 1" />
          <ImagePreview src={results.output_page2} label="Output Page 2" />
        </div>}

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
      </div>
    </>
  );
}

export default BoxGenerator;
