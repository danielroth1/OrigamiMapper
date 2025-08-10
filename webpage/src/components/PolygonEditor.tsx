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
  const mountRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const a4PlaneRef = useRef<THREE.Mesh | null>(null);
  const dragControlsRef = useRef<DragControls | null>(null);
  const [polygons, setPolygons] = useState<OrigamiMapperTypes.Polygon[]>(data.input_polygons);

  const width = 180;
  const height = (297 / 210) * width;

  // Setup scene/camera/renderer once on mount, cleanup on unmount
  useEffect(() => {
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

    dragControls.addEventListener('drag', (event) => {
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
    });

    dragControls.addEventListener('dragend', (event) => {
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
    </div>
  );
});

export default PolygonEditor;
