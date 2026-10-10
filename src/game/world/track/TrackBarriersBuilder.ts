/**
 * TrackBarriersBuilder.ts - FIA Grade-1 Safety Barriers & Tecpro Runoff Systems
 * Constructs continuous curved New Jersey concrete barriers with overhead debris catch fencing
 * and modular energy-absorbing Tecpro impact cushions with physical collision registration.
 */

import * as THREE from 'three';
import { safeMergeAndDispose } from '../../utils/GeometryUtils';
import { StaticObstacle } from '../TrackBuilder';
import { TrackMaterials } from './TrackMaterials';

export class TrackBarriersBuilder {
  /**
   * FIA Aerodynamic Continuous Curved Safety Barriers with Overhead Catch Fencing
   */
  public static buildConcreteBarriersWithCatchFences(
    group: THREE.Group,
    materials: TrackMaterials,
    staticObstacles: StaticObstacle[],
    halfSize: number,
    trackWidth: number,
    innerCornerCenter: number,
    cornerRadius: number
  ): void {
    const wallHeight = 1.20;
    const fenceHeight = 2.40;
    const half = halfSize;
    const w = trackWidth;
    const c = innerCornerCenter;

    const outerHalf = half + w / 2 + 2.0;
    const innerHalf = half - w / 2 - 2.0;

    const concretePositions: number[] = [];
    const concreteUVs: number[] = [];
    const concreteIndices: number[] = [];

    const cableGeos: THREE.BufferGeometry[] = [];
    const postMatrices: THREE.Matrix4[] = [];
    const sharedPostGeo = new THREE.CylinderGeometry(0.06, 0.07, fenceHeight, 6);
    const dummyObj = new THREE.Object3D();

    const loftContinuousBarrier = (
      points: { x: number; z: number }[],
      isClosed: boolean,
      hasFence: boolean = true
    ) => {
      const N = points.length;
      if (N < 2) return;

      const numSegments = isClosed ? N : N - 1;

      // Compute continuous smooth normal vectors along the entire polyline
      const normals: { nx: number; nz: number }[] = [];
      for (let i = 0; i < N; i++) {
        let dx = 0;
        let dz = 0;
        if (isClosed) {
          const prev = points[(i - 1 + N) % N];
          const next = points[(i + 1) % N];
          dx = next.x - prev.x;
          dz = next.z - prev.z;
        } else {
          if (i === 0) {
            dx = points[1].x - points[0].x;
            dz = points[1].z - points[0].z;
          } else if (i === N - 1) {
            dx = points[N - 1].x - points[N - 2].x;
            dz = points[N - 1].z - points[N - 2].z;
          } else {
            dx = points[i + 1].x - points[i - 1].x;
            dz = points[i + 1].z - points[i - 1].z;
          }
        }
        const len = Math.hypot(dx, dz) || 1;
        normals.push({ nx: -dz / len, nz: dx / len });
      }

      // Cumulative distance along the path for seamless 4.0m modular precast block UV mapping
      const distances: number[] = [0];
      for (let i = 1; i < N; i++) {
        const d = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
        distances.push(distances[i - 1] + d);
      }

      const addQuad = (
        p1A: { x: number; y: number; z: number },
        p2A: { x: number; y: number; z: number },
        p2B: { x: number; y: number; z: number },
        p1B: { x: number; y: number; z: number },
        vA: number,
        vB: number,
        uStart: number,
        uEnd: number
      ) => {
        const base = concretePositions.length / 3;
        concretePositions.push(
          p1A.x, p1A.y, p1A.z,
          p2A.x, p2A.y, p2A.z,
          p2B.x, p2B.y, p2B.z,
          p1B.x, p1B.y, p1B.z
        );
        concreteUVs.push(
          uStart, vA,
          uEnd, vA,
          uEnd, vB,
          uStart, vB
        );
        concreteIndices.push(base, base + 1, base + 2);
        concreteIndices.push(base, base + 2, base + 3);
      };

      for (let seg = 0; seg < numSegments; seg++) {
        const i1 = seg;
        const i2 = isClosed ? (seg + 1) % N : seg + 1;
        const p1 = points[i1];
        const p2 = points[i2];
        const n1 = normals[i1];
        const n2 = normals[i2];

        const d1 = distances[i1];
        const segLen = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        const d2 = d1 + segLen;
        const u1 = d1 / 4.0;
        const u2 = d2 / 4.0;

        // 1. Front Lower Flare
        addQuad(
          { x: p1.x + n1.nx * 0.36, y: 0.00, z: p1.z + n1.nz * 0.36 },
          { x: p2.x + n2.nx * 0.36, y: 0.00, z: p2.z + n2.nz * 0.36 },
          { x: p2.x + n2.nx * 0.24, y: 0.22, z: p2.z + n2.nz * 0.24 },
          { x: p1.x + n1.nx * 0.24, y: 0.22, z: p1.z + n1.nz * 0.24 },
          0.00, 0.22, u1, u2
        );

        // 2. Front Main Vertical Wall
        addQuad(
          { x: p1.x + n1.nx * 0.24, y: 0.22, z: p1.z + n1.nz * 0.24 },
          { x: p2.x + n2.nx * 0.24, y: 0.22, z: p2.z + n2.nz * 0.24 },
          { x: p2.x + n2.nx * 0.10, y: 1.14, z: p2.z + n2.nz * 0.10 },
          { x: p1.x + n1.nx * 0.10, y: 1.14, z: p1.z + n1.nz * 0.10 },
          0.22, 0.90, u1, u2
        );

        // 3. Front Top Chamfer
        addQuad(
          { x: p1.x + n1.nx * 0.10, y: 1.14, z: p1.z + n1.nz * 0.10 },
          { x: p2.x + n2.nx * 0.10, y: 1.14, z: p2.z + n2.nz * 0.10 },
          { x: p2.x + n2.nx * 0.05, y: 1.20, z: p2.z + n2.nz * 0.05 },
          { x: p1.x + n1.nx * 0.05, y: 1.20, z: p1.z + n1.nz * 0.05 },
          0.90, 1.00, u1, u2
        );

        // 4. Flat Top Crown
        addQuad(
          { x: p1.x + n1.nx * 0.05, y: 1.20, z: p1.z + n1.nz * 0.05 },
          { x: p2.x + n2.nx * 0.05, y: 1.20, z: p2.z + n2.nz * 0.05 },
          { x: p2.x - n2.nx * 0.05, y: 1.20, z: p2.z - n2.nz * 0.05 },
          { x: p1.x - n1.nx * 0.05, y: 1.20, z: p1.z - n1.nz * 0.05 },
          0.95, 1.00, u1, u2
        );

        // 5. Back Top Chamfer
        addQuad(
          { x: p1.x - n1.nx * 0.05, y: 1.20, z: p1.z - n1.nz * 0.05 },
          { x: p2.x - n2.nx * 0.05, y: 1.20, z: p2.z - n2.nz * 0.05 },
          { x: p2.x - n2.nx * 0.10, y: 1.14, z: p2.z - n2.nz * 0.10 },
          { x: p1.x - n1.nx * 0.10, y: 1.14, z: p1.z - n1.nz * 0.10 },
          1.00, 0.90, u1, u2
        );

        // 6. Back Wall Face
        addQuad(
          { x: p1.x - n1.nx * 0.10, y: 1.14, z: p1.z - n1.nz * 0.10 },
          { x: p2.x - n2.nx * 0.10, y: 1.14, z: p2.z - n2.nz * 0.10 },
          { x: p2.x - n2.nx * 0.36, y: 0.00, z: p2.z - n2.nz * 0.36 },
          { x: p1.x - n1.nx * 0.36, y: 0.00, z: p1.z - n1.nz * 0.36 },
          0.90, 0.00, u1, u2
        );
      }

      // Catch fencing: instanced posts and continuous tension cables
      if (hasFence) {
        let accumulatedDistance = 0;
        const postSpacing = 4.8;
        let lastPostDist = -postSpacing;

        for (let seg = 0; seg < numSegments; seg++) {
          const p1 = points[seg];
          const p2 = isClosed ? points[(seg + 1) % N] : points[seg + 1];
          const segLen = Math.hypot(p2.x - p1.x, p2.z - p1.z);
          const yaw = Math.atan2(p2.x - p1.x, p2.z - p1.z);

          // Posts
          if (accumulatedDistance - lastPostDist >= postSpacing || seg === 0) {
            dummyObj.position.set(p1.x, wallHeight + fenceHeight / 2, p1.z);
            dummyObj.rotation.set(0, 0, 0);
            dummyObj.scale.set(1, 1, 1);
            dummyObj.updateMatrix();
            postMatrices.push(dummyObj.matrix.clone());
            lastPostDist = accumulatedDistance;
          }

          // 3 Horizontal continuous security tension wire cables
          for (let cb = 0; cb < 3; cb++) {
            const cableGeo = new THREE.CylinderGeometry(0.015, 0.015, segLen * 1.01, 4);
            cableGeo.rotateX(Math.PI / 2);
            cableGeo.rotateY(yaw);
            cableGeo.translate((p1.x + p2.x) / 2, wallHeight + 0.6 + cb * 0.7, (p1.z + p2.z) / 2);
            cableGeos.push(cableGeo);
          }

          accumulatedDistance += segLen;
        }
      }

      // Physics collision registration: continuous unbroken barrier polyline
      for (let seg = 0; seg < numSegments; seg++) {
        const p1 = points[seg];
        const p2 = isClosed ? points[(seg + 1) % N] : points[seg + 1];
        const midX = (p1.x + p2.x) / 2;
        const midZ = (p1.z + p2.z) / 2;
        const len = Math.hypot(p2.x - p1.x, p2.z - p1.z);

        staticObstacles.push({
          x: midX,
          z: midZ,
          radius: len / 2,
          isWallSegment: true,
          p1: { x: p1.x, z: p1.z },
          p2: { x: p2.x, z: p2.z },
          type: 'wall',
        });
      }
    };

    // 1. Full Outer Perimeter Continuous Rounded Safety Barrier
    const outerPoints: { x: number; z: number }[] = [];
    const outerR = cornerRadius + w / 2 + 2.0; // 50.0
    const cornerSegments = 20;
    const straightSegments = 46;

    // South Straight
    for (let i = 0; i < straightSegments; i++) {
      const t = i / straightSegments;
      outerPoints.push({ x: -c + (2 * c) * t, z: -outerHalf });
    }

    // Turn 1 Outer Corner
    for (let i = 0; i < cornerSegments; i++) {
      const a = -Math.PI / 2 + (i / cornerSegments) * (Math.PI / 2);
      outerPoints.push({ x: c + Math.cos(a) * outerR, z: -c + Math.sin(a) * outerR });
    }

    // East Straight
    for (let i = 0; i < straightSegments; i++) {
      const t = i / straightSegments;
      outerPoints.push({ x: outerHalf, z: -c + (2 * c) * t });
    }

    // Turn 2 Outer Corner
    for (let i = 0; i < cornerSegments; i++) {
      const a = (i / cornerSegments) * (Math.PI / 2);
      outerPoints.push({ x: c + Math.cos(a) * outerR, z: c + Math.sin(a) * outerR });
    }

    // North Straight
    for (let i = 0; i < straightSegments; i++) {
      const t = i / straightSegments;
      outerPoints.push({ x: c - (2 * c) * t, z: outerHalf });
    }

    // Turn 3 Outer Corner
    for (let i = 0; i < cornerSegments; i++) {
      const a = Math.PI / 2 + (i / cornerSegments) * (Math.PI / 2);
      outerPoints.push({ x: -c + Math.cos(a) * outerR, z: c + Math.sin(a) * outerR });
    }

    // West Straight
    for (let i = 0; i < straightSegments; i++) {
      const t = i / straightSegments;
      outerPoints.push({ x: -outerHalf, z: c - (2 * c) * t });
    }

    // Turn 4 Outer Corner
    for (let i = 0; i < cornerSegments; i++) {
      const a = Math.PI + (i / cornerSegments) * (Math.PI / 2);
      outerPoints.push({ x: -c + Math.cos(a) * outerR, z: -c + Math.sin(a) * outerR });
    }

    loftContinuousBarrier(outerPoints, true, true);

    // 2. North, East, West Inner Continuous Barrier & Corner Arcs
    const innerCornerR = cornerRadius - w / 2 - 2.0; // 30.0

    // Inner Turn 2
    const turn2InnerPoints: { x: number; z: number }[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      turn2InnerPoints.push({ x: innerHalf, z: -c + (2 * c) * t });
    }
    for (let i = 1; i <= cornerSegments; i++) {
      const a = (i / cornerSegments) * (Math.PI / 2);
      turn2InnerPoints.push({ x: c + Math.cos(a) * innerCornerR, z: c + Math.sin(a) * innerCornerR });
    }
    for (let i = 1; i <= straightSegments; i++) {
      const t = i / straightSegments;
      turn2InnerPoints.push({ x: c - (2 * c) * t, z: innerHalf });
    }
    for (let i = 1; i <= cornerSegments; i++) {
      const a = Math.PI / 2 + (i / cornerSegments) * (Math.PI / 2);
      turn2InnerPoints.push({ x: -c + Math.cos(a) * innerCornerR, z: c + Math.sin(a) * innerCornerR });
    }
    for (let i = 1; i <= straightSegments; i++) {
      const t = i / straightSegments;
      turn2InnerPoints.push({ x: -innerHalf, z: c - (2 * c) * t });
    }
    loftContinuousBarrier(turn2InnerPoints, false, true);

    // Turn 4 to Paddock Transitions
    const turn4Transition: { x: number; z: number }[] = [
      { x: -innerHalf, z: -c },
      { x: -c, z: -105.8 },
      { x: c, z: -105.8 },
      { x: innerHalf, z: -c },
    ];
    loftContinuousBarrier(turn4Transition, false, false);

    // Turn 1 Inner Apex Barrier
    const turn1ApexPoints: { x: number; z: number }[] = [];
    for (let i = 0; i <= cornerSegments; i++) {
      const a = -Math.PI / 2 + (i / cornerSegments) * (Math.PI / 2);
      turn1ApexPoints.push({ x: c + Math.cos(a) * innerCornerR, z: -c + Math.sin(a) * innerCornerR });
    }
    loftContinuousBarrier(turn1ApexPoints, false, true);

    // Turn 4 Inner Apex Barrier
    const turn4ApexPoints: { x: number; z: number }[] = [];
    for (let i = 0; i <= cornerSegments; i++) {
      const a = Math.PI + (i / cornerSegments) * (Math.PI / 2);
      turn4ApexPoints.push({ x: -c + Math.cos(a) * innerCornerR, z: -c + Math.sin(a) * innerCornerR });
    }
    loftContinuousBarrier(turn4ApexPoints, false, true);

    // 3. Pit Wall separating main track and pit lane
    const pitWallPoints: { x: number; z: number }[] = [];
    const pitWallSegments = 16;
    for (let i = 0; i <= pitWallSegments; i++) {
      const t = i / pitWallSegments;
      pitWallPoints.push({ x: -48 + (44 - -48) * t, z: -121.5 });
    }
    loftContinuousBarrier(pitWallPoints, false, false);

    if (concretePositions.length > 0) {
      const concreteGeo = new THREE.BufferGeometry();
      concreteGeo.setAttribute('position', new THREE.Float32BufferAttribute(concretePositions, 3));
      concreteGeo.setAttribute('uv', new THREE.Float32BufferAttribute(concreteUVs, 2));
      concreteGeo.setIndex(concreteIndices);
      concreteGeo.computeVertexNormals();
      const concreteMesh = new THREE.Mesh(concreteGeo, materials.concreteBarrierMat);
      concreteMesh.castShadow = false;
      concreteMesh.receiveShadow = true;
      group.add(concreteMesh);
    }

    if (postMatrices.length > 0) {
      const postInst = new THREE.InstancedMesh(sharedPostGeo, materials.metalFenceMat, postMatrices.length);
      postMatrices.forEach((mat, idx) => postInst.setMatrixAt(idx, mat));
      postInst.castShadow = false;
      postInst.receiveShadow = false;
      postInst.instanceMatrix.needsUpdate = true;
      group.add(postInst);
    }

    if (cableGeos.length > 0) {
      const mergedCableGeo = safeMergeAndDispose(cableGeos, false);
      if (mergedCableGeo) {
        const cableMesh = new THREE.Mesh(mergedCableGeo, materials.metalFenceMat);
        cableMesh.castShadow = false;
        cableMesh.receiveShadow = false;
        group.add(cableMesh);
      }
    }
  }

