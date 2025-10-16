import { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { unstable_batchedUpdates as batchedUpdates } from 'react-dom';
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
import SuggestedProjects from '../components/boxGenerator/SuggestedProjects';

const SHOW_TEMPLATES = false;
const GENERATE_DEMO_IN_DEBUG = false;
// Shared localStorage key to remember last used base filename across Save/Download/Load
const LS_KEY = 'om.lastFileBase';
// LocalStorage key for remembering whether the intro panel is expanded
const INTRO_LS_KEY = 'om.introOpen';

// Cross-browser filename picker: prompts for a file name, remembers last base across Save/Download
// - context: short message about the action (e.g., "Save project (.mapper)")
// - defaultBase: fallback base name (without extension)
// - extension: desired extension without dot (e.g., 'pdf', 'mapper')
const pickDownloadFilename = (opts: { context: string; defaultBase: string; extension: string }): string | null => {
  const { context, defaultBase, extension } = opts;
  const lastBaseRaw = (typeof localStorage !== 'undefined') ? (localStorage.getItem(LS_KEY) || '') : '';
  // If defaultBase has a suffix like _front/_back, keep it as a suffix suggestion, but prefer the stored base for consistency
  const suffixMatch = /_(front|back)$/i.exec(defaultBase);
  const suffix = suffixMatch ? `_${suffixMatch[1].toLowerCase()}` : '';
  const effBase = (lastBaseRaw || defaultBase).replace(/\.[^.]+$/, '');
  const suggested = `${effBase}${suffix ? suffix : ''}.${extension}`;

  const message = `Pick file name${context ? ` — ${context}` : ''}`;
  let input = window.prompt(message, suggested);
  if (input == null) return null; // cancelled
  input = input.trim();
  if (!input) return null;

  // Sanitize filename (no paths or illegal characters)
  const sanitize = (name: string) => {
    // strip directories
    name = name.replace(/^[\\/]+|[\\/]+$/g, '');
    // remove illegal characters commonly restricted across OSes
    name = name.replace(/[\0-\x1F<>:"/\\|?*]+/g, '');
    // collapse whitespace
    name = name.replace(/\s+/g, ' ').trim();
    if (!name) name = `file.${extension}`;
    return name;
  };

  let finalName = sanitize(input);
  // Ensure extension
  const hasExt = new RegExp(`\\.${extension}$`, 'i').test(finalName);
  if (!hasExt) finalName = `${finalName}.${extension}`;

  // Compute and persist base (shared across Save/Download). If user typed *_front/_back, store base before that suffix.
  const withoutExt = finalName.replace(/\.[^.]+$/, '');
  const frontBack = /(.*)_(front|back)$/i.exec(withoutExt);
  const baseForStore = (frontBack ? frontBack[1] : withoutExt) || effBase || 'file';
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, baseForStore); } catch { }

  return finalName;
};

const SHOW_TRANSFORMS = false;
const SHOW_OUTPUT_PAGES = false;
const SHOW_RUN_MAPPING = false;

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
  const [scalePercent, setScalePercent] = useState(0.5); // percent (0..100+): amount to reduce the printed box on each side
  const [triangleOffsetPct, setTriangleOffsetPct] = useState(10); // percent (0..100): triangle growth offset relative to max(width,height)
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  // Cancel flag for PDF generation
  const pdfCancelRef = useRef<boolean>(false);
  // UI state for when user has requested cancel and we're waiting for it to complete
  const [pdfCancelling, setPdfCancelling] = useState(false);
  const [withFoldLines, setWithFoldLines] = useState(true);
  const [withCutLines, setWithCutLines] = useState(true);
  // Collapsible intro state (persisted)
  const [introOpen, setIntroOpen] = useState<boolean>(() => {
    try {
      const v = (typeof localStorage !== 'undefined') ? localStorage.getItem(INTRO_LS_KEY) : null;
      if (v === '0') return false;
      if (v === '1') return true;
    } catch {}
    return true; // default expanded
  });
  useEffect(() => {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(INTRO_LS_KEY, introOpen ? '1' : '0'); } catch {}
  }, [introOpen]);
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
  // Top-Bottom ratio slider: range [-50, 50] where 0 is neutral. Negative reduces Top, positive reduces Bottom.
  // Top-Bottom balance slider: range [-50, 50]
  // < 0 => scale down Top; > 0 => scale down Bottom; 0 => neutral
  const [topBottomRatio, setTopBottomRatio] = useState<number>(2);
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

  // Async image transform helper: rotate then apply transform mode and return data URL
  const transformImageAsync = (
    dataUrl: string,
    mode: 'none' | 'scale' | 'tile' | 'tile4' | 'tile8',
    rotation: 0 | 90 | 180 | 270
  ): Promise<string> => {
    return new Promise((resolve) => {
      if (!dataUrl) return resolve('');
      ImageTransform.rotateDegrees(dataUrl, rotation, (rotated: string) => {
        if (mode === 'none') return resolve(rotated);
        try {
          if (mode === 'scale') return ImageTransform.scaleToA4Ratio(rotated, resolve);
          if (mode === 'tile') return ImageTransform.tileToA4Ratio(rotated, resolve);
          if (mode === 'tile4') return ImageTransform.tile4Times(rotated, resolve);
          if (mode === 'tile8') return ImageTransform.tile8Times(rotated, resolve);
        } catch { }
        resolve(rotated);
      });
    });
  };

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
    // Use refs to avoid stale state captured by debounced callbacks
    buildFaceTextures(outPolys, outsideImgTransformedRef.current).then(tex => setOutsideFaces(tex));
    buildFaceTextures(inPolys, insideImgTransformedRef.current).then(tex => setInsideFaces(tex));
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
    if (hasTopBoxRef.current) {
      // Use refs so the debounced timeout cannot see old image values
      buildFaceTextures(outsidePolys ?? topOutPolys, topOutsideImgTransformedRef.current).then(tex => setTopOutsideFaces(tex));
      buildFaceTextures(insidePolys ?? topInPolys, topInsideImgTransformedRef.current).then(tex => setTopInsideFaces(tex));
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

  // Always-current refs to avoid stale-closure reads in debounced callbacks
  const outsideImgTransformedRef = useRef(outsideImgTransformed);
  const insideImgTransformedRef = useRef(insideImgTransformed);
  const topOutsideImgTransformedRef = useRef(topOutsideImgTransformed);
  const topInsideImgTransformedRef = useRef(topInsideImgTransformed);
  const hasTopBoxRef = useRef(hasTopBox);

  useEffect(() => { outsideImgTransformedRef.current = outsideImgTransformed; }, [outsideImgTransformed]);
  useEffect(() => { insideImgTransformedRef.current = insideImgTransformed; }, [insideImgTransformed]);
  useEffect(() => { topOutsideImgTransformedRef.current = topOutsideImgTransformed; }, [topOutsideImgTransformed]);
  useEffect(() => { topInsideImgTransformedRef.current = topInsideImgTransformed; }, [topInsideImgTransformed]);
  useEffect(() => { hasTopBoxRef.current = hasTopBox; }, [hasTopBox]);
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
  const skipNextTransformRef = useRef(false);
  useEffect(() => {
    if (skipNextTransformRef.current) {
      // Skip one pass when we explicitly set transformed values during a batched load
      skipNextTransformRef.current = false;
      return;
    }
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
    if (!isDebug || !GENERATE_DEMO_IN_DEBUG) return; // skip in production unless flag set
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
  const saveAutosave = async (overrides?: {
    outsideJson?: OrigamiMapperTypes.TemplateJson | null;
    insideJson?: OrigamiMapperTypes.TemplateJson | null;
    topOutsideJson?: OrigamiMapperTypes.TemplateJson | null;
    topInsideJson?: OrigamiMapperTypes.TemplateJson | null;
    // Optional immediate raw image overrides to capture state changes before UI settles
    overrideRaw?: {
      outsideTop?: string | null;
      insideTop?: string | null;
      outsideBottom?: string | null;
      insideBottom?: string | null;
    } | null;
  }) => {
    try {
      const outsideJson = (overrides && 'outsideJson' in (overrides || {})) ? overrides?.outsideJson : (outsideEditorRef.current ? outsideEditorRef.current.getCurrentJson() : null);
      const insideJson = (overrides && 'insideJson' in (overrides || {})) ? overrides?.insideJson : (insideEditorRef.current ? insideEditorRef.current.getCurrentJson() : null);
      const topOutsideJson = (overrides && 'topOutsideJson' in (overrides || {})) ? overrides?.topOutsideJson : (topOutsideEditorRef.current ? topOutsideEditorRef.current.getCurrentJson() : null);
      const topInsideJson = (overrides && 'topInsideJson' in (overrides || {})) ? overrides?.topInsideJson : (topInsideEditorRef.current ? topInsideEditorRef.current.getCurrentJson() : null);
      // Persist rotated images (bake rotation into the saved data)
      const rawTopOutside = (overrides?.overrideRaw?.outsideTop ?? (topOutsideImgRaw || outsideImgTopRaw)) || '';
      const rawTopInside = (overrides?.overrideRaw?.insideTop ?? (topInsideImgRaw || insideImgTopRaw)) || '';
      const rawBottomOutside = (overrides?.overrideRaw?.outsideBottom ?? outsideImgBottomRaw) || '';
      const rawBottomInside = (overrides?.overrideRaw?.insideBottom ?? insideImgBottomRaw) || '';

      const bakedTopOutside = rawTopOutside
        ? await rotateDataUrlDegrees(rawTopOutside, topOutsideRotation)
        : '';
      const bakedTopInside = rawTopInside
        ? await rotateDataUrlDegrees(rawTopInside, topInsideRotation)
        : '';
      const bakedBottomOutside = rawBottomOutside
        ? await rotateDataUrlDegrees(rawBottomOutside, outsideRotation)
        : '';
      const bakedBottomInside = rawBottomInside
        ? await rotateDataUrlDegrees(rawBottomInside, insideRotation)
        : '';
      const outsideTopBlob = await dataUrlToBlob(bakedTopOutside || null);
      const insideTopBlob = await dataUrlToBlob(bakedTopInside || null);
      const outsideBottomBlob = await dataUrlToBlob(bakedBottomOutside || null);
      const insideBottomBlob = await dataUrlToBlob(bakedBottomInside || null);
      const item = {
        id: 'autosave',
        updatedAt: Date.now(),
        outsideTopBlob,
        insideTopBlob,
        outsideBottomBlob,
        insideBottomBlob,
        outsideJson,
        insideJson,
        topOutsideJson,
        topInsideJson,
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
      // Precompute transformed images with baked rotations (use 0 rotation here)
      const modeAtLoad = rec.transformMode ?? transformMode;
      const [botOutT, botInT, topOutT, topInT] = await Promise.all([
        outDataBottomUrl ? transformImageAsync(outDataBottomUrl, modeAtLoad, 0) : Promise.resolve(''),
        inDataBottomUrl ? transformImageAsync(inDataBottomUrl, modeAtLoad, 0) : Promise.resolve(''),
        outDataTopUrl ? transformImageAsync(outDataTopUrl, modeAtLoad, 0) : Promise.resolve(''),
        inDataTopUrl ? transformImageAsync(inDataTopUrl, modeAtLoad, 0) : Promise.resolve('')
      ]);
      // Apply all state updates in one render
      batchedUpdates(() => {
        const hasAnyBottom = Boolean(outDataBottomUrl || inDataBottomUrl);
        const hasAnyTop = Boolean(outDataTopUrl || inDataTopUrl);
        if (hasAnyBottom) setHasBottomBox(true);
        if (hasAnyTop) setHasTopBox(true);
        // Suppress auto polygon reset before backgrounds update
        try { outsideEditorRef.current?.suppressNextAutoReset(); } catch { }
        try { insideEditorRef.current?.suppressNextAutoReset(); } catch { }
        try { topOutsideEditorRef.current?.suppressNextAutoReset(); } catch { }
        try { topInsideEditorRef.current?.suppressNextAutoReset(); } catch { }
        // Rotations are baked; reset rotation states to 0
        setOutsideRotation(0);
        setInsideRotation(0);
        setTopOutsideRotation(0);
        setTopInsideRotation(0);
        // Set a skip flag to avoid transform effect during this batch
        skipNextTransformRef.current = true;
        // Bottom raw + transformed
        setOutsideImgBottomRaw(outDataBottomUrl || '');
        setInsideImgBottomRaw(inDataBottomUrl || '');
        setOutsideImgTransformed(botOutT || '');
        setInsideImgTransformed(botInT || '');
        // Top raw + transformed (also mirror to legacy top raws)
        setTopOutsideImgRaw(outDataTopUrl || '');
        setTopInsideImgRaw(inDataTopUrl || '');
        setOutsideImgTopRaw(outDataTopUrl || '');
        setInsideImgTopRaw(inDataTopUrl || '');
        setTopOutsideImgTransformed(topOutT || '');
        setTopInsideImgTransformed(topInT || '');
        // Set transform mode last inside batch so effect is skipped
        if (rec.transformMode) setTransformMode(rec.transformMode);
        // Restore polygons
        try { if (rec.outsideJson && outsideEditorRef.current) outsideEditorRef.current.setFromJson(rec.outsideJson); } catch { }
        try { if (rec.insideJson && insideEditorRef.current) insideEditorRef.current.setFromJson(rec.insideJson); } catch { }
        try { if (rec.topOutsideJson && topOutsideEditorRef.current) topOutsideEditorRef.current.setFromJson(rec.topOutsideJson); } catch { }
        try { if (rec.topInsideJson && topInsideEditorRef.current) topInsideEditorRef.current.setFromJson(rec.topInsideJson); } catch { }
        // Other settings
        if (typeof rec.scalePercent === 'number') setScalePercent(rec.scalePercent);
        if (typeof rec.triangleOffsetPct === 'number') setTriangleOffsetPct(rec.triangleOffsetPct);
        if (typeof rec.outputDpi === 'number') setOutputDpi(rec.outputDpi);
        if (typeof rec.withFoldLines === 'boolean') setWithFoldLines(rec.withFoldLines);
        if (typeof rec.withCutLines === 'boolean') setWithCutLines(rec.withCutLines);
      });
      // In production builds the Top editors may not be mounted yet when we tried to setFromJson above
      // (hasTopBox flips to true in the same batch). Apply again after the next paint.
      setTimeout(() => {
        try { if (rec.topOutsideJson && topOutsideEditorRef.current) { topOutsideEditorRef.current.suppressNextAutoReset(); topOutsideEditorRef.current.setFromJson(rec.topOutsideJson); } } catch { }
        try { if (rec.topInsideJson && topInsideEditorRef.current) { topInsideEditorRef.current.suppressNextAutoReset(); topInsideEditorRef.current.setFromJson(rec.topInsideJson); } } catch { }
      }, 0);
      // Safety second attempt in case images/transforms finalize slightly later
      setTimeout(() => {
        try { if (rec.topOutsideJson && topOutsideEditorRef.current) { topOutsideEditorRef.current.suppressNextAutoReset(); topOutsideEditorRef.current.setFromJson(rec.topOutsideJson); } } catch { }
        try { if (rec.topInsideJson && topInsideEditorRef.current) { topInsideEditorRef.current.suppressNextAutoReset(); topInsideEditorRef.current.setFromJson(rec.topInsideJson); } } catch { }
      }, 60);
    } catch (err) {
      console.warn('Failed to load autosave:', err);
    }
  };

  // Save to .mapper (zip) file
  const saveToMapperFile = async () => {
    try {
      // Ask user for a filename (cross-browser, name only)
      const pickedName = pickDownloadFilename({
        context: 'Save project (.mapper)',
        defaultBase: 'origami_project',
        extension: 'mapper'
      });
      if (!pickedName) return; // user cancelled
      // Build combined JSONs (bottom and top) like handleRun does
      // Bottom
      const outsideJson = outsideEditorRef.current ? outsideEditorRef.current.getCurrentJson() : boxData;
      const insideJson = insideEditorRef.current ? insideEditorRef.current.getCurrentJson() : boxData;
      const combinedJson = {
        ...outsideJson,
        input_polygons: [...(outsideJson.input_polygons ?? []), ...(insideJson.input_polygons ?? [])],
        output_polygons: [...(outsideJson.output_polygons ?? []), ...(insideJson.output_polygons ?? [])]
      };
      // Top (use top-specific helpers if refs are not mounted yet)
      const topOutsideJson = topOutsideEditorRef.current ? topOutsideEditorRef.current.getCurrentJson() : getTopEditorData(false);
      const topInsideJson = topInsideEditorRef.current ? topInsideEditorRef.current.getCurrentJson() : getTopEditorData(true);
      const combinedTopJson = {
        ...topOutsideJson,
        input_polygons: [...(topOutsideJson.input_polygons ?? []), ...(topInsideJson.input_polygons ?? [])],
        output_polygons: [...(topOutsideJson.output_polygons ?? []), ...(topInsideJson.output_polygons ?? [])]
      };

      const zip = new JSZip();
      // Single combined JSON containing both bottom and top
      const mapperJson = { bottom: combinedJson, top: combinedTopJson };
      zip.file('box.json', JSON.stringify(mapperJson, null, 2));
      // add rotated-only images (bake rotation into the image files)
      const bakedTopOutside2 = (topOutsideImgRaw || outsideImgTopRaw)
        ? await rotateDataUrlDegrees((topOutsideImgRaw || outsideImgTopRaw), topOutsideRotation)
        : '';
      const bakedTopInside2 = (topInsideImgRaw || insideImgTopRaw)
        ? await rotateDataUrlDegrees((topInsideImgRaw || insideImgTopRaw), topInsideRotation)
        : '';
      const bakedBottomOutside2 = outsideImgBottomRaw
        ? await rotateDataUrlDegrees(outsideImgBottomRaw, outsideRotation)
        : '';
      const bakedBottomInside2 = insideImgBottomRaw
        ? await rotateDataUrlDegrees(insideImgBottomRaw, insideRotation)
        : '';
      if (bakedTopOutside2) {
        const outBlob = await dataUrlToBlob(bakedTopOutside2);
        if (outBlob) zip.file('outside_top.png', outBlob);
      }
      if (bakedTopInside2) {
        const inBlob = await dataUrlToBlob(bakedTopInside2);
        if (inBlob) zip.file('inside_top.png', inBlob);
      }
      if (bakedBottomOutside2) {
        const outBlob = await dataUrlToBlob(bakedBottomOutside2);
        if (outBlob) zip.file('outside_bottom.png', outBlob);
      }
      if (bakedBottomInside2) {
        const inBlob = await dataUrlToBlob(bakedBottomInside2);
        if (inBlob) zip.file('inside_bottom.png', inBlob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, pickedName);
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
      // Remember this file's base name for subsequent saves/downloads
      try {
        const rawName = file.name || '';
        const withoutExt = rawName.replace(/\.[^.]+$/, '');
        if (withoutExt && typeof localStorage !== 'undefined') {
          localStorage.setItem(LS_KEY, withoutExt);
        }
      } catch { /* ignore */ }

      const ab = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(ab);
      // read box.json
      let loadedTopFromMain = false;
      let loadedBottomFromMain = false;
      // Stage polygon JSONs to apply in one batch later
      let stagedBottomOutside: any = null;
      let stagedBottomInside: any = null;
      let stagedTopOutside: any = null;
      let stagedTopInside: any = null;
      if (zip.file('box.json')) {
        const txt = await zip.file('box.json')!.async('string');
        try {
          const parsed = JSON.parse(txt);
          if (parsed?.bottom || parsed?.top) {
            // New format: single JSON with bottom and top
            const bottom = parsed.bottom || {};
            const top = parsed.top || {};
            const bottomOutsideParsed = {
              ...bottom,
              input_polygons: (bottom.input_polygons ?? []).filter((p: any) => !String(p.id).includes('i'))
            };
            const bottomInsideParsed = {
              ...bottom,
              input_polygons: (bottom.input_polygons ?? []).filter((p: any) => String(p.id).includes('i'))
            };
            // Stage bottom polygons for later
            stagedBottomOutside = bottomOutsideParsed;
            stagedBottomInside = bottomInsideParsed;
            const hasBottomPolys = (bottom.input_polygons ?? []).length > 0 || (bottom.output_polygons ?? []).length > 0;
            if (hasBottomPolys) {
              setHasBottomBox(true);
              loadedBottomFromMain = true;
            }

            const topOutsideParsed = {
              ...top,
              input_polygons: (top.input_polygons ?? []).filter((p: any) => !String(p.id).includes('i'))
            };
            const topInsideParsed = {
              ...top,
              input_polygons: (top.input_polygons ?? []).filter((p: any) => String(p.id).includes('i'))
            };
            const hasTopPolys = (top.input_polygons ?? []).length > 0 || (top.output_polygons ?? []).length > 0;
            if (hasTopPolys) {
              setHasTopBox(true);
              loadedTopFromMain = true;
            }
            // Stage top polygons for later
            stagedTopOutside = topOutsideParsed;
            stagedTopInside = topInsideParsed;
          } else {
            // Legacy format: parsed is a single combined JSON (bottom)
            const outsideParsed = {
              ...parsed,
              input_polygons: (parsed.input_polygons ?? []).filter((p: any) => !String(p.id).includes('i'))
            };
            const insideParsed = {
              ...parsed,
              input_polygons: (parsed.input_polygons ?? []).filter((p: any) => String(p.id).includes('i'))
            };
            // Stage legacy bottom polygons
            stagedBottomOutside = outsideParsed;
            stagedBottomInside = insideParsed;
            const hasBottomPolys = (parsed.input_polygons ?? []).length > 0 || (parsed.output_polygons ?? []).length > 0;
            if (hasBottomPolys) setHasBottomBox(true);
          }
        } catch (e) { console.warn('box.json parse error', e); }
      }
      // Backward compatibility: if top not provided inside box.json, optionally read box_top.json
      if (!loadedTopFromMain && zip.file('box_top.json')) {
        const txtTop = await zip.file('box_top.json')!.async('string');
        try {
          const parsedTop = JSON.parse(txtTop);
          const topOutsideParsed = {
            ...parsedTop,
            input_polygons: (parsedTop.input_polygons ?? []).filter((p: any) => !String(p.id).includes('i'))
          };
          const topInsideParsed = {
            ...parsedTop,
            input_polygons: (parsedTop.input_polygons ?? []).filter((p: any) => String(p.id).includes('i'))
          };
          setHasTopBox(true);
          stagedTopOutside = topOutsideParsed;
          stagedTopInside = topInsideParsed;
        } catch (e) { console.warn('box_top.json parse error', e); }
      }
      // images
      let dataUrl = "";
      // Prepare transformed images (rotations already baked in the .mapper images)
      const modeAtLoad = transformMode;
      let topOutRaw = "", topInRaw = "", botOutRaw = "", botInRaw = "";
      let topOutT = "", topInT = "", botOutT = "", botInT = "";
      if (zip.file('outside_top.png')) {
        const blob = await zip.file('outside_top.png')!.async('blob');
        dataUrl = await blobToDataUrl(blob) ?? "";
        topOutRaw = dataUrl;
        topOutT = dataUrl ? await transformImageAsync(dataUrl, modeAtLoad, 0) : "";
      }
      // defer setting until batch
      dataUrl = "";
      if (zip.file('inside_top.png')) {
        const blob = await zip.file('inside_top.png')!.async('blob');
        dataUrl = await blobToDataUrl(blob) ?? "";
        topInRaw = dataUrl;
        topInT = dataUrl ? await transformImageAsync(dataUrl, modeAtLoad, 0) : "";
      }
      // defer setting until batch
      if (dataUrl || zip.file('outside_top.png')) {
        setHasTopBox(true);
      }

      if (zip.file('outside_bottom.png')) {
        const blob = await zip.file('outside_bottom.png')!.async('blob');
        dataUrl = await blobToDataUrl(blob) ?? "";
        botOutRaw = dataUrl;
        botOutT = dataUrl ? await transformImageAsync(dataUrl, modeAtLoad, 0) : "";
      }
      // defer setting until batch
      dataUrl = "";
      if (zip.file('inside_bottom.png')) {
        const blob = await zip.file('inside_bottom.png')!.async('blob');
        dataUrl = await blobToDataUrl(blob) ?? "";
        botInRaw = dataUrl;
        botInT = dataUrl ? await transformImageAsync(dataUrl, modeAtLoad, 0) : "";
      }
      // Apply everything in a single render
      batchedUpdates(() => {
        // Reset rotation states to 0 for baked images
        setTopOutsideRotation(0);
        setTopInsideRotation(0);
        setOutsideRotation(0);
        setInsideRotation(0);
        // Suppress polygon auto reset before applying backgrounds and polygons
        try { outsideEditorRef.current?.suppressNextAutoReset(); } catch { }
        try { insideEditorRef.current?.suppressNextAutoReset(); } catch { }
        try { topOutsideEditorRef.current?.suppressNextAutoReset(); } catch { }
        try { topInsideEditorRef.current?.suppressNextAutoReset(); } catch { }
        // Skip one transform effect pass
        skipNextTransformRef.current = true;
        // Set polygons if staged
        try { if (stagedBottomOutside && outsideEditorRef.current) outsideEditorRef.current.setFromJson(stagedBottomOutside); } catch { }
        try { if (stagedBottomInside && insideEditorRef.current) insideEditorRef.current.setFromJson(stagedBottomInside); } catch { }
        try { if (stagedTopOutside && topOutsideEditorRef.current) topOutsideEditorRef.current.setFromJson(stagedTopOutside); } catch { }
        try { if (stagedTopInside && topInsideEditorRef.current) topInsideEditorRef.current.setFromJson(stagedTopInside); } catch { }
        // Set raw + transformed images for top and bottom
        setTopOutsideImgRaw(topOutRaw);
        setTopInsideImgRaw(topInRaw);
        setOutsideImgTopRaw(topOutRaw);
        setInsideImgTopRaw(topInRaw);
        setTopOutsideImgTransformed(topOutT);
        setTopInsideImgTransformed(topInT);
        setOutsideImgBottomRaw(botOutRaw);
        setInsideImgBottomRaw(botInRaw);
        setOutsideImgTransformed(botOutT);
        setInsideImgTransformed(botInT);
        // Ensure visibility
        if (topOutRaw || topInRaw) setHasTopBox(true);
        if (botOutRaw || botInRaw || loadedBottomFromMain) setHasBottomBox(true);
        if (!botOutRaw && !botInRaw && !loadedBottomFromMain) setHasBottomBox(true);
      });
      // In production builds the Top editors may not be mounted yet when we setFromJson above.
      // Re-apply after mount.
      setTimeout(() => {
        try { if (stagedTopOutside && topOutsideEditorRef.current) { topOutsideEditorRef.current.suppressNextAutoReset(); topOutsideEditorRef.current.setFromJson(stagedTopOutside); } } catch { }
        try { if (stagedTopInside && topInsideEditorRef.current) { topInsideEditorRef.current.suppressNextAutoReset(); topInsideEditorRef.current.setFromJson(stagedTopInside); } } catch { }
      }, 0);
      setTimeout(() => {
        try { if (stagedTopOutside && topOutsideEditorRef.current) { topOutsideEditorRef.current.suppressNextAutoReset(); topOutsideEditorRef.current.setFromJson(stagedTopOutside); } } catch { }
        try { if (stagedTopInside && topInsideEditorRef.current) { topInsideEditorRef.current.suppressNextAutoReset(); topInsideEditorRef.current.setFromJson(stagedTopInside); } } catch { }
      }, 60);
    } catch (err) {
      console.error('Failed to load .mapper file:', err);
      alert('Failed to load project file: ' + String(err));
    }
  };

  // -------------------------------------------------------------
  // DEV-ONLY automation (Option C): expose global helpers to generate
  // preview PNGs for all suggested projects.
  // Usage (in browser console while running dev server):
  //   await window.generateSuggestedProjectPreviews({ openPercent: 60, ratio: 0 });
  // Optional params: manifestUrl, openPercent, ratio, settleMs, betweenMs, log, single
  // -------------------------------------------------------------
  if ((import.meta as any).env?.DEV) {
    (window as any).onMapperFileSelected = onMapperFileSelected;
    (window as any).generateSuggestedProjectPreviews = async (options?: {
      manifestUrl?: string;
      openPercent?: number;
      ratio?: number;
      settleMs?: number;
      betweenMs?: number;
      log?: boolean;
      single?: string; // only process entries whose file path contains this substring
      transparent?: boolean; // capture with transparent bg
      outputFormat?: 'png' | 'webp'; // default png
      webpQuality?: number; // 0..1 quality for webp (default 0.9)
      trim?: boolean; // auto-trim transparent borders (default true when transparent)
      alphaThreshold?: number; // 0..255 threshold for non-empty pixel (default 4)
    }) => {
      const {
        manifestUrl = '/assets/examples/suggestions_projects/projects.json',
        openPercent: optOpen = 55,
        ratio: optRatio = 0,
        settleMs = 900,
        betweenMs = 250,
        log = true,
        single,
        transparent = false,
        outputFormat = 'png',
        webpQuality = 0.9,
        trim = transparent, // default enable trim when transparent
        alphaThreshold = 4
      } = options || {};
      const base = (import.meta as any).env?.BASE_URL || '/';
      const withBase = (u: string) => /^(https?:|data:)/i.test(u) ? u : (u.startsWith('/') ? base + u.slice(1) : base + u);
      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
      try {
        if (log) console.log('[PreviewGen] Fetching manifest...');
        const res = await fetch(withBase(manifestUrl), { cache: 'no-store' });
        if (!res.ok) throw new Error('Manifest fetch failed ' + res.status);
        const manifest = await res.json();
        const list: Array<{ file: string; preview?: string }> = Array.isArray(manifest?.projects) ? manifest.projects : [];
        if (list.length === 0) { console.warn('[PreviewGen] No projects in manifest'); return; }
        if (log) console.log(`[PreviewGen] ${list.length} project(s) found.`);
        const findCanvas = () => {
          const byId = document.getElementById('cube-viewer-canvas') as HTMLCanvasElement | null;
            if (byId && typeof (byId as any).toDataURL === 'function') return byId;
            // Fallback: pick largest canvas; sometimes r3f recreates the element before onCreated fires
            const canvases = Array.from(document.querySelectorAll('canvas')) as HTMLCanvasElement[];
            let best: HTMLCanvasElement | null = null; let bestArea = 0;
            canvases.forEach(c => { const a = c.width * c.height; if (typeof (c as any).toDataURL === 'function' && a > bestArea) { best = c; bestArea = a; } });
            return best;
        };
        // Helper: robust existence check (dev server may return index.html with 200)
        const previewExists = async (url: string): Promise<boolean> => {
          try {
            const res = await fetch(withBase(url), { cache: 'no-store' });
            if (!res.ok) return false;
            const ct = (res.headers.get('content-type') || '').toLowerCase();
            // If server reports image/* we accept
            if (ct.startsWith('image/')) return true;
            // If it's clearly html, it's the SPA fallback
            if (ct.includes('text/html')) return false;
            // Fallback: inspect a small slice of body text
            const blob = await res.blob();
            if (blob.type.startsWith('image/')) return true;
            if (blob.size < 32 * 1024) { // small fallback html likely
              try {
                const text = await blob.text();
                if (/<!doctype html>/i.test(text) || /<html/i.test(text)) return false;
              } catch { /* ignore */ }
            }
            // If we can't prove it's html and we have some bytes, assume does not exist (force regen)
            return false;
          } catch {
            return false;
          }
        };
        for (const proj of list) {
          if (single && !proj.file.includes(single)) continue;
          const mapperPath = proj.file;
          const fetchUrl = withBase(mapperPath);
          // Expected preview path: either provided or derived by replacing .mapper with .preview.webp (project spec)
          const previewPath = (proj.preview || mapperPath.replace(/\.mapper$/i, '.preview.webp')).replace(/\.preview\.(png|jpg|jpeg)$/i, '.preview.webp');
          const fileName = previewPath.split('/').pop() || 'preview.webp';
          // Skip generation if preview already exists (robust check)
          if (await previewExists(previewPath)) {
            if (log) console.log(`[PreviewGen] Skipping existing preview: ${withBase(previewPath)}`);
            continue;
          }
          if (log) console.log(`[PreviewGen] Loading ${mapperPath} (will generate ${fileName})`);
          try {
            const r = await fetch(fetchUrl, { cache: 'no-store' });
            if (!r.ok) throw new Error('Mapper fetch failed ' + r.status);
            const blob = await r.blob();
            const f = new File([blob], mapperPath.split('/').pop() || 'project.mapper', { type: 'application/zip' });
            await onMapperFileSelected(f);
            setOpenPercent(Math.max(0, Math.min(100, optOpen)));
            setTopBottomRatio(Math.max(-50, Math.min(50, optRatio)));
            setViewMode('both');
            // Wait requested settle ms plus two animation frames to ensure r3f has rendered a stable frame
            await delay(settleMs);
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            let dataUrl: string | null = null;
            let usedToggle = false;
            // Prefer offscreen render target capture (Strategy B) if available
            const captureRT = (window as any).__captureCubeViewerFrame;
            if (typeof captureRT === 'function') {
              try {
                dataUrl = await captureRT({
                  transparent,
                  format: outputFormat,
                  quality: webpQuality
                });
              } catch (e) {
                if (log) console.warn('[PreviewGen] Offscreen capture failed, falling back', e);
                dataUrl = null;
              }
            }
            if (!dataUrl) {
              // Fallback: direct canvas capture (legacy path)
              const toggle = (window as any).__toggleCubePreviewTransparency;
              if (transparent && typeof toggle === 'function') { toggle(true); usedToggle = true; }
              const canvas = findCanvas();
              if (!canvas) { console.warn('[PreviewGen] Canvas not found for', mapperPath); continue; }
              try { const gl = (canvas as any).getContext?.('webgl2') || (canvas as any).getContext?.('webgl'); if (gl) { gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)); } } catch {}
              if (outputFormat === 'webp') {
                dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/webp', Math.min(1, Math.max(0, webpQuality)) || 0.9);
              } else {
                dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png');
              }
              // Restore opaque background after capture only if we toggled it
              if (usedToggle && transparent && typeof toggle === 'function') toggle(false);
            }
            if (!dataUrl) { console.warn('[PreviewGen] Capture failed for', mapperPath); continue; }
            // Trim transparent edges if requested
            if (trim && dataUrl.startsWith('data:image/')) {
              try {
                const img = new Image();
                const loadP = new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = (e) => rej(e); });
                img.src = dataUrl;
                await loadP;
                const w = img.naturalWidth; const h = img.naturalHeight;
                const off = document.createElement('canvas'); off.width = w; off.height = h;
                const ctx = off.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0);
                  const imgData = ctx.getImageData(0, 0, w, h);
                  const data = imgData.data;
                  let minX = w, minY = h, maxX = -1, maxY = -1;
                  for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                      const i = (y * w + x) * 4;
                      const a = data[i + 3];
                      if (a > alphaThreshold) {
                        if (x < minX) minX = x;
                        if (y < minY) minY = y;
                        if (x > maxX) maxX = x;
                        if (y > maxY) maxY = y;
                      }
                    }
                  }
                  if (maxX >= minX && maxY >= minY) {
                    const tw = maxX - minX + 1; const th = maxY - minY + 1;
                    const trimmed = document.createElement('canvas'); trimmed.width = tw; trimmed.height = th;
                    const tctx = trimmed.getContext('2d');
                    if (tctx) {
                      tctx.drawImage(off, minX, minY, tw, th, 0, 0, tw, th);
                      dataUrl = outputFormat === 'webp'
                        ? trimmed.toDataURL('image/webp', Math.min(1, Math.max(0, webpQuality)) || 0.9)
                        : trimmed.toDataURL('image/png');
                    }
                  } else if (log) {
                    console.warn('[PreviewGen] Trim skipped: no opaque pixels for', mapperPath);
                  }
                }
              } catch (trimErr) {
                if (log) console.warn('[PreviewGen] Trim failed for', mapperPath, trimErr);
              }
            }
            // Offscreen path doesn't modify visible background; fallback path handled restoration above
            // Adjust file name extension for webp
            let finalName = fileName;
            if (outputFormat === 'webp') {
              const baseNoExt = fileName.replace(/\.[^.]+$/, '');
              finalName = baseNoExt + '.webp';
            } else if (outputFormat === 'png') {
              // If user explicitly requests png override extension
              const baseNoExt = fileName.replace(/\.[^.]+$/, '');
              finalName = baseNoExt + '.png';
            }
            const a = document.createElement('a');
            a.download = finalName;
            a.href = dataUrl;
            document.body.appendChild(a); a.click(); a.remove();
            if (log) console.log('[PreviewGen] Captured', finalName, transparent ? '(transparent)' : '', trim ? '(trimmed)' : '');
            await delay(betweenMs);
          } catch (inner) {
            console.warn('[PreviewGen] Failed', mapperPath, inner);
          }
        }
        if (log) console.log('[PreviewGen] Done.');
      } catch (err) {
        console.error('[PreviewGen] Fatal', err);
      }
    };
  }

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

  // Shared renderer: generates a PDF from a sequence of pages of different kinds and scales
  const renderPdfFromSequence = async (
    sequence: Array<{ dataUrl: string; pageKind: 1 | 2; scale?: number }>,
    fileName: string
  ) => {
    if (pdfCancelRef.current) throw new Error('PDF_CANCELLED');
    // A4 dimensions in mm
    const PAGE_W = 210;
    const PAGE_H = 297;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    for (let i = 0; i < sequence.length; i++) {
      if (pdfCancelRef.current) throw new Error('PDF_CANCELLED');
      setPdfProgress(50 + Math.round((i / Math.max(1, sequence.length)) * 40));
      await new Promise(resolve => setTimeout(resolve, 10));
      const { dataUrl: rawUrl, pageKind, scale } = sequence[i];
      const perPageScale = typeof scale === 'number' ? scale : (scalePercent / 100);
      const frac = Math.max(0, perPageScale || 1);
      const innerW = PAGE_W * frac;
      const innerH = PAGE_H * frac;
      const x = (PAGE_W - innerW) / 2;
      const y = (PAGE_H - innerH) / 2;

      let dataUrl = rawUrl;
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
      if (pdfCancelRef.current) throw new Error('PDF_CANCELLED');
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
                if (pdfCancelRef.current) throw new Error('PDF_CANCELLED');
                doc.addImage(rotatedDataUrl, 'PNG', x, y, innerW, innerH, undefined, 'FAST');
              } else {
                if (pdfCancelRef.current) throw new Error('PDF_CANCELLED');
                doc.addImage(helperDataUrl, 'PNG', x, y, innerW, innerH, undefined, 'FAST');
              }
            } catch {
              if (pdfCancelRef.current) throw new Error('PDF_CANCELLED');
              doc.addImage(helperDataUrl, 'PNG', x, y, innerW, innerH, undefined, 'FAST');
            }
          }
        } catch { }
      }
      if (withCutLines) {
        try {
          // Prefer vector drawing in PDF for perfect sharpness
          const lineWidthMM = 0.2; // ~1px at 254 dpi; thin crisp stroke
          const dashMM = 0.6; // ~2px at 254–300 dpi; similar to previous canvas dashes
          const insetMM = lineWidthMM / 2; // keep stroke fully inside the content area
          const rectX = x + insetMM;
          const rectY = y + insetMM;
          const rectW = Math.max(0, innerW - insetMM * 2);
          const rectH = Math.max(0, innerH - insetMM * 2);

          // Set dashed stroke if supported; fall back to solid
          const anyDoc: any = doc as any;
          const resetDash = () => {
            if (typeof anyDoc.setLineDash === 'function') anyDoc.setLineDash([]);
            if (typeof anyDoc.setLineDashPattern === 'function') anyDoc.setLineDashPattern([], 0);
          };

          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(lineWidthMM); // in mm
          if (typeof anyDoc.setLineDash === 'function') {
            anyDoc.setLineDash([dashMM, dashMM]);
          } else if (typeof anyDoc.setLineDashPattern === 'function') {
            anyDoc.setLineDashPattern([dashMM, dashMM], 0);
          }
          doc.rect(rectX, rectY, rectW, rectH, 'D');
          resetDash();
        } catch {
          // Fallback: render a high-DPI raster overlay to avoid pixelation
          try {
            const DPI = 300;
            const mmPerInch = 25.4;
            const pxW = Math.max(1, Math.round((innerW / mmPerInch) * DPI));
            const pxH = Math.max(1, Math.round((innerH / mmPerInch) * DPI));
            const c3 = document.createElement('canvas');
            c3.width = pxW; c3.height = pxH;
            const cx3 = c3.getContext('2d');
            if (cx3) {
              cx3.clearRect(0, 0, pxW, pxH);
              cx3.strokeStyle = 'rgba(0,0,0,1)';
              cx3.lineWidth = 1; cx3.setLineDash([2, 2]);
              const inset = 0.5; // half-pixel inset for crisp 1px stroke
              cx3.strokeRect(inset, inset, pxW - 1, pxH - 1);
              const overlay = c3.toDataURL('image/png');
              if (pdfCancelRef.current) throw new Error('PDF_CANCELLED');
              doc.addImage(overlay, 'PNG', x, y, innerW, innerH, undefined, 'FAST');
            }
          } catch { }
        }
      }
      if (pdfCancelRef.current) throw new Error('PDF_CANCELLED');
      if (i < sequence.length - 1) doc.addPage();
    }
    doc.save(fileName);
  };

  // Generate a PDF from an array of page images (all page1 or all page2)
  const generatePdfFromPages = async (
    pages: string[],
    pageKind: 1 | 2,
    fileName: string,
    pageScalePercents?: number[] // optional per-page scale overrides (0..100). If omitted, uses global scalePercent
  ) => {
    const sequence = pages.map((dataUrl, i) => ({
      dataUrl,
      pageKind,
      scale: Array.isArray(pageScalePercents) ? (pageScalePercents[i] ?? scalePercent / 100) : (scalePercent / 100)
    }));
    await renderPdfFromSequence(sequence, fileName);
  };

  // Generate a single PDF from a mixed sequence of pages; thin wrapper over shared renderer
  const generatePdfFromPageSequence = async (
    pages: Array<{ dataUrl: string; pageKind: 1 | 2; scale?: number }>,
    fileName: string
  ) => {
    await renderPdfFromSequence(
      pages.map(p => ({
        dataUrl: p.dataUrl,
        pageKind: p.pageKind,
        scale: typeof p.scale === 'number' ? p.scale : (scalePercent / 100)
      })),
      fileName
    );
  };

  // Run mapping for bottom/top and download two PDFs: outer (page1s) then inner (page2s)
  const handleRunThenDownloadDual = async (mode: 'combined-single' | 'split-dual' = 'combined-single') => {
    if (loading) return;
    // Prompt for desired filename(s) up front
    let targetPdfName = '';
    let targetPdfNameFront = '';
    let targetPdfNameBack = '';
    if (mode === 'combined-single') {
      const picked = pickDownloadFilename({ context: 'Download PDF (combined)', defaultBase: 'origami_boxes', extension: 'pdf' });
      if (!picked) return; // user cancelled
      targetPdfName = picked;
    } else {
      // Ask once, then auto-append _front and _back
      const picked = pickDownloadFilename({ context: 'Download PDFs (front/back)', defaultBase: 'origami_boxes', extension: 'pdf' });
      if (!picked) return; // user cancelled
      const withoutExt = picked.replace(/\.[^.]+$/, '');
      const base = withoutExt.replace(/_(front|back)$/i, '');
      targetPdfNameFront = `${base}_front.pdf`;
      targetPdfNameBack = `${base}_back.pdf`;
    }
    // reset cancel flag and start progress
    pdfCancelRef.current = false;
    setPdfLoading(true);
    setPdfProgress(5);
    setLoading(true);
    try {
      const runs: Array<Promise<{ [k: string]: string }>> = [];
      if (hasTopBox) runs.push(runMappingForBox('top'));
      if (hasBottomBox) runs.push(runMappingForBox('bottom'));
      const dicts = await Promise.all(runs);
      if (pdfCancelRef.current) throw new Error('PDF_CANCELLED');
      setPdfProgress(50);
      // Build page arrays
      const outerPages: string[] = [];
      const innerPages: string[] = [];
      const outerScales: number[] = [];
      const innerScales: number[] = [];

      const ratio = topBottomRatio; // -50..50
      const factors = (() => {
        if (ratio < 0) return { top: 1 - (-ratio) / 50, bottom: 1 };
        if (ratio > 0) return { top: 1, bottom: 1 - (ratio) / 50 };
        return { top: 1, bottom: 1 };
      })();

      // Helper push with corresponding scale for which box it belongs to
      const pushPagesWithScale = (which: 'bottom' | 'top', d: { [k: string]: string } | undefined) => {
        if (!d) return;
        const factor = which === 'top' ? factors.top : factors.bottom;
        const eff = (1 - scalePercent / 100.0) * factor;
        if (d.output_page1) { outerPages.push(d.output_page1); outerScales.push(eff); }
        if (d.output_page2) { innerPages.push(d.output_page2); innerScales.push(eff); }
      };

      // Determine mapping from dict order to box which
      let idx = 0;
      if (hasTopBox) { pushPagesWithScale('top', dicts[idx]); idx++; }
      if (hasBottomBox) { pushPagesWithScale('bottom', dicts[idx]); idx++; }
      // Fallback: if no boxes, still allow blank pages (or just abort)
      if (outerPages.length === 0 && innerPages.length === 0) {
        setPdfLoading(false); setPdfProgress(0); setLoading(false); return;
      }
      if (pdfCancelRef.current) throw new Error('PDF_CANCELLED');
      if (mode === 'split-dual') {
        // Legacy behavior, but name as front/back for clarity
        await generatePdfFromPages(innerPages, 2, targetPdfNameFront || 'origami_boxes_front.pdf', innerScales);
        setPdfProgress(70);
        if (pdfCancelRef.current) throw new Error('PDF_CANCELLED');
        await generatePdfFromPages(outerPages, 1, targetPdfNameBack || 'origami_boxes_back.pdf', outerScales);
        setPdfProgress(100);
      } else {
        // New default: single alternating PDF: inner[0], outer[0], inner[1], outer[1], ...
        const mixed: Array<{ dataUrl: string; pageKind: 1 | 2; scale?: number }> = [];
        const maxLen = Math.max(innerPages.length, outerPages.length);
        for (let i = 0; i < maxLen; i++) {
          if (innerPages[i]) mixed.push({ dataUrl: innerPages[i], pageKind: 2, scale: innerScales[i] });
          if (outerPages[i]) mixed.push({ dataUrl: outerPages[i], pageKind: 1, scale: outerScales[i] });
        }
        if (pdfCancelRef.current) throw new Error('PDF_CANCELLED');
        await generatePdfFromPageSequence(mixed, targetPdfName || 'origami_boxes.pdf');
        setPdfProgress(100);
      }
    } catch (err) {
      if ((err as any)?.message === 'PDF_CANCELLED') {
        // Silent cancel
        console.warn('PDF generation cancelled');
      } else {
        console.error(err);
        alert('Failed to generate PDFs: ' + String((err as any)?.message || err));
      }
    } finally {
      setLoading(false);
      // When the operation ends (success or cancel), clear progress and end cancelling state
      setTimeout(() => {
        setPdfLoading(false);
        setPdfProgress(0);
        setPdfCancelling(false);
      }, 300);
    }
  };

  // Allow user to cancel an in-flight PDF generation
  const cancelPdfGeneration = () => {
    pdfCancelRef.current = true;
    // Immediately reflect UI intent: disable button and show "Cancelling..."
    setPdfCancelling(true);
  };

  const getCanvasHeight = () => {
    return Math.max(100, Math.min(500, viewerHeight));
  }

  const getCanvasWidth = () => {
    return getCanvasHeight() * 3 / 4;
  }

  // (Replaced by handleRunThenDownloadDual)

  return (
    <>
      <div className="App">
        {/* Fixed header for all pages */}
        <Header />
        {/* Intro panel: collapsible with persisted state, visually highlighted */}
        <section aria-label="Introduction" style={{ margin: '1em auto 1.25em', maxWidth: 980, width: 'calc(100% - 2em)' }}>
          <div style={{ background: '#181818', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '0.75em 1em', borderBottom: '1px solid rgba(255,255,255,0.08)', borderTopLeftRadius: 12, borderTopRightRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))' }}>
              <button
                className="menu-btn"
                onClick={() => setIntroOpen(v => !v)}
                aria-expanded={introOpen}
                aria-controls="intro-panel"
                title={introOpen ? 'Collapse' : 'Expand'}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {introOpen ? <IoChevronUpCircle style={{ marginLeft: 15, verticalAlign: 'middle' }} /> : <IoChevronDownCircle style={{ marginLeft: 15, verticalAlign: 'middle' }} />}
                {introOpen ? 'Hide' : 'Show'}
              </button>
              <h2 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', margin: 0, color: '#fff', fontSize: '1.05em', fontWeight: 600, textAlign: 'center' }}>Introduction</h2>
            </div>
            {introOpen && (
              <div id="intro-panel" style={{ padding: '0.75em 1em 1em' }}>
                <div className="intro-text" style={{ marginBottom: '0.75em' }}>
                  Build your own Card Deck Box!
                  This tool generates printable templates from your images.
                  Perfect for holding a standard deck of 60 cards.
                </div>
                {/* Intro video: YouTube embed (privacy-enhanced) */}
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: '100%', margin: '0.25em 0 0.25em' }}>
                    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 18px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <iframe
                        title="OrigamiMapper Box Generator Intro"
                        src="https://www.youtube-nocookie.com/embed/E-NGbi4VIIs?rel=0"
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Suggested Mapper Projects placed directly under the Introduction panel (always visible) */}
          <div style={{ marginTop: '0.9em' }}>
            <SuggestedProjects
              onSelect={async (fileUrl: string) => {
                try {
                  const res = await fetch(fileUrl, { cache: 'no-store' });
                  if (!res.ok) throw new Error('Failed to fetch project: ' + res.status);
                  const blob = await res.blob();
                  const urlParts = fileUrl.split('/');
                  const nameGuess = urlParts[urlParts.length - 1] || 'project.mapper';
                  const file = new File([blob], nameGuess, { type: 'application/zip' });
                  await onMapperFileSelected(file);
                } catch (err) {
                  console.warn('Failed to load suggested project', err);
                  alert('Failed to load suggested project: ' + String((err as any)?.message || err));
                }
              }}
            />
          </div>
        </section>

        <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center', justifyContent: 'center', marginBottom: '1em' }}>
          <button onClick={() => saveToMapperFile()} disabled={loading || pdfLoading} className="menu-btn" title="Save project (.mapper)">
            <IoSave style={{ verticalAlign: 'middle', marginRight: 8 }} /> Save
          </button>
          <button onClick={() => mapperInputRef.current?.click()} disabled={loading || pdfLoading} className="menu-btn" title="Load project (.mapper)">
            <IoCloudUpload style={{ verticalAlign: 'middle', marginRight: 8 }} /> Load
          </button>
          <input ref={mapperInputRef} type="file" accept=".mapper,application/zip" style={{ display: 'none' }} onChange={e => onMapperFileSelected(e.target.files?.[0] ?? null)} />
        </div>

        {/* 3D cube preview + 2D Editors (canvases on the left) */}
        <div className="images" style={{ display: 'flex', gap: '2.5em', alignItems: 'flex-start', justifyContent: 'center', width: '100%' }}>
          {/* Left column: Editors and controls */}
          <div ref={viewerFrameRef} style={{ display: 'flex', flexDirection: 'column', gap: '1em', alignItems: 'center', justifyContent: 'flex-start' }}>
            {/* Side filter toggle and create box buttons */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'start' }}>
              <button
                className="menu-btn"
                onClick={() => setSideFilter(sideFilter === 'outside' ? 'inside' : 'outside')}
                title={sideFilter === 'outside' ? 'Show only Inside canvas' : 'Show only Outside canvas'}
                aria-label={sideFilter === 'outside' ? 'Show only Inside canvas' : 'Show only Outside canvas'}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '6px 0px' }}
              >
                <IoSwapHorizontal style={{ verticalAlign: 'middle' }} /> {sideFilter === 'outside' ? 'Outside' : 'Inside'}
              </button>
            </div>

            <div ref={viewerFrameRef} style={{ display: 'flex', flexDirection: 'column', gap: '1em', alignItems: 'center', justifyContent: 'flex-start' }}>


              {/* Top box editors (only when visible by viewMode) */}
              {!hasTopBox && (
                <button className="menu-btn" onClick={() => setHasTopBox(true)}>Create Top Box</button>
              )}
              {hasTopBox && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75em', alignItems: 'center' }} hidden={viewMode === 'bottom'}>
                  <div hidden={sideFilter !== 'outside'}>
                    <PolygonEditor
                      ref={topOutsideEditorRef}
                      zoomGroup={'top'}
                      applyResetTransform={true}
                      onChange={() => scheduleBuildTop()}
                      onOutsave={(json) => { void saveAutosave({ topOutsideJson: json }); }}
                      data={getTopEditorData(false)}
                      label='Top Outside image'
                      backgroundImg={topOutsideImgTransformed}
                      rotation={topOutsideRotation}
                      onRotationChange={(r) => { setTopOutsideRotation(r); transformImage(topOutsideImgRaw, transformMode, r, setTopOutsideImgTransformed); }}
                      onUploadImage={(dataUrl) => { setSuppressAutoDemo(true); setTopOutsideImg(dataUrl); }}
                      onDelete={() => {
                        if (!confirm('Clear top outside image? This cannot be undone.')) return;
                        setTopOutsideImgRaw(''); setTopOutsideImgTransformed(''); scheduleBuildTop(); setSuppressAutoDemo(true);
                        void saveAutosave();
                      }}
                      onDeleteBox={() => {
                        if (!confirm('Delete Top Box? This cannot be undone.')) return;
                        // Clear all Top box images so autosave reflects removal
                        setTopOutsideImgRaw('');
                        setTopOutsideImgTransformed('');
                        setTopInsideImgRaw('');
                        setTopInsideImgTransformed('');
                        // Clear legacy top mirrors used by autosave fallback
                        setOutsideImgTopRaw('');
                        setInsideImgTopRaw('');
                        // Update UI state
                        setHasTopBox(false);
                        setSuppressAutoDemo(true);
                        scheduleBuildTop();
                        void saveAutosave();
                      }}
                      onDeleteBoxNoConfirm={() => {
                        // Same as onDeleteBox but without confirmation (used from Load image placeholder)
                        setTopOutsideImgRaw('');
                        setTopOutsideImgTransformed('');
                        setTopInsideImgRaw('');
                        setTopInsideImgTransformed('');
                        setOutsideImgTopRaw('');
                        setInsideImgTopRaw('');
                        setHasTopBox(false);
                        setSuppressAutoDemo(true);
                        scheduleBuildTop();
                        void saveAutosave();
                      }}
                    />
                  </div>
                  <div hidden={sideFilter !== 'inside'}>
                    <PolygonEditor
                      ref={topInsideEditorRef}
                      zoomGroup={'top'}
                      applyResetTransform={true}
                      onChange={() => scheduleBuildTop()}
                      onOutsave={(json) => { void saveAutosave({ topInsideJson: json }); }}
                      data={getTopEditorData(true)}
                      label='Top Inside image'
                      backgroundImg={topInsideImgTransformed}
                      rotation={topInsideRotation}
                      onRotationChange={(r) => { setTopInsideRotation(r); transformImage(topInsideImgRaw, transformMode, r, setTopInsideImgTransformed); }}
                      onUploadImage={(dataUrl) => { setSuppressAutoDemo(true); setTopInsideImg(dataUrl); }}
                      onDelete={() => {
                        if (!confirm('Clear top inside image? This cannot be undone.')) return;
                        setTopInsideImgRaw(''); setTopInsideImgTransformed(''); scheduleBuildTop(); setSuppressAutoDemo(true);
                        void saveAutosave();
                      }}
                      onDeleteBox={() => {
                        if (!confirm('Delete Top Box? This cannot be undone.')) return;
                        // Clear all Top box images so autosave reflects removal
                        setTopOutsideImgRaw('');
                        setTopOutsideImgTransformed('');
                        setTopInsideImgRaw('');
                        setTopInsideImgTransformed('');
                        // Clear legacy top mirrors used by autosave fallback
                        setOutsideImgTopRaw('');
                        setInsideImgTopRaw('');
                        // Update UI state
                        setHasTopBox(false);
                        setSuppressAutoDemo(true);
                        scheduleBuildTop();
                        void saveAutosave();
                      }}
                      onDeleteBoxNoConfirm={() => {
                        setTopOutsideImgRaw('');
                        setTopOutsideImgTransformed('');
                        setTopInsideImgRaw('');
                        setTopInsideImgTransformed('');
                        setOutsideImgTopRaw('');
                        setInsideImgTopRaw('');
                        setHasTopBox(false);
                        setSuppressAutoDemo(true);
                        scheduleBuildTop();
                        void saveAutosave();
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
                      let newBottomOut: string | null = null;
                      if (topOutsideImgRaw) {
                        const rotated = deltaOut ? await rotateDataUrlDegrees(topOutsideImgRaw, deltaOut) : topOutsideImgRaw;
                        newBottomOut = rotated;
                        setOutsideImgBottomRaw(rotated);
                      }
                      const srcOut = topOutsideEditorRef.current?.getCurrentJson().input_polygons ?? [];
                      if (outsideEditorRef.current) {
                        const target = outsideEditorRef.current.getCurrentJson().input_polygons;
                        const newBottomOutsideJson = { ...getEditorData(false), input_polygons: mirrorOutsidePolygons(srcOut, target) };
                        outsideEditorRef.current.setFromJson(newBottomOutsideJson);
                        // Save immediately with overrides so autosave reflects mirrored image and polygons
                        void saveAutosave({
                          outsideJson: newBottomOutsideJson,
                          topOutsideJson: topOutsideEditorRef.current?.getCurrentJson() ?? null,
                          overrideRaw: { outsideBottom: newBottomOut }
                        });
                      }
                    } else if (sideFilter === 'inside') {
                      // Pre-rotate raw inside image by rotation delta so bottom keeps its own rotation state
                      const deltaIn = (((topInsideRotation - insideRotation) % 360) + 360) % 360 as 0 | 90 | 180 | 270;
                      let newBottomIn: string | null = null;
                      if (topInsideImgRaw) {
                        const rotated = deltaIn ? await rotateDataUrlDegrees(topInsideImgRaw, deltaIn) : topInsideImgRaw;
                        newBottomIn = rotated;
                        setInsideImgBottomRaw(rotated);
                      }
                      const srcIn = topInsideEditorRef.current?.getCurrentJson().input_polygons ?? [];
                      if (insideEditorRef.current) {
                        const target = insideEditorRef.current.getCurrentJson().input_polygons;
                        const newBottomInsideJson = { ...getEditorData(true), input_polygons: mirrorInsidePolygons(srcIn, target) };
                        insideEditorRef.current.setFromJson(newBottomInsideJson);
                        void saveAutosave({
                          insideJson: newBottomInsideJson,
                          topInsideJson: topInsideEditorRef.current?.getCurrentJson() ?? null,
                          overrideRaw: { insideBottom: newBottomIn }
                        });
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
                      let newTopOut: string | null = null;
                      if (outsideImgBottomRaw) {
                        const rotated = deltaOut ? await rotateDataUrlDegrees(outsideImgBottomRaw, deltaOut) : outsideImgBottomRaw;
                        newTopOut = rotated;
                        setTopOutsideImg(rotated);
                      }
                      const srcOut = outsideEditorRef.current?.getCurrentJson().input_polygons ?? [];
                      if (topOutsideEditorRef.current) {
                        const target = topOutsideEditorRef.current.getCurrentJson().input_polygons;
                        const newTopOutsideJson = { ...getTopEditorData(false), input_polygons: mirrorOutsidePolygons(srcOut, target) };
                        topOutsideEditorRef.current.setFromJson(newTopOutsideJson);
                        void saveAutosave({
                          outsideJson: outsideEditorRef.current?.getCurrentJson() ?? null,
                          topOutsideJson: newTopOutsideJson,
                          overrideRaw: { outsideTop: newTopOut }
                        });
                      }
                    } else if (sideFilter === 'inside') {
                      // Pre-rotate raw inside image by rotation delta so top keeps its own rotation state
                      const deltaIn = (((insideRotation - topInsideRotation) % 360) + 360) % 360 as 0 | 90 | 180 | 270;
                      let newTopIn: string | null = null;
                      if (insideImgBottomRaw) {
                        const rotated = deltaIn ? await rotateDataUrlDegrees(insideImgBottomRaw, deltaIn) : insideImgBottomRaw;
                        newTopIn = rotated;
                        setTopInsideImg(rotated);
                      }
                      const srcIn = insideEditorRef.current?.getCurrentJson().input_polygons ?? [];
                      if (topInsideEditorRef.current) {
                        const target = topInsideEditorRef.current.getCurrentJson().input_polygons;
                        const newTopInsideJson = { ...getTopEditorData(true), input_polygons: mirrorInsidePolygons(srcIn, target) };
                        topInsideEditorRef.current.setFromJson(newTopInsideJson);
                        void saveAutosave({
                          insideJson: insideEditorRef.current?.getCurrentJson() ?? null,
                          topInsideJson: newTopInsideJson,
                          overrideRaw: { insideTop: newTopIn }
                        });
                      }
                    }
                    // Build once after mirroring
                    scheduleBuildTop();
                  }} title="Top mirrors from Bottom">↑</button>
                </div>
              )}

              {/* Bottom box editors (only when visible by viewMode) */}
              {!hasBottomBox && (
                <button className="menu-btn" onClick={() => setHasBottomBox(true)}>Create Bottom Box</button>
              )}
              {hasBottomBox && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75em', alignItems: 'center' }} hidden={viewMode === 'top'}>
                  <div hidden={sideFilter !== 'outside'}>
                    <PolygonEditor
                      ref={outsideEditorRef}
                      zoomGroup={'bottom'}
                      applyResetTransform={true}
                      onChange={json => scheduleBuildBottom(json.input_polygons, undefined)}
                      onOutsave={(json) => { void saveAutosave({ outsideJson: json }); }}
                      data={getEditorData(false)}
                      label='Bottom Outside image'
                      backgroundImg={outsideImgTransformed}
                      rotation={outsideRotation}
                      onRotationChange={(r) => { setOutsideRotation(r); transformImage(outsideImgBottomRaw, transformMode, r, setOutsideImgTransformed); }}
                      onUploadImage={(dataUrl) => { setSuppressAutoDemo(true); setOutsideImg(dataUrl, false); }}
                      onDelete={() => {
                        if (!confirm('Clear bottom outside image? This cannot be undone.')) return;
                        setOutsideImgBottomRaw(''); setOutsideImgTransformed(''); scheduleBuildBottom([], undefined); setSuppressAutoDemo(true);
                        void saveAutosave();
                      }}
                      onDeleteBox={() => {
                        if (!confirm('Delete Bottom Box (both canvases)? This cannot be undone.')) return;
                        // Clear all Bottom box images so autosave reflects removal
                        setOutsideImgBottomRaw('');
                        setOutsideImgTransformed('');
                        setInsideImgBottomRaw('');
                        setInsideImgTransformed('');
                        // Update UI state
                        setHasBottomBox(false);
                        setSuppressAutoDemo(true);
                        scheduleBuildBottom([], []);
                        void saveAutosave();
                      }}
                      onDeleteBoxNoConfirm={() => {
                        setOutsideImgBottomRaw('');
                        setOutsideImgTransformed('');
                        setInsideImgBottomRaw('');
                        setInsideImgTransformed('');
                        setHasBottomBox(false);
                        setSuppressAutoDemo(true);
                        scheduleBuildBottom([], []);
                        void saveAutosave();
                      }}
                    />
                  </div>
                  <div hidden={sideFilter !== 'inside'}>
                    <PolygonEditor
                      ref={insideEditorRef}
                      zoomGroup={'bottom'}
                      applyResetTransform={true}
                      onChange={json => scheduleBuildBottom(undefined, json.input_polygons)}
                      onOutsave={(json) => { void saveAutosave({ insideJson: json }); }}
                      data={getEditorData(true)}
                      label='Bottom Inside image'
                      backgroundImg={insideImgTransformed}
                      rotation={insideRotation}
                      onRotationChange={(r) => { setInsideRotation(r); transformImage(insideImgBottomRaw, transformMode, r, setInsideImgTransformed); }}
                      onUploadImage={(dataUrl) => { setSuppressAutoDemo(true); setInsideImg(dataUrl, false); }}
                      onDelete={() => {
                        if (!confirm('Clear bottom inside image? This cannot be undone.')) return;
                        setInsideImgBottomRaw(''); setInsideImgTransformed(''); scheduleBuildBottom(undefined, []); setSuppressAutoDemo(true);
                        void saveAutosave();
                      }}
                      onDeleteBox={() => {
                        if (!confirm('Delete Bottom Box (both canvases)? This cannot be undone.')) return;
                        // Clear all Bottom box images so autosave reflects removal
                        setOutsideImgBottomRaw('');
                        setOutsideImgTransformed('');
                        setInsideImgBottomRaw('');
                        setInsideImgTransformed('');
                        // Update UI state
                        setHasBottomBox(false);
                        setSuppressAutoDemo(true);
                        scheduleBuildBottom([], []);
                        void saveAutosave();
                      }}
                      onDeleteBoxNoConfirm={() => {
                        setOutsideImgBottomRaw('');
                        setOutsideImgTransformed('');
                        setInsideImgBottomRaw('');
                        setInsideImgTransformed('');
                        setHasBottomBox(false);
                        setSuppressAutoDemo(true);
                        scheduleBuildBottom([], []);
                        void saveAutosave();
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
          </div>

          {/* Right column: Cube viewer with toolbar and open slider */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gridTemplateRows: 'auto auto', justifyContent: 'stretch', alignItems: 'stretch', gap: 12}}>
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
                    const ratio = topBottomRatio; // -50..50
                    const topFactor = ratio < 0 ? (-ratio) / 50 : 0;    // fraction to reduce Top
                    const bottomFactor = ratio > 0 ? (ratio) / 50 : 0;  // fraction to reduce Bottom
                    const previewTopScale = 1 - topFactor;
                    const previewBottomScale = 1 - bottomFactor;
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <div style={{ color: '#fff', fontSize: '0.8em', marginTop: 8 }}>Open Box</div>
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
                <div style={{ color: '#fff', fontSize: '0.8em' }} title={"Adjust relative scale: negative values reduce Top, positive values reduce Bottom. 0 is neutral."}>
                  Top-Bottom ratio: {topBottomRatio}
                </div>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  step={1}
                  value={topBottomRatio}
                  onChange={e => setTopBottomRatio(Number(e.target.value))}
                  aria-label="Top-Bottom ratio"
                  title={"< 0 reduces Top, > 0 reduces Bottom, 0 is neutral."}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Settings first, then a horizontal scrollable Reference gallery */}
        {(() => {
          // Build asset URLs using Vite base path so it works in dev and production (GH Pages)
          const basePath = (import.meta as any).env?.BASE_URL || '/';
          const refOutsideTop = basePath + 'assets/reference_outside_top.png';
          const refOutsideBottom = basePath + 'assets/reference_outside_bottom.png';
          const refInside = basePath + 'assets/reference_inside.png';
          return (
            <div style={{ marginTop: '3em', marginBottom: '2em' }}>
              {/* Uploads are handled inside each PolygonEditor to avoid duplicate inputs */}
              <section className="template-run-card" style={{ background: '#181818', borderRadius: '12px', padding: '1em', margin: '0 auto', maxWidth: 400, boxShadow: '0 2px 12px #0006', display: 'flex', flexDirection: 'column', gap: '1em', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.75em', width: '100%', alignItems: 'start', justifyItems: 'start', flexWrap: 'wrap' }}>
                  {SHOW_TEMPLATES && <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'start' }}>
                    <TemplateSelect onTemplate={setTemplate} />
                  </div>}
                  {SHOW_TRANSFORMS && <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'start', gap: '0.5em' }}>
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
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5em', width: '100%' }}>
                    <span style={{ color: '#fff' }}>Output DPI:</span>
                    <select value={outputDpi} onChange={e => setOutputDpi(Number(e.target.value))} style={{ padding: '0.3em', borderRadius: '6px', minWidth: '80px' }}>
                      <option value={200}>200</option>
                      <option value={300}>300</option>
                      <option value={600}>600</option>
                    </select>
                  </div>
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
                        step={0.5}
                        value={scalePercent}
                        onChange={e => {
                          const v = Math.max(0, Number(e.target.value));
                          setScalePercent(v);
                        }}
                        title={"Reduce the box size by this percentage. The value is applied to each side of the page when generating the PDF."}
                        aria-label={"Reduce the box size by percentage"}
                        style={{ width: '85%' }}
                      />
                    </div>
                    {/* Printed area growth slider */}
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5em' }}>
                      <div
                        title={"Expands the printed areas by this percentage of the page/image max dimension. It is best to print a little more than needed to counteract inacurracies while cutting or folding the sheet."}
                        style={{ color: '#fff', fontSize: '0.9em' }}
                      >
                        Printed area growth: {triangleOffsetPct}%
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={20}
                        step={1}
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
                    <div style={{ display: 'flex', gap: '1em', width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: '0.5em' }}>
                      {SHOW_RUN_MAPPING &&
                        <button onClick={() => handleRun(false)} disabled={loading || pdfLoading} className="menu-btn">
                          {loading ? 'Processing...' : 'Run Mapping'}
                        </button>}
                      <button
                        style={{ alignSelf: 'center' }}
                        onClick={() => {
                          if (pdfLoading && !pdfCancelling) {
                            cancelPdfGeneration();
                          } else {
                            void handleRunThenDownloadDual();
                          }
                        }}
                        className="menu-btn"
                        disabled={pdfCancelling}
                      >
                        {pdfCancelling ? 'Cancelling...' : (pdfLoading ? 'Cancel' : 'Download')}
                      </button>
                    </div>
                  </div>
                  {(pdfLoading || pdfProgress > 0) && (
                    <div style={{ width: '90%', maxWidth: 360, marginTop: 8 }}>
                      <div style={{ height: 10, background: '#2b2b2b', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ width: `${pdfProgress}%`, height: '100%', background: '#4caf50', transition: 'width 200ms ease' }} />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Horizontal scrollable references gallery */}
              <section className="reference-scroller" aria-label="Reference images">
                <figure className="reference-card">
                  <a href={refOutsideTop} download={"reference_outside_top.png"} title="Download Outside Top reference">
                    <img src={refOutsideTop} alt="Outside Top Reference" />
                  </a>
                  <figcaption>Outside Reference Top</figcaption>
                </figure>
                <figure className="reference-card">
                  <a href={refOutsideBottom} download={"reference_outside_bottom.png"} title="Download Outside Bottom reference">
                    <img src={refOutsideBottom} alt="Outside Bottom Reference" />
                  </a>
                  <figcaption>Outside Reference Bottom</figcaption>
                </figure>
                <figure className="reference-card">
                  <a href={refInside} download={"reference_inside.png"} title="Download Inside reference">
                    <img src={refInside} alt="Inside Reference" />
                  </a>
                  <figcaption>Inside Reference</figcaption>
                </figure>
              </section>
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
