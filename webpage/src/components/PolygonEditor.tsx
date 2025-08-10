import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { DragControls } from 'three/examples/jsm/controls/DragControls.js';
import type { OrigamiMapperTypes } from '../OrigamiMapperTypes';

interface PolygonEditorProps {
  data: OrigamiMapperTypes.TemplateJson;
}

const PolygonEditor = ({ data }: PolygonEditorProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [polygons, setPolygons] = useState<OrigamiMapperTypes.Polygon[]>(data.input_polygons);

  useEffect(() => {
    const width = 800;
    const height = (297 / 210) * width; // A4 aspect ratio

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    const camera = new THREE.OrthographicCamera(0, width, height, 0, 1, 1000);
    camera.position.z = 500;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const a4Geometry = new THREE.PlaneGeometry(width, height);
    const a4Material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const a4Plane = new THREE.Mesh(a4Geometry, a4Material);
    a4Plane.position.set(width / 2, height / 2, 0);
    scene.add(a4Plane);

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

      // Filled mesh (transparent)
      const fillGeometry = new THREE.ShapeGeometry(shape);
      const fillMaterial = new THREE.MeshBasicMaterial({
        color: 0x2194ce,
        opacity: 0.3,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);

      // Outline (solid)
      const points = shape.getPoints();
      const outlineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, opacity: 1 });
      const outline = new THREE.Line(outlineGeometry, outlineMaterial);

      // Map fillMesh to outline
      fillToOutlineMap.set(fillMesh, outline);

      // Group fill and outline
      const group = new THREE.Group();
      group.add(fillMesh);
      group.add(outline);
      group.userData = { id: polygon.id };

      return { group, fillMesh };
    });

    // Add groups to the scene
    polygonGroups.forEach(({ group }) => {
      scene.add(group);
    });

    // Only use fill meshes for drag controls
    const dragControls = new DragControls(
      polygonGroups.map(({ fillMesh }) => fillMesh),
      camera,
      renderer.domElement
    );

    dragControls.addEventListener('drag', (event) => {
      const mesh = event.object as THREE.Mesh;
      const outline = fillToOutlineMap.get(mesh);
      if (outline) {
        outline.position.copy(mesh.position);
      }
      // Optionally, move the group if needed
      // const group = mesh.parent as THREE.Group;
      // group.position.copy(mesh.position);
    });

    dragControls.addEventListener('dragend', (event) => {
      const mesh = event.object as THREE.Mesh;
      const outline = fillToOutlineMap.get(mesh);
      // Use mesh.position for export
      if (outline && mesh.geometry instanceof THREE.ShapeGeometry) {
        const positions = (mesh.geometry as THREE.BufferGeometry).attributes.position.array as Float32Array;
        const updatedVertices: [number, number][] = [];
        for (let i = 0; i < positions.length; i += 3) {
          updatedVertices.push([
            (positions[i] + mesh.position.x) / width,
            (positions[i + 1] + mesh.position.y) / height
          ]);
        }
        setPolygons(polygons.map(p =>
          p.id === mesh.parent?.userData.id
            ? { ...p, vertices: updatedVertices }
            : p
        ));
      }
      // Do NOT reset mesh and outline position here!
      // mesh.position.set(0, 0, 0);
      // if (outline) outline.position.set(0, 0, 0);
    });

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [data]);

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