  /**
   * High-Impact Tecpro Energy Absorbing Barrier Blocks in Runoff Zones
   */
  public static buildTecproRunoffZones(
    group: THREE.Group,
    materials: TrackMaterials,
    staticObstacles: StaticObstacle[],
    innerCornerCenter: number,
    trackWidth: number,
    cornerRadius: number
  ): void {
    const tecproGroup = new THREE.Group();
    const c = innerCornerCenter;
    const w = trackWidth;
    const outerR = cornerRadius + w / 2 + 1.2;

    const corners = [
      { cx: c, cz: -c, start: -Math.PI / 2 },
      { cx: c, cz: c, start: 0 },
      { cx: -c, cz: c, start: Math.PI / 2 },
      { cx: -c, cz: -c, start: Math.PI },
    ];

    const redGeos: THREE.BufferGeometry[] = [];
    const whiteGeos: THREE.BufferGeometry[] = [];
    const baseBlockGeo = new THREE.BoxGeometry(0.85, 1.1, 1.8);

    corners.forEach((corn) => {
      for (let b = 0; b < 8; b++) {
        const angle = corn.start + (b + 0.5) * ((Math.PI / 2) / 8);
        const bx = corn.cx + Math.cos(angle) * (outerR + 0.8);
        const bz = corn.cz + Math.sin(angle) * (outerR + 0.8);

        const geo = baseBlockGeo.clone();
        geo.rotateY(-angle);
        geo.translate(bx, 0.55, bz);

        if (b % 2 === 0) {
          redGeos.push(geo);
        } else {
          whiteGeos.push(geo);
        }

        const bHalf = 0.9;
        const tangX = -Math.sin(angle);
        const tangZ = Math.cos(angle);
        staticObstacles.push({
          x: bx,
          z: bz,
          radius: 1.2,
          isWallSegment: true,
          p1: { x: bx - tangX * bHalf, z: bz - tangZ * bHalf },
          p2: { x: bx + tangX * bHalf, z: bz + tangZ * bHalf },
          type: 'tecpro',
        });
      }
    });

    if (redGeos.length > 0) {
      const redMerged = safeMergeAndDispose(redGeos, false);
      if (redMerged) {
        const redMesh = new THREE.Mesh(redMerged, materials.tecproRedMat);
        redMesh.receiveShadow = true;
        tecproGroup.add(redMesh);
      }
    }
    if (whiteGeos.length > 0) {
      const whiteMerged = safeMergeAndDispose(whiteGeos, false);
      if (whiteMerged) {
        const whiteMesh = new THREE.Mesh(whiteMerged, materials.tecproWhiteMat);
        whiteMesh.receiveShadow = true;
        tecproGroup.add(whiteMesh);
      }
    }

    group.add(tecproGroup);
  }
}
