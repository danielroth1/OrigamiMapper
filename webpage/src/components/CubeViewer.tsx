import { Canvas } from '@react-three/fiber';
import { Stats, OrbitControls, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useMemo } from 'react';

// (Legacy OpenBox removed; replaced by TexturedOpenBox below.)

export type FaceKey = 'R'|'L'|'U'|'V'|'H'; // Right, Left, Bottom (U), Front (V), Back (H)
export type FaceTextures = Partial<Record<FaceKey, string>>;

interface CubeViewerProps {
  outsideFaces?: FaceTextures;
  insideFaces?: FaceTextures;
  width?: number;
  height?: number;
  initialZoom?: number; // 1 = default; >1 = zoomed in (closer)
}

// Map our logical face letters to material slot order after removing top face.
// There are different mappings for outside vs inside so Hi/Vi can be placed independently.
// Slots (groups) after removing top: 0:+X (R), 1:-X (L), 2:-Y (U bottom), 3:+Z (front), 4:-Z (back)
const OUTSIDE_SLOT_ORDER: FaceKey[] = ['R','L','U','V','H']; // outside: place H on front, V on back
const INSIDE_SLOT_ORDER: FaceKey[] = ['R','L','U','H','V'];  // inside: original ordering (V front, H back)

function buildMaterials(faces: FaceTextures | undefined, side: THREE.Side, baseColor: number, slotOrder: FaceKey[] = OUTSIDE_SLOT_ORDER): THREE.Material[] {
  return slotOrder.map(key => {
    const dataUrl = faces?.[key];
    if (dataUrl) {
      const tex = new THREE.Texture();
      const img = new Image();
      img.onload = () => { tex.image = img; tex.needsUpdate = true; };
      img.src = dataUrl;
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: tex, side, roughness: 0.6, metalness: 0.05 });
    }
    return new THREE.MeshStandardMaterial({ color: baseColor, side, roughness: 0.8, metalness: 0.02 });
  });
}

function TexturedOpenBox({ outsideFaces, insideFaces, width=1, height=1 }: { outsideFaces?: FaceTextures; insideFaces?: FaceTextures; width?: number; height?: number }) {
  const geometry = useMemo(() => {
    const depth = 0.82828282828*width;
    const g = new THREE.BoxGeometry(width, height, depth);
    // remove top face (index 2) similar to OpenBox above
    const removedGroupIndex = 2;
    const index = g.getIndex();
    if (index) {
      const oldArray = index.array as ArrayLike<number>;
      const groups = g.groups.filter((_, i) => i !== removedGroupIndex);
      const remStart = g.groups[removedGroupIndex].start;
      const remEnd = remStart + g.groups[removedGroupIndex].count;
      const newIndices: number[] = [];
      for (let i=0;i<oldArray.length;i++) if (i < remStart || i >= remEnd) newIndices.push(oldArray[i]);
      g.setIndex(newIndices);
      g.clearGroups();
      let runningStart=0;
      for (const grp of groups) {
        const mi = grp.materialIndex ?? 0;
        g.addGroup(runningStart, grp.count, mi < removedGroupIndex ? mi : mi - 1);
        runningStart += grp.count;
      }
    }
    return g;
  }, [width, height]);

  const outsideMats = useMemo(()=>buildMaterials(outsideFaces, THREE.FrontSide, 0xcccccc, OUTSIDE_SLOT_ORDER), [outsideFaces]);
  const insideMats = useMemo(()=>buildMaterials(insideFaces, THREE.BackSide, 0x222222, INSIDE_SLOT_ORDER), [insideFaces]);

  return (
    <group>
      <mesh geometry={geometry} material={outsideMats} />
      <mesh geometry={geometry} material={insideMats} />
      <Edges geometry={geometry} threshold={15} />
    </group>
  );
}

export default function CubeViewer({ outsideFaces, insideFaces, width=1, height=1, initialZoom=1 }: CubeViewerProps) {
  // base camera position (isometric-ish). We move camera closer by multiplying by 1/initialZoom.
  // initialZoom: 1 = default, 2 = twice as close, 0.5 = farther away
  const clampZoom = Math.max(0.2, initialZoom);
  const basePos = new THREE.Vector3(0.85, 0.85, 0.95);
  const camPos = basePos.clone().divideScalar(clampZoom);

  return (
    <Canvas
      camera={{ position: [camPos.x, camPos.y, camPos.z] }}
      // enable antialias via GL props; configure encoding/toneMapping in onCreated with casts
      gl={{ antialias: true }}
    >
      {/* neutral, not-overpowering lights so textures read correctly */}
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 4, 5]} intensity={1.5} />
      <TexturedOpenBox outsideFaces={outsideFaces} insideFaces={insideFaces} width={width} height={height} />
      <OrbitControls enablePan={false} />
      <Stats />
    </Canvas>
  );
}

