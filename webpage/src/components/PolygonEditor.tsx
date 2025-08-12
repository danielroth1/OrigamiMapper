import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import type { OrigamiMapperTypes } from '../OrigamiMapperTypes';

export interface PolygonEditorHandle {
  getCurrentJson: () => OrigamiMapperTypes.TemplateJson;
}

interface PolygonEditorProps {
  data: OrigamiMapperTypes.TemplateJson;
  backgroundImg?: string;
  label: string;
}

const PolygonEditor = forwardRef<PolygonEditorHandle, PolygonEditorProps>(({ data, backgroundImg, label }, ref) => {
  // Track Shift key globally
  const shiftPressedRef = useRef(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftPressedRef.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftPressedRef.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  const mountRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const a4PlaneRef = useRef<THREE.Mesh | null>(null);
  const [polygons, setPolygons] = useState<OrigamiMapperTypes.Polygon[]>(data.input_polygons);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionRect, setSelectionRect] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const selectionRectRef = useRef<null | { x: number; y: number; w: number; h: number }>(null);
  useEffect(() => { selectionRectRef.current = selectionRect; }, [selectionRect]);
  const groupsRef = useRef<Map<string, THREE.Group>>(new Map());
  const polygonsRef = useRef(polygons);
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => { polygonsRef.current = polygons; }, [polygons]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  type TransformMode = 'idle' | 'select' | 'move' | 'scale' | 'rotate';
  interface TransformState {
    mode: TransformMode;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    originalPolygons: OrigamiMapperTypes.Polygon[]; // snapshot of polygons at start for selected
    bboxCenter: { x: number; y: number }; // pixel coords
    initialAngle?: number; // for rotation
    scaleStartDistance?: number; // optional alternative future use
  }
  const transformStateRef = useRef<TransformState | null>(null);

  const width = 180;
  const height = (297 / 210) * width;

  // Setup scene/camera/renderer once on mount, cleanup on unmount
  useEffect(() => {
    // Clean up any previous canvas/renderer/scene (defensive if remounting)
    if (rendererRef.current && mountRef.current) {
      if (mountRef.current.contains(rendererRef.current.domElement)) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
    sceneRef.current = null;
    cameraRef.current = null;
    a4PlaneRef.current = null;

    // Create new scene/camera/renderer first so we can safely attach listeners
    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0xf0f0f0);
    cameraRef.current = new THREE.OrthographicCamera(0, width, height, 0, 1, 1000);
    cameraRef.current.position.z = 500;
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    rendererRef.current.setSize(width, height);
    rendererRef.current.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current.toneMapping = THREE.NoToneMapping;
    if (mountRef.current) {
      mountRef.current.appendChild(rendererRef.current.domElement);
    }
    const a4Geometry = new THREE.PlaneGeometry(width, height);
    let a4Material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    a4PlaneRef.current = new THREE.Mesh(a4Geometry, a4Material);
    a4PlaneRef.current.position.set(width / 2, height / 2, -1);
    sceneRef.current.add(a4PlaneRef.current);

    // Helper functions for interaction (use refs for live state)
    const getPolygonBBox = (poly: OrigamiMapperTypes.Polygon) => {
      // Treat internal coordinates as origin top-left, y increasing downward
      const xs = poly.vertices.map(v => v[0] * width);
      const ys = poly.vertices.map(v => v[1] * height);
      const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
      return { minX, maxX, minY, maxY };
    };
    const pointInBBox = (x: number, y: number, b: { minX: number; maxX: number; minY: number; maxY: number }) => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
    const getGroupIds = (id: string): string[] => {
      const prefix = id.split('_')[0];
      return polygonsRef.current.filter(p => p.id === prefix || p.id.startsWith(prefix + '_') || p.id.startsWith(prefix) && p.id.includes('_')).filter(p => p.id.split('_')[0] === prefix).map(p => p.id);
    };
    const getCombinedBBox = (ids: Set<string>) => {
      if (ids.size === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      polygonsRef.current.forEach(p => {
        if (ids.has(p.id)) {
          const b = getPolygonBBox(p);
          minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY); maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
        }
      });
      return { minX, minY, maxX, maxY };
    };
    const canvasEl = rendererRef.current!.domElement;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const rect = canvasEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const currentSelectedBBox = getCombinedBBox(selectedIdsRef.current);
      // Decide mode
      let mode: TransformMode = 'idle';
      if (e.shiftKey) mode = 'scale';
      else if (e.ctrlKey || e.metaKey) mode = 'rotate';
      else {
        // Prioritize selected bbox
        if (currentSelectedBBox && pointInBBox(x, y, currentSelectedBBox)) {
          mode = 'move';
        } else {
          // Find any polygon containing point (bbox test)
          const hitPoly = polygonsRef.current.find(p => pointInBBox(x, y, getPolygonBBox(p)));
          if (hitPoly) {
            // Select its group
            const groupIds = new Set(getGroupIds(hitPoly.id));
            setSelectedIds(groupIds);
            mode = 'move';
          } else {
            // Start selection rectangle
            mode = 'select';
            const startRect = { x, y, w: 0, h: 0 };
            setSelectionRect(startRect);
            selectionRectRef.current = startRect;
          }
        }
      }
      const bbox = getCombinedBBox(selectedIdsRef.current.size ? selectedIdsRef.current : new Set());
      let center = { x: width / 2, y: height / 2 };
      if (selectedIdsRef.current.size && bbox) {
        center = { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 };
      }
      // For rotation initial angle
      const initialAngle = Math.atan2(y - center.y, x - center.x);
      transformStateRef.current = {
        mode,
        startX: x,
        startY: y,
        lastX: x,
        lastY: y,
        originalPolygons: polygonsRef.current.map(p => ({ ...p, vertices: p.vertices.map(v => [...v] as [number, number]) })),
        bboxCenter: center,
        initialAngle
      };
    };
    const handleMouseMove = (e: MouseEvent) => {
      const state = transformStateRef.current;
      if (!state) return;
      const rect = canvasEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = x - state.startX;
      const dy = y - state.startY;
      
      // Allow dynamic mode switching while dragging
      if (state.mode !== 'select') {
        let desiredMode: TransformMode = state.mode;
        if (e.shiftKey) desiredMode = 'scale';
        else if (e.ctrlKey || e.metaKey) desiredMode = 'rotate';
        else desiredMode = 'move';
        if (desiredMode !== state.mode) {
          // Reset reference snapshot when switching modes
          const selectedSnapshot = polygonsRef.current.map(p => ({ ...p, vertices: p.vertices.map(v => [...v] as [number, number]) }));
          // Recompute bbox center
          const getCombinedBBox = (ids: Set<string>) => {
            if (ids.size === 0) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            polygonsRef.current.forEach(p => {
              if (selectedIdsRef.current.has(p.id)) {
                const xs = p.vertices.map(v => v[0] * width);
                const ys = p.vertices.map(v => (1 - v[1]) * height);
                const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
                minX = Math.min(minX, minx); maxX = Math.max(maxX, maxx); minY = Math.min(minY, miny); maxY = Math.max(maxY, maxy);
              }
            });
            return { minX, minY, maxX, maxY };
          };
          const bbox = getCombinedBBox(selectedIdsRef.current);
          let center = { x: width / 2, y: height / 2 };
          if (bbox) center = { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 };
          state.mode = desiredMode;
          state.originalPolygons = selectedSnapshot;
          state.startX = x; state.startY = y; // reset deltas to avoid jump
          state.lastX = x; state.lastY = y;
          state.bboxCenter = center;
          state.initialAngle = Math.atan2(y - center.y, x - center.x);
        }
      }
      if (state.mode === 'select' && selectionRectRef.current) {
        const start = selectionRectRef.current;
        const newRect = { x: start.x, y: start.y, w: x - start.x, h: y - start.y };
        setSelectionRect(newRect); // triggers UI update
        selectionRectRef.current = newRect; // keep ref in sync for subsequent moves
        // Normalize rect to compute selection
        const rx = newRect.w < 0 ? newRect.x + newRect.w : newRect.x;
        const ry = newRect.h < 0 ? newRect.y + newRect.h : newRect.y;
        const rw = Math.abs(newRect.w);
        const rh = Math.abs(newRect.h);
        const sel = new Set<string>();
        polygonsRef.current.forEach(p => {
          const b = getPolygonBBox(p);
          // Check if bbox intersects selection rectangle
          const rectMinX = rx, rectMaxX = rx + rw, rectMinY = ry, rectMaxY = ry + rh;
          const intersects =
            b.maxX >= rectMinX && b.minX <= rectMaxX &&
            b.maxY >= rectMinY && b.minY <= rectMaxY;
          if (intersects) {
            getGroupIds(p.id).forEach(id => sel.add(id));
          }
        });
        setSelectedIds(sel);
        return;
      }
      if (!selectedIdsRef.current.size) return;
      if (state.mode === 'move') {
        const ndx = dx / width;
        const ndy = dy / height; // screen positive downwards
        // compute clamped delta so selection stays inside canvas
        const origMap = new Map(state.originalPolygons.map(p => [p.id, p]))
        const working = polygonsRef.current.map(p => {
          if (selectedIdsRef.current.has(p.id)) {
            const orig = origMap.get(p.id)!;
            const verts = orig.vertices.map(([vx, vy]) => [vx + ndx, vy + ndy] as [number, number]);
            return { ...p, vertices: verts };
          }
          return p;
        });
        setPolygons(working);
      } else if (state.mode === 'scale') {
        let scale = 1 + (dy) / 100; // down enlarges
        scale = Math.max(0.1, Math.min(10, scale));
        const centerNorm = { x: state.bboxCenter.x / width, y: state.bboxCenter.y / height };
        const origMap = new Map(state.originalPolygons.map(p => [p.id, p]));
        const updated = polygonsRef.current.map(p => {
          if (selectedIdsRef.current.has(p.id)) {
            const orig = origMap.get(p.id)!;
            const verts = orig.vertices.map(([vx, vy]) => {
              const nx = centerNorm.x + (vx - centerNorm.x) * scale;
              const ny = centerNorm.y + (vy - centerNorm.y) * scale;
              return [nx, ny] as [number, number];
            });
            return { ...p, vertices: verts };
          }
          return p;
        });
        setPolygons(updated);
      } else if (state.mode === 'rotate') {
        // Relative cumulative rotation: rotate current vertices by incremental delta
        const centerPixel = { x: state.bboxCenter.x, y: state.bboxCenter.y };
        const prevAngle = Math.atan2(state.lastY - centerPixel.y, state.lastX - centerPixel.x);
        const currAngle = Math.atan2(y - centerPixel.y, x - centerPixel.x);
        let deltaAngle = currAngle - prevAngle;
        if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
        else if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
        const cosA = Math.cos(deltaAngle);
        const sinA = Math.sin(deltaAngle);
        const updated = polygonsRef.current.map(p => {
          if (!selectedIdsRef.current.has(p.id)) return p;
          const verts = p.vertices.map(([vx, vy]) => {
            const px = vx * width;
            const py = vy * height;
            const ox = px - centerPixel.x;
            const oy = py - centerPixel.y;
            const rx = ox * cosA - oy * sinA;
            const ry = ox * sinA + oy * cosA;
            const npx = rx + centerPixel.x;
            const npy = ry + centerPixel.y;
            return [npx / width, npy / height] as [number, number];
          });
          return { ...p, vertices: verts };
        });
        setPolygons(updated);
      }
      state.lastX = x; state.lastY = y;
    };
    const handleMouseUp = () => {
      if (transformStateRef.current?.mode === 'select') {
        // selection already applied during drag
      }
      setSelectionRect(null);
      transformStateRef.current = null;
    };
    canvasEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      rendererRef.current!.render(sceneRef.current!, cameraRef.current!);
    };
    animate();

    return () => {
      if (mountRef.current && rendererRef.current) {
        if (mountRef.current.contains(rendererRef.current.domElement)) {
          mountRef.current.removeChild(rendererRef.current.domElement);
        }
      }
      rendererRef.current?.domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Update background image texture/material when backgroundImg changes
  useEffect(() => {
    if (!a4PlaneRef.current) return;
    if (backgroundImg) {
      const loader = new THREE.TextureLoader();
      loader.load(backgroundImg, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        (a4PlaneRef.current!.material as THREE.MeshBasicMaterial).map = texture;
        (a4PlaneRef.current!.material as THREE.MeshBasicMaterial).needsUpdate = true;
      });
    } else {
      (a4PlaneRef.current.material as THREE.MeshBasicMaterial).map = null;
      (a4PlaneRef.current.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
  }, [backgroundImg]);

  // Update polygon meshes/groups and drag controls when polygons change
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!scene || !camera || !renderer) return;

    // Remove old polygon groups (keep a4Plane)
    scene.children = scene.children.filter(obj => obj === a4PlaneRef.current);
    groupsRef.current.clear();

    // Create mapping from fillMesh to outline
    const fillToOutlineMap = new Map<THREE.Mesh, Line2>();

    const polygonGroups = polygons.map(polygon => {
      const shape = new THREE.Shape();
      polygon.vertices.forEach((v, i) => {
        // Flip y-axis so origin is top-left
        const x = v[0] * width;
        const y = (1 - v[1]) * height;
        if (i === 0) {
          shape.moveTo(x, y);
        } else {
          shape.lineTo(x, y);
        }
      });
      shape.closePath();

      const fillGeometry = new THREE.ShapeGeometry(shape);
      const isSelected = selectedIds.has(polygon.id);
      const fillMaterial = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xffaa00 : 0x2194ce,
        opacity: isSelected ? 0.6 : 0.4,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);

      const points = shape.getPoints();
      // Convert points to flat array for LineGeometry
      const positions = points.map(p => [p.x, p.y, 0]).flat();
      const outlineGeometry = new LineGeometry();
      outlineGeometry.setPositions(positions);
      const outlineMaterial = new LineMaterial({
        color: 0x000000,
        linewidth: 2, // in world units
        dashed: false,
      });
      outlineMaterial.resolution.set(window.innerWidth, window.innerHeight); // required for LineMaterial
      const outline = new Line2(outlineGeometry, outlineMaterial);

      fillToOutlineMap.set(fillMesh, outline);

      const group = new THREE.Group();
      group.add(fillMesh);
      group.add(outline);
      group.userData = { id: polygon.id };
      groupsRef.current.set(polygon.id, group);

      return { group, fillMesh };
    });

    polygonGroups.forEach(({ group }) => {
      scene.add(group);
    });

    return () => { };
  }, [polygons, selectedIds]);

  // Expose getCurrentJson to parent via ref
  useImperativeHandle(ref, () => ({
    getCurrentJson: () => ({
      ...data,
      input_polygons: polygons
    })
  }), [data, polygons]);

  const handleExport = () => {
    const output = { ...data, input_polygons: polygons };
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'box_modified.json';
    link.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.input_polygons) {
          setPolygons(json.input_polygons);
        }
      } catch (err) {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div style={{ textAlign: 'center', position: 'relative' }}>
      <div style={{ color: '#fff', fontSize: '1em', marginBottom: '0.3em' }}>{label}</div>
      <div ref={mountRef} style={{ maxWidth: '180px', position: 'relative' }}>
        {selectionRect && (
          <div style={{
            position: 'absolute',
            left: Math.min(selectionRect.x, selectionRect.x + selectionRect.w),
            top: Math.min(selectionRect.y, selectionRect.y + selectionRect.h),
            width: Math.abs(selectionRect.w),
            height: Math.abs(selectionRect.h),
            border: '1px dashed #ff8800',
            background: 'rgba(255,136,0,0.1)',
            pointerEvents: 'none'
          }} />
        )}
      </div>
      <div style={{ marginTop: '0.5em', display: 'flex', gap: '0.5em', justifyContent: 'center' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()}>Import</button>
        <button onClick={handleExport}>Export</button>
        <button type="button" onClick={() => { setPolygons(data.input_polygons); setSelectedIds(new Set()); }}>Reset</button>
      </div>
      <div style={{ fontSize: '0.65em', color: '#aaa', marginTop: '0.4em', lineHeight: 1.2, maxWidth: '180px', wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
        Drag to move (auto group).
        Shift+Drag scale.
        Ctrl/Cmd+Drag rotate.
        Drag empty area to marquee select.
      </div>
      {/* <div style={{ fontSize: '0.8em', color: '#888', marginTop: '0.5em' }}>
        Hold <b>Shift</b> and drag mouse up/down to scale polygon group
      </div> */}
    </div>
  );
});

export default PolygonEditor;
