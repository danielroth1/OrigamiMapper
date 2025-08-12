import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { DragControls } from 'three/examples/jsm/controls/DragControls.js';
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
  const dragControlsRef = useRef<DragControls | null>(null);
  const [polygons, setPolygons] = useState<OrigamiMapperTypes.Polygon[]>(data.input_polygons);
  // Scaling state
  const [scaling, setScaling] = useState<{ group: THREE.Group | null, startY: number, startScale: number } | null>(null);

  const width = 180;
  const height = (297 / 210) * width;

  // Setup scene/camera/renderer once on mount, cleanup on unmount
  useEffect(() => {
    // Mouse event handlers for scaling
    const handleMouseDown = (e: MouseEvent) => {
      if (e.shiftKey && e.button === 0) {
        // Find group under mouse
        const rect = rendererRef.current!.domElement.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        // Raycast to find group
        const pointer = new THREE.Vector2(mouseX / width * 2 - 1, -(mouseY / height * 2 - 1));
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, cameraRef.current!);
        const intersects = raycaster.intersectObjects(sceneRef.current!.children, true);
        const group = intersects.find(obj => obj.object.parent && obj.object.parent.type === 'Group')?.object.parent as THREE.Group;
        if (group) {
          setScaling({ group, startY: e.clientY, startScale: group.scale.x });
        }
      }
    };
    const handleMouseUp = () => {
      setScaling(null);
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (scaling && scaling.group) {
        const deltaY = e.clientY - scaling.startY;
        // Scale factor: down = larger, up = smaller
        let scale = scaling.startScale * (1 + deltaY / 100);
        scale = Math.max(0.1, Math.min(10, scale));
        scaling.group.scale.set(scale, scale, 1);
        // Optionally: update vertices in state for export
        // Get centroid
        const id = scaling.group.userData.id as string;
        const poly = polygons.find(p => p.id === id);
        if (poly) {
          const verts = poly.vertices;
          const cx = verts.reduce((sum, v) => sum + v[0], 0) / verts.length;
          const cy = verts.reduce((sum, v) => sum + v[1], 0) / verts.length;
          const newVerts = verts.map(([x, y]) => {
            const newX = cx + (x - cx) * scale / scaling.startScale;
            const newY = cy + (y - cy) * scale / scaling.startScale;
            return [newX, newY] as [number, number];
          });
          setPolygons(polygons.map(p => p.id === id ? { ...p, vertices: newVerts as [number, number][] } : p));
        }
      }
    };
    rendererRef.current?.domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);

    // Clean up any previous canvas/renderer/scene
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

    // Create new scene/camera/renderer
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
    a4PlaneRef.current.position.set(width / 2, height / 2, -1); // z = -1 to ensure it's behind polygons
    sceneRef.current.add(a4PlaneRef.current);

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
      if (dragControlsRef.current) {
        dragControlsRef.current.dispose();
      }
      rendererRef.current?.domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
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
      const fillMaterial = new THREE.MeshBasicMaterial({
        color: 0x2194ce,
        opacity: 0.4,
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

      return { group, fillMesh };
    });

    polygonGroups.forEach(({ group }) => {
      scene.add(group);
    });

    // Remove previous drag controls
    if (dragControlsRef.current) {
      dragControlsRef.current.dispose();
    }

    dragControlsRef.current = new DragControls(
      polygonGroups.map(({ fillMesh }) => fillMesh),
      camera,
      renderer.domElement
    );
    const dragControls = dragControlsRef.current;

    // Scaling state for drag
    let dragScaling = null as null | {
      group: THREE.Group,
      startY: number,
      startScale: number,
      id: string,
      verts: [number, number][][], // array of arrays for each polygon in group
      currentScale: number,
      startPosition: THREE.Vector3,
      prefix: string
    };

    const scalePolygons = (id: string, fillMesh: THREE.Mesh, cx: number, cy: number, scale: number, polygonGroup: typeof dragScaling) => {
      if (!polygonGroup) return;
      const polyIdx = polygons.filter(pp => pp.id.startsWith(polygonGroup.prefix + '_')).findIndex(pp => pp.id === id);
      const verts = polygonGroup.verts[polyIdx];
      if (!verts) return;
      const scaledVerts = verts.map(([x, y]) => {
        const newX = cx + (x - cx) * scale / polygonGroup.startScale;
        const newY = cy + (y - cy) * scale / polygonGroup.startScale;
        return [newX, newY] as [number, number];
      });
      // Update mesh geometry
      const shape = new THREE.Shape();
      scaledVerts.forEach((v, i) => {
        const px = v[0] * width;
        const py = (1 - v[1]) * height;
        if (i === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      });
      shape.closePath();
      fillMesh.geometry.dispose();
      fillMesh.geometry = new THREE.ShapeGeometry(shape);
      fillMesh.position.copy(polygonGroup.startPosition);
      // Update outline
      const outline = fillToOutlineMap.get(fillMesh);
      if (outline) {
        const points = shape.getPoints();
        const positions = points.map(p => [p.x, p.y, 0]).flat();
        outline.position.copy(polygonGroup.startPosition);
        outline.geometry.dispose();
        outline.geometry = new LineGeometry();
        (outline.geometry as LineGeometry).setPositions(positions);
      }
    };

    dragControls.addEventListener('dragstart', (event) => {
      if (shiftPressedRef.current) {
        const mesh = event.object as THREE.Mesh;
        const group = mesh.parent as THREE.Group;
        const id = group.userData.id as string;
        const prefix = id.split('_')[0];
        let groupPolys = polygons.filter(p => p.id.startsWith(prefix + '_'));
        // If only one polygon matches, treat it as a group of one
        if (groupPolys.length === 0) {
          groupPolys = [polygons.find(p => p.id === id)!];
        }
        dragScaling = {
          group,
          startY: mesh.position.y,
          startScale: group.scale.x,
          id,
          verts: groupPolys.map(p => p.vertices.map(([x, y]) => [x, y]) as [number, number][]),
          currentScale: group.scale.x,
          startPosition: mesh.position.clone(),
          prefix
        };
      }
    });

    dragControls.addEventListener('drag', (event) => {
      if (shiftPressedRef.current && dragScaling) {
        // Scale mode
        const mesh = event.object as THREE.Mesh;
        const deltaY = mesh.position.y - dragScaling.startY;
        let scale = dragScaling.startScale * (1 + deltaY / 100);
        scale = Math.max(0.1, Math.min(10, scale));
        dragScaling.currentScale = scale;
        // Calculate centroid of all polygons in group
        if (!dragScaling) return;
        const allVerts: [number, number][] = dragScaling.verts.flat();
        const cx = allVerts.reduce((sum, v) => sum + v[0], 0) / allVerts.length;
        const cy = allVerts.reduce((sum, v) => sum + v[1], 0) / allVerts.length;
        // Scale all polygons in group
        polygonGroups.forEach(({ group, fillMesh }) => {
          const id = group.userData.id as string;
          if (id.startsWith(dragScaling.prefix + '_')) {
            scalePolygons(id, fillMesh, cx, cy, scale, dragScaling);
          }
        });
      } else {
        // Normal drag
        const mesh = event.object as THREE.Mesh;
        // Clamp so the entire polygon stays within canvas
        if (mesh.geometry instanceof THREE.ShapeGeometry) {
          const positions = (mesh.geometry as THREE.BufferGeometry).attributes.position.array as Float32Array;
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i] + mesh.position.x;
            const y = positions[i + 1] + mesh.position.y;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
          // Calculate allowed movement
          if (minX < 0) mesh.position.x -= minX;
          if (maxX > width) mesh.position.x -= (maxX - width);
          if (minY < 0) mesh.position.y -= minY;
          if (maxY > height) mesh.position.y -= (maxY - height);
        }

        const outline = fillToOutlineMap.get(mesh);
        if (outline) {
          outline.position.copy(mesh.position);
        }
        const draggedGroup = mesh.parent as THREE.Group;
        const draggedId = draggedGroup.userData.id as string;
        const prefix = draggedId.split('_')[0];
        polygonGroups.forEach(({ group, fillMesh }) => {
          const id = group.userData.id as string;
          if (id.startsWith(prefix + '_')) {
            if (fillMesh !== mesh) {
              fillMesh.position.copy(mesh.position);
              const outlineOther = fillToOutlineMap.get(fillMesh);
              if (outlineOther) outlineOther.position.copy(mesh.position);
            }
          }
        });
      }
    });

    dragControls.addEventListener('dragend', (event) => {
      // If scaling was performed, update state with final vertices
      if (dragScaling && shiftPressedRef.current) {
        const scale = dragScaling.currentScale;
        const allVerts: [number, number][] = dragScaling.verts.flat();
        const cx = allVerts.reduce((sum, v) => sum + v[0], 0) / allVerts.length;
        const cy = allVerts.reduce((sum, v) => sum + v[1], 0) / allVerts.length;
        setPolygons(polygons.map(p => {
          if (dragScaling && p.id.startsWith(dragScaling.prefix + '_')) {
            const polyIdx = polygons.filter(pp => pp.id.startsWith(dragScaling.prefix + '_')).findIndex(pp => pp.id === p.id);
            const verts = dragScaling.verts[polyIdx];
            if (!verts) return p;
            const newVerts = verts.map(([x, y]) => {
              const newX = cx + (x - cx) * scale / dragScaling.startScale;
              const newY = cy + (y - cy) * scale / dragScaling.startScale;
              return [newX, newY] as [number, number];
            });
            return { ...p, vertices: newVerts as [number, number][] };
          } else {
            return p;
          }
        }));
      }
      else {
        const mesh = event.object as THREE.Mesh;
        const outline = fillToOutlineMap.get(mesh);
        if (outline && mesh.geometry instanceof THREE.ShapeGeometry) {
          const positions = (mesh.geometry as THREE.BufferGeometry).attributes.position.array as Float32Array;
          const updatedVertices: [number, number][] = [];
          for (let i = 0; i < positions.length; i += 3) {
            // Flip y-axis back when updating vertices
            const x = (positions[i] + mesh.position.x) / width;
            const y = 1 - ((positions[i + 1] + mesh.position.y) / height);
            updatedVertices.push([x, y]);
          }
          // Get group prefix
          const draggedGroup = mesh.parent as THREE.Group;
          const draggedId = draggedGroup.userData.id as string;
          const prefix = draggedId.split('_')[0];
          // Count polygons in group
          const groupPolygons = polygons.filter(p => p.id.startsWith(prefix + '_'));
          if (groupPolygons.length > 1) {
            // Calculate translation delta from mesh.position
            const dx = mesh.position.x / width;
            const dy = mesh.position.y / height;
            setPolygons(polygons.map(p => {
              if (p.id.startsWith(prefix + '_')) {
                return {
                  ...p,
                  // Flip y-axis for translation
                  vertices: p.vertices.map(([x, y]) => [x + dx, y - dy])
                };
              } else {
                return p;
              }
            }));
          } else {
            // Only one polygon in group, update vertices as before
            setPolygons(polygons.map(p =>
              p.id === mesh.parent?.userData.id
                ? { ...p, vertices: updatedVertices }
                : p
            ));
          }
        }
      }
    });

    return () => {
      if (dragControlsRef.current) {
        dragControlsRef.current.dispose();
      }
    };
  }, [polygons]);

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
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#fff', fontSize: '1em', marginBottom: '0.3em' }}>{label}</div>
      <div ref={mountRef} style={{ maxWidth: '180px' }}></div>
      <div style={{ marginTop: '0.5em' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} style={{ marginRight: '0.5em' }}>Import</button>
        <button onClick={handleExport}>Export</button>
      </div>
      {/* <div style={{ fontSize: '0.8em', color: '#888', marginTop: '0.5em' }}>
        Hold <b>Shift</b> and drag mouse up/down to scale polygon group
      </div> */}
    </div>
  );
});

export default PolygonEditor;
