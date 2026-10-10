/**
 * TrackVegetationBuilder.ts - Organic Botanical & Forest Corridor Generation
 * Uses hardware GPU Instancing to render Mediterranean pines, broadleaf oaks, Italian cypresses,
 * organic bush hedges, and 3D volumetric grass tufts partitioned into frustum-culled spatial chunks.
 */

import * as THREE from 'three';
import { OrganicVegetationSystem, TreePlacementConfig } from '../OrganicVegetationSystem';
import { StaticObstacle } from '../TrackBuilder';
import { TrackMaterials } from './TrackMaterials';

export class TrackVegetationBuilder {
  /**
   * High-performance 3D Grass Tufts rendered via spatial chunk InstancedMeshes
   */
  public static buildGrassTufts(
    parent: THREE.Group,
    grassTuftMat: THREE.Material,
    innerCornerCenter: number,
    isTurn1Exterior: (x: number, z: number) => boolean
  ): void {
    const tuftGeo = OrganicVegetationSystem.createCurvedGrassTuftGeometry();

    interface GrassInstanceData {
      matrix: THREE.Matrix4;
      color: THREE.Color;
    }
    const gridDim = 6;
    const cellSize = 480 / gridDim; // 80m cells
    const chunks: GrassInstanceData[][] = Array.from({ length: gridDim * gridDim }, () => []);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const maxTufts = 9500;
    let idx = 0;

    const c = innerCornerCenter; // 92
    const cornerCenters = [
      { cx: c, cz: -c },
      { cx: c, cz: c },
      { cx: -c, cz: c },
      { cx: -c, cz: -c },
    ];

    const isGrassAllowed = (gx: number, gz: number): boolean => {
      if (isTurn1Exterior(gx, gz)) return false;
      if (gx >= -68 && gx <= 68 && gz >= -168 && gz <= -139.2) return false;
      if (gx >= -48 && gx <= 48 && gz >= 139.2 && gz <= 170.0) return false;
      if (Math.abs(gx) <= 96 && gz >= -124.5 && gz <= -84.0) return false;

      if (Math.abs(gx) <= 94 && gz >= -140.0 && gz <= -120.0) return false;
      if (Math.abs(gx) <= 94 && gz >= 120.0 && gz <= 140.0) return false;
      if (gx >= 120.0 && gx <= 140.0 && Math.abs(gz) <= 94) return false;
      if (gx >= -140.0 && gx <= -120.0 && Math.abs(gz) <= 94) return false;

      for (const cc of cornerCenters) {
        const dx = gx - cc.cx;
        const dz = gz - cc.cz;
        const signX = Math.sign(cc.cx);
        const signZ = Math.sign(cc.cz);
        if (dx * signX >= -2 && dz * signZ >= -2) {
          const distSq = dx * dx + dz * dz;
          if (distSq >= 25.5 * 25.5 && distSq <= 63.0 * 63.0) {
            return false;
          }
        }
      }

      const wallClr = 1.05;
      if (Math.abs(gx) <= 92 && (Math.abs(gz - 140) < wallClr || Math.abs(gz + 140) < wallClr)) return false;
      if (Math.abs(gz) <= 92 && (Math.abs(gx - 140) < wallClr || Math.abs(gx + 140) < wallClr)) return false;
      if (Math.abs(gx) <= 92 && (Math.abs(gz - 120) < wallClr || Math.abs(gz + 120) < wallClr)) return false;
      if (Math.abs(gz) <= 92 && (Math.abs(gx - 120) < wallClr || Math.abs(gx + 120) < wallClr)) return false;

      for (const cc of cornerCenters) {
        const dx = gx - cc.cx;
        const dz = gz - cc.cz;
        const signX = Math.sign(cc.cx);
        const signZ = Math.sign(cc.cz);
        if (dx * signX >= -2 && dz * signZ >= -2) {
          const dist = Math.hypot(dx, dz);
          if (Math.abs(dist - 48.0) < wallClr) return false;
          if (Math.abs(dist - 24.0) < wallClr) return false;
        }
      }

      return true;
    };

    const addTuft = (x: number, z: number, scale = 1.0, jitter = 0.35) => {
      if (idx >= maxTufts) return;
      const jx = (Math.random() - 0.5) * jitter;
      const jz = (Math.random() - 0.5) * jitter;
      const px = x + jx;
      const pz = z + jz;
      if (!isGrassAllowed(px, pz)) return;

      dummy.position.set(px, 0.002, pz);
      dummy.scale.setScalar(scale * (0.88 + Math.random() * 0.24));
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();

      color.setRGB(
        0.95 + (Math.random() - 0.5) * 0.08,
        1.00,
        0.92 + (Math.random() - 0.5) * 0.08
      );

      const cx = Math.max(0, Math.min(gridDim - 1, Math.floor((px + 240) / cellSize)));
      const cz = Math.max(0, Math.min(gridDim - 1, Math.floor((pz + 240) / cellSize)));
      chunks[cz * gridDim + cx].push({
        matrix: dummy.matrix.clone(),
        color: color.clone(),
      });
      idx++;
    };

    // 1. 4 Corner Outer Curves
    cornerCenters.forEach(({ cx, cz }) => {
      if (cx === c && cz === -c) return;
      const signX = Math.sign(cx);
      const signZ = Math.sign(cz);
      for (let r = 63.6; r <= 96.0; r += 2.4) {
        const step = 1.6 / r;
        for (let a = 0.04; a < Math.PI / 2 - 0.04; a += step) {
          const kx = cx + signX * Math.cos(a) * r;
          const kz = cz + signZ * Math.sin(a) * r;
          addTuft(kx, kz, 1.40, 0.55);
        }
      }
    });

    // 2. 4 Corner Inner Apex Greens
    cornerCenters.forEach(({ cx, cz }) => {
      const signX = Math.sign(cx);
      const signZ = Math.sign(cz);
      for (let r = 4.0; r <= 23.2; r += 2.0) {
        const step = 1.35 / r;
        for (let a = 0.06; a < Math.PI / 2 - 0.06; a += step) {
          const kx = cx - signX * Math.cos(a) * r;
          const kz = cz - signZ * Math.sin(a) * r;
          addTuft(kx, kz, 1.30, 0.40);
        }
      }
    });

    // 3. Infield Perimeter Corridors
    for (let x = -85; x <= 85; x += 2.2) {
      for (let d = 111.5; d <= 118.0; d += 2.8) {
        addTuft(x, d, 1.25, 0.5);
      }
    }

    for (let z = -85; z <= 85; z += 2.2) {
      for (let d = 111.5; d <= 118.0; d += 2.8) {
        addTuft(d, z, 1.25, 0.5);
      }
    }

    for (let z = -85; z <= 85; z += 2.2) {
      for (let d = 111.5; d <= 118.0; d += 2.8) {
        addTuft(-d, z, 1.25, 0.5);
      }
    }

    for (let x = -85; x <= 85; x += 2.8) {
      for (let d = 68.0; d <= 78.0; d += 3.2) {
        addTuft(x, -d, 1.25, 0.5);
      }
    }

    // 4. Outfield Perimeter Meadows
    for (let x = -135; x <= 135; x += 2.2) {
      if (x < -68 || x > 68) {
        for (let d = 142.0; d <= 152.0; d += 3.0) {
          addTuft(x, -d, 1.30, 0.55);
        }
      }
    }

    for (let x = -135; x <= 135; x += 2.2) {
      if (x < -48 || x > 48) {
        for (let d = 142.0; d <= 152.0; d += 3.0) {
          addTuft(x, d, 1.30, 0.55);
        }
      }
    }

    for (let z = -125; z <= 125; z += 2.2) {
      for (let d = 142.0; d <= 152.0; d += 3.0) {
        addTuft(d, z, 1.30, 0.55);
      }
    }

    for (let z = -125; z <= 125; z += 2.2) {
      for (let d = 142.0; d <= 152.0; d += 3.0) {
        addTuft(-d, z, 1.30, 0.55);
      }
    }

    chunks.forEach((chunk) => {
      if (chunk.length === 0) return;
      const chunkMesh = new THREE.InstancedMesh(tuftGeo, grassTuftMat, chunk.length);
      chunk.forEach((item, i) => {
        chunkMesh.setMatrixAt(i, item.matrix);
        chunkMesh.setColorAt(i, item.color);
      });
      chunkMesh.instanceMatrix.needsUpdate = true;
      if (chunkMesh.instanceColor) chunkMesh.instanceColor.needsUpdate = true;
      chunkMesh.receiveShadow = false;
      chunkMesh.castShadow = false;
      chunkMesh.computeBoundingSphere();
      chunkMesh.computeBoundingBox();
      parent.add(chunkMesh);
    });
  }

