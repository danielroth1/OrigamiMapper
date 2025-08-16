import { Canvas } from '@react-three/fiber';
import { Stats, OrbitControls, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useMemo } from 'react';

/**
 * OpenBox: a rectangular box missing the top face (open on +Y side).
 * Depth is 2/3 of the width as requested.
 */
function OpenBox({ width = 1, height = 0.8 }: { width?: number; height?: number }) {
  const geometry = useMemo(() => {
    const depth = (2 / 3) * width;
    const g = new THREE.BoxGeometry(width, height, depth);

    // Remove the top face (group index 2, order: +X, -X, +Y(top), -Y(bottom), +Z(front), -Z(back))
    const removedGroupIndex = 2;
    // Each group has 6 indices; gather groups except the removed one
    const index = g.getIndex();
    if (index) {
      const oldArray = index.array as ArrayLike<number>;
      const groups = g.groups.filter((_, i) => i !== removedGroupIndex);
      const remStart = g.groups[removedGroupIndex].start;
      const remEnd = remStart + g.groups[removedGroupIndex].count; // exclusive
      const newIndices: number[] = [];
      for (let i = 0; i < oldArray.length; i++) {
        if (i < remStart || i >= remEnd) newIndices.push(oldArray[i]);
      }
      g.setIndex(newIndices);
      // Rebuild groups with corrected starts (counts remain 6 for each face kept)
      g.clearGroups();
      let runningStart = 0;
      for (const grp of groups) {
        const mi = grp.materialIndex ?? 0;
        g.addGroup(runningStart, grp.count, mi < removedGroupIndex ? mi : mi - 1);
        runningStart += grp.count;
      }
    }
    return g;
  }, [width, height]);

  return (
    <mesh geometry={geometry}> 
      <meshStandardMaterial color="#8ab4f8" side={THREE.DoubleSide} roughness={0.4} metalness={0.05} />
      <Edges threshold={15} />
    </mesh>
  );
}

export default function CubeViewer() {
  return (
  <Canvas camera={{ position: [1.2, 1.8, 2.0] }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={0.9} />
      <OpenBox />
      <OrbitControls enablePan={false} />
      <Stats />
    </Canvas>
  );
}

