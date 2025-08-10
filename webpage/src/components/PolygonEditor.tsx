import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { DragControls } from 'three/examples/jsm/controls/DragControls.js';
import type { OrigamiMapperTypes } from '../OrigamiMapperTypes';

interface PolygonEditorProps {
  data: OrigamiMapperTypes.TemplateJson;
}

const PolygonEditor = ({ data }: PolygonEditorProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const a4PlaneRef = useRef<THREE.Mesh | null>(null);
  const dragControlsRef = useRef<DragControls | null>(null);
  const [polygons, setPolygons] = useState<OrigamiMapperTypes.Polygon[]>(data.input_polygons);

  // Setup scene/camera/renderer once on mount, cleanup on unmount
  useEffect(() => {
    const width = 800;
    const height = (297 / 210) * width;
    // Clean up any previous canvas/renderer/scene
    if (rendererRef.current && mountRef.current) {
      mountRef.current.removeChild(rendererRef.current.domElement);
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
    rendererRef.current.setSize(width, height);
    if (mountRef.current) {
      mountRef.current.appendChild(rendererRef.current.domElement);
    }
    const a4Geometry = new THREE.PlaneGeometry(width, height);
    const a4Material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    a4PlaneRef.current = new THREE.Mesh(a4Geometry, a4Material);
    a4PlaneRef.current.position.set(width / 2, height / 2, 0);
    sceneRef.current.add(a4PlaneRef.current);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      rendererRef.current!.render(sceneRef.current!, cameraRef.current!);
    };
    animate();

    return () => {
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      if (dragControlsRef.current) {
        dragControlsRef.current.dispose();
      }
    };
  }, []);

  // Update polygon meshes/groups and drag controls when polygons change
  useEffect(() => {
    const width = 800;
    const height = (297 / 210) * width;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!scene || !camera || !renderer) return;

    // Remove old polygon groups (keep a4Plane)
    scene.children = scene.children.filter(obj => obj === a4PlaneRef.current);

    // Create mapping from fillMesh to outline
    const fillToOutlineMap = new Map<THREE.Mesh, THREE.Line>();

    const polygonGroups = polygons.map(polygon => {
      const shape = new THREE.Shape();
      polygon.vertices.forEach((v, i) => {
        if (i === 0) {
          shape.moveTo(v[0] * width, v[1] * height);
        } else {
          shape.lineTo(v[0] * width, v[1] * height);
        }
      });
      shape.closePath();

      const fillGeometry = new THREE.ShapeGeometry(shape);
      const fillMaterial = new THREE.MeshBasicMaterial({
        color: 0x2194ce,
        opacity: 0.3,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);

      const points = shape.getPoints();
      const outlineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, opacity: 1 });
      const outline = new THREE.Line(outlineGeometry, outlineMaterial);

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
          updatedVertices.push([
            (positions[i] + mesh.position.x) / width,
            (positions[i + 1] + mesh.position.y) / height
          ]);
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
                vertices: p.vertices.map(([x, y]) => [x + dx, y + dy])
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

  const handleExport = () => {
    const output = { ...data, input_polygons: polygons };
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'box_modified.json';
    link.click();
  };

  return (
    <div>
      <div ref={mountRef}></div>
      <button onClick={handleExport}>Export JSON</button>
    </div>
  );
};

export default PolygonEditor;