  /**
   * Dual-Corridor Tree Forest System rendered via Hardware InstancedMesh
   */
  public static buildOrganicVegetation(
    group: THREE.Group,
    materials: TrackMaterials,
    staticObstacles: StaticObstacle[],
    innerCornerCenter: number,
    isTurn1Exterior: (x: number, z: number) => boolean
  ): void {
    const vegGroup = new THREE.Group();
    const c = innerCornerCenter;
    const cornerCenters = [
      { cx: c, cz: -c },
      { cx: c, cz: c },
      { cx: -c, cz: c },
      { cx: -c, cz: -c },
    ];

    interface TreeInst {
      x: number;
      z: number;
      scale: number;
      rotY: number;
    }

    const pineList: TreeInst[] = [];
    const oakList: TreeInst[] = [];
    const cypressList: TreeInst[] = [];
    const bushList: TreeInst[] = [];
    const placedTrees: Array<{ x: number; z: number; r: number }> = [];

    const isTreeSafe = (x: number, z: number, canopyR: number): boolean => {
      if (isTurn1Exterior(x, z)) return false;
      if (x >= -72 - canopyR && x <= 72 + canopyR && z >= -170 - canopyR && z <= -138.0 + canopyR) return false;
      if (x >= -50 - canopyR && x <= 50 + canopyR && z >= 139.0 - canopyR && z <= 176.0 + canopyR) return false;
      if (Math.abs(x) <= 96 + canopyR && z >= -124.5 - canopyR && z <= -84 + canopyR) return false;
      if (z < -65 && Math.abs(x) <= 145) return false;

      if (Math.abs(x) <= 92 && z >= -140.0 - canopyR && z <= -120.0 + canopyR) return false;
      if (Math.abs(x) <= 92 && z >= 120.0 - canopyR && z <= 140.0 + canopyR) return false;
      if (x >= 120.0 - canopyR && x <= 140.0 + canopyR && Math.abs(z) <= 92) return false;
      if (x >= -140.0 - canopyR && x <= -120.0 + canopyR && Math.abs(z) <= 92) return false;

      for (const cc of cornerCenters) {
        const dx = x - cc.cx;
        const dz = z - cc.cz;
        const signX = Math.sign(cc.cx);
        const signZ = Math.sign(cc.cz);
        if (dx * signX >= -2 && dz * signZ >= -2) {
          const dist = Math.hypot(dx, dz);
          if (dist >= 23.5 && dist <= 64.5) return false;
          if (dist < 23.5 && dist + canopyR * 0.35 > 23.8) return false;
          if (dist > 64.5 && dist - canopyR * 0.35 < 64.0) return false;
        }
      }

      const wallClr = canopyR + 0.45;
      if (Math.abs(x) <= 92) {
        if (Math.abs(z - 140) < wallClr || Math.abs(z + 140) < wallClr) return false;
        if (Math.abs(z - 120) < wallClr || Math.abs(z + 120) < wallClr) return false;
      }
      if (Math.abs(z) <= 92) {
        if (Math.abs(x - 140) < wallClr || Math.abs(x + 140) < wallClr) return false;
        if (Math.abs(x - 120) < wallClr || Math.abs(x + 120) < wallClr) return false;
      }

      for (const cc of cornerCenters) {
        const dx = x - cc.cx;
        const dz = z - cc.cz;
        const signX = Math.sign(cc.cx);
        const signZ = Math.sign(cc.cz);
        if (dx * signX >= -2 && dz * signZ >= -2) {
          const dist = Math.hypot(dx, dz);
          if (Math.abs(dist - 48.0) < wallClr) return false;
          if (Math.abs(dist - 24.0) < wallClr) return false;
        }
      }

      for (const pt of placedTrees) {
        if (Math.hypot(x - pt.x, z - pt.z) < (canopyR + pt.r) * 0.38) {
          return false;
        }
      }

      return true;
    };

    const tryAddTree = (x: number, z: number, type: 'pine' | 'oak' | 'cypress', scale = 1.35) => {
      if (z < -65 && Math.abs(x) <= 145) return;

      const canopyR = type === 'cypress' ? 1.4 * scale : (type === 'pine' ? 2.8 * scale : 3.4 * scale);
      if (!isTreeSafe(x, z, canopyR)) return;

      const rotY = (Math.abs(x * 13 + z * 17) % 628) / 100;
      if (type === 'pine') pineList.push({ x, z, scale, rotY });
      else if (type === 'oak') oakList.push({ x, z, scale, rotY });
      else cypressList.push({ x, z, scale, rotY });

      placedTrees.push({ x, z, r: canopyR });

      if (Math.abs(x) < 120 && Math.abs(z) < 120) {
        staticObstacles.push({
          x,
          z,
          radius: 0.8 * scale,
          type: 'tree',
        });
      }
    };

    // Corridor 1: Outfield Wall Tree Corridor
    for (let x = -135; x <= -52; x += 11.0) {
      const type = Math.abs(x) % 2 === 0 ? 'oak' : 'pine';
      tryAddTree(x, 151 + (Math.abs(x * 5) % 6), type, 1.4);
    }
    for (let x = 52; x <= 135; x += 11.0) {
      const type = Math.abs(x) % 2 === 0 ? 'pine' : 'oak';
      tryAddTree(x, 151 + (Math.abs(x * 5) % 6), type, 1.4);
    }
    for (let x = -44; x <= 44; x += 13.0) {
      tryAddTree(x, 172 + (Math.abs(x * 7) % 8), 'oak', 1.55);
    }

    for (let z = -125; z <= 125; z += 11.5) {
      if (z <= -75) continue;
      const type = Math.abs(z) % 2 === 0 ? 'pine' : 'oak';
      tryAddTree(152 + (Math.abs(z * 5) % 8), z, type, 1.4);
    }

    for (let z = -125; z <= 125; z += 11.5) {
      const type = Math.abs(z) % 2 === 0 ? 'oak' : 'pine';
      tryAddTree(-152 - (Math.abs(z * 5) % 8), z, type, 1.4);
    }

    // Corner Outer Forest Amphitheaters
    const cornerAngles = [
      { cx: c, cz: -c, startAng: -Math.PI / 2 },
      { cx: c, cz: c, startAng: 0 },
      { cx: -c, cz: c, startAng: Math.PI / 2 },
      { cx: -c, cz: -c, startAng: Math.PI },
    ];

    cornerAngles.forEach(({ cx, cz, startAng }) => {
      if (cx === c && cz === -c) return;

      for (let a = 0.05; a < Math.PI / 2 - 0.05; a += 0.075) {
        const ang = startAng + a;
        const dist = 67.5 + ((a * 7) % 4.5);
        const type = Math.floor(a * 10) % 2 === 0 ? 'pine' : 'oak';
        tryAddTree(cx + Math.cos(ang) * dist, cz + Math.sin(ang) * dist, type, 1.4);
      }

      for (let a = 0.04; a < Math.PI / 2 - 0.04; a += 0.065) {
        const ang = startAng + a;
        const dist = 77.5 + ((a * 9) % 5.0);
        const type = Math.floor(a * 10) % 3 === 0 ? 'pine' : 'oak';
        tryAddTree(cx + Math.cos(ang) * dist, cz + Math.sin(ang) * dist, type, 1.5);
      }

      for (let a = 0.035; a < Math.PI / 2 - 0.035; a += 0.055) {
        const ang = startAng + a;
        const dist = 89.0 + ((a * 11) % 6.0);
        const type = Math.floor(a * 10) % 2 === 0 ? 'pine' : 'oak';
        tryAddTree(cx + Math.cos(ang) * dist, cz + Math.sin(ang) * dist, type, 1.55);
      }

      for (let a = 0.03; a < Math.PI / 2 - 0.03; a += 0.050) {
        const ang = startAng + a;
        const dist = 101.0 + ((a * 13) % 7.0);
        const type = Math.floor(a * 10) % 3 === 0 ? 'oak' : 'pine';
        tryAddTree(cx + Math.cos(ang) * dist, cz + Math.sin(ang) * dist, type, 1.65);
      }
    });

    // Corridor 2: Infield Wall Tree Corridor
    for (let x = -80; x <= 80; x += 12.0) {
      const mod = Math.abs(x) % 3;
      const type = mod === 0 ? 'cypress' : (mod === 1 ? 'oak' : 'pine');
      tryAddTree(x, 111.5 - (Math.abs(x * 3) % 2), type, 1.25);
    }

    for (let z = -80; z <= 80; z += 12.0) {
      const mod = Math.abs(z) % 3;
      const type = mod === 0 ? 'cypress' : (mod === 1 ? 'pine' : 'oak');
      tryAddTree(111.5 - (Math.abs(z * 3) % 2), z, type, 1.25);
    }

    for (let z = -80; z <= 80; z += 12.0) {
      const mod = Math.abs(z) % 3;
      const type = mod === 0 ? 'cypress' : (mod === 1 ? 'oak' : 'pine');
      tryAddTree(-111.5 + (Math.abs(z * 3) % 2), z, type, 1.25);
    }

    cornerAngles.forEach(({ cx, cz }) => {
      const signX = Math.sign(cx);
      const signZ = Math.sign(cz);

      for (let a = 0.08; a < Math.PI / 2 - 0.08; a += 0.11) {
        const dist = 9.5 + ((a * 5) % 2.5);
        const kx = cx - signX * Math.cos(a) * dist;
        const kz = cz - signZ * Math.sin(a) * dist;
        const type = Math.floor(a * 10) % 2 === 0 ? 'cypress' : 'oak';
        tryAddTree(kx, kz, type, 1.25);
      }

      for (let a = 0.10; a < Math.PI / 2 - 0.10; a += 0.10) {
        const dist = 15.5 + ((a * 6) % 2.5);
        const kx = cx - signX * Math.cos(a) * dist;
        const kz = cz - signZ * Math.sin(a) * dist;
        const type = Math.floor(a * 10) % 2 === 0 ? 'pine' : 'cypress';
        tryAddTree(kx, kz, type, 1.3);
      }
    });

    // Trackside Shrub Hedges
    const barrierBushPositions: Array<[number, number, number]> = [];
    for (let x = -75; x <= 75; x += 8.0) barrierBushPositions.push([x, 114.5, 1.05]);
    for (let z = -75; z <= 75; z += 8.0) barrierBushPositions.push([114.5, z, 1.05]);
    for (let z = -75; z <= 75; z += 8.0) barrierBushPositions.push([-114.5, z, 1.05]);

    cornerAngles.forEach(({ cx, cz, startAng }) => {
      if (cx === c && cz === -c) return;
      for (let a = 0.05; a < Math.PI / 2 - 0.05; a += 0.08) {
        const ang = startAng + a;
        barrierBushPositions.push([cx + Math.cos(ang) * 65.2, cz + Math.sin(ang) * 65.2, 1.15]);
      }
    });

    cornerAngles.forEach(({ cx, cz }) => {
      const signX = Math.sign(cx);
      const signZ = Math.sign(cz);
      for (let a = 0.10; a < Math.PI / 2 - 0.10; a += 0.10) {
        barrierBushPositions.push([cx - signX * Math.cos(a) * 20.5, cz - signZ * Math.sin(a) * 20.5, 1.1]);
      }
    });

    barrierBushPositions.forEach(([bx, bz, scale]) => {
      if (bz < -65 && Math.abs(bx) <= 145) return;
      const bushR = 1.2 * scale;
      if (isTreeSafe(bx, bz, bushR)) {
        const rotY = (Math.abs(bx * 19 + bz * 23) % 628) / 100;
        bushList.push({ x: bx, z: bz, scale, rotY });
        placedTrees.push({ x: bx, z: bz, r: bushR });
      }
    });

    const allTreeConfigs: TreePlacementConfig[] = [];
    pineList.forEach((p) => allTreeConfigs.push({ x: p.x, z: p.z, scale: p.scale, yaw: p.rotY, type: 'pine' }));
    oakList.forEach((o) => allTreeConfigs.push({ x: o.x, z: o.z, scale: o.scale, yaw: o.rotY, type: 'oak' }));
    cypressList.forEach((c) => allTreeConfigs.push({ x: c.x, z: c.z, scale: c.scale, yaw: c.rotY, type: 'cypress' }));
    bushList.forEach((b) => allTreeConfigs.push({ x: b.x, z: b.z, scale: b.scale, yaw: b.rotY, type: 'bush' }));

    OrganicVegetationSystem.buildVegetationForest(
      vegGroup,
      allTreeConfigs,
      {
        trunkMat: materials.treeBarkMat,
        pineFoliageMat: materials.pineFoliageMat,
        oakFoliageMat: materials.oakFoliageMat,
        cypressFoliageMat: materials.cypressFoliageMat,
        bushMat: materials.bushFoliageMat,
      }
    );

    group.add(vegGroup);
  }
}
