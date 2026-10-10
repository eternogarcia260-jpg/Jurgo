/**
 * TrackStructuresBuilder.ts - Circuit Architecture, Grandstands, VIP Facilities & Lighting
 * Builds the South Main Amphitheater, North Secondary Grandstand, Modern VIP Headquarters,
 * Paddock Club garages, overhead gantries, aerodynamic arches, and 24 stadium floodlight towers.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { safeMergeBufferGeometries } from '../../utils/GeometryUtils';
import { GrandstandCrowdSystem, CrowdPlacementConfig } from '../../crowd/GrandstandCrowdSystem';
import { CurvedPitBuildingBuilder } from '../CurvedPitBuildingBuilder';
import { ModernVIPBuildingBuilder } from '../ModernVIPBuildingBuilder';
import { PitEntryGantryBuilder } from '../PitEntryGantryBuilder';
import { StaticObstacle } from '../TrackBuilder';
import { TrackMaterials } from './TrackMaterials';
import { TrackTextureFactory } from './TrackTextureFactory';

export class TrackStructuresBuilder {
  /**
   * Helper to build a seamless curved amphitheater tier with zero rectangular boxiness
   */
  public static createCurvedAmphitheaterTier(
    width: number,
    depth: number,
    height: number,
    baseY: number,
    centerZ: number,
    segments: number = 32
  ): THREE.BufferGeometry {
    const halfW = width / 2;
    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    for (let row = 0; row < 4; row++) {
      const isTop = row === 1 || row === 2;
      const isBack = row === 2 || row === 3;
      const y = isTop ? baseY : baseY - height;
      const zOffset = isBack ? -depth / 2 : depth / 2;

      for (let s = 0; s <= segments; s++) {
        const u = s / segments;
        const x = -halfW + u * width;
        const curveOffset = Math.pow(x / halfW, 2) * 3.5;
        const z = centerZ + zOffset + curveOffset;

        vertices.push(x, y, z);
        uvs.push(u, isBack ? 1 : 0);
      }
    }

    const rowStride = segments + 1;
    for (let s = 0; s < segments; s++) {
      const a = s;
      const b = s + 1;
      const c = rowStride + s + 1;
      const d = rowStride + s;
      indices.push(a, b, c, a, c, d);
    }
    for (let s = 0; s < segments; s++) {
      const a = rowStride + s;
      const b = rowStride + s + 1;
      const c = 2 * rowStride + s + 1;
      const d = 2 * rowStride + s;
      indices.push(a, b, c, a, c, d);
    }
    for (let s = 0; s < segments; s++) {
      const a = 2 * rowStride + s;
      const b = 2 * rowStride + s + 1;
      const c = 3 * rowStride + s + 1;
      const d = 3 * rowStride + s;
      indices.push(a, b, c, a, c, d);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Fluid Organic Grandstands: South Amphitheater, Tensile Canopy, VIP Aero Pods & North Stand
   */
  public static buildGrandstands(
    group: THREE.Group,
    materials: TrackMaterials,
    crowdSystem: GrandstandCrowdSystem
  ): void {
    const standsGroup = new THREE.Group();
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
    const southConcreteGeos: THREE.BufferGeometry[] = [];

    // 1. SOUTH MAIN GRANDSTAND
    const southFoundationGeo = this.createCurvedAmphitheaterTier(130, 26, 2.2, 1.8, -158.0, 40);
    southConcreteGeos.push(southFoundationGeo);

    [-65, 65].forEach((capX) => {
      const capGeo = new THREE.CylinderGeometry(2.6, 3.8, 2.8, 16);
      capGeo.translate(capX, 1.4, -154.5);
      southConcreteGeos.push(capGeo);

      const crownGeo = new THREE.SphereGeometry(2.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      crownGeo.translate(capX, 2.8, -154.5);
      southConcreteGeos.push(crownGeo);
    });

    const vomitorioXs = [-42, -14, 14, 42];
    vomitorioXs.forEach((vx) => {
      const vaultGeo = new THREE.CylinderGeometry(1.8, 1.8, 8.0, 14, 1, true, 0, Math.PI);
      vaultGeo.rotateZ(Math.PI / 2);
      vaultGeo.translate(vx, 2.0, -153.0);
      southConcreteGeos.push(vaultGeo);

      const portalArchGeo = new THREE.TorusGeometry(1.85, 0.22, 8, 16, Math.PI);
      portalArchGeo.translate(vx, 2.0, -149.0);
      southConcreteGeos.push(portalArchGeo);
    });

    const bayRedMatrices: THREE.Matrix4[][] = [[], [], []];
    const bayBlueMatrices: THREE.Matrix4[][] = [[], [], []];
    const bayGoldMatrices: THREE.Matrix4[][] = [[], [], []];
    const railingGeos: THREE.BufferGeometry[] = [];
    const seatDummy = new THREE.Object3D();

    const seatPanGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.08, 6);
    seatPanGeo.translate(0, 0.04, 0);

    const seatBackGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.34, 6, 1, true, -Math.PI * 0.40, Math.PI * 0.80);
    seatBackGeo.rotateY(Math.PI / 2);
    seatBackGeo.translate(0, 0.22, -0.11);

    const baseSeatUnit = safeMergeBufferGeometries([seatPanGeo, seatBackGeo]) || seatPanGeo;

    const tiers = 10;
    for (let t = 0; t < tiers; t++) {
      const tierWidth = 126 - t * 2.2;
      const tierDepth = 2.05;
      const tierHeight = 1.18;
      const baseY = 2.0 + t * 1.18;
      const centerZ = -149.5 - t * 2.0;

      const tierGeo = this.createCurvedAmphitheaterTier(tierWidth, tierDepth, tierHeight, baseY, centerZ, 32);
      southConcreteGeos.push(tierGeo);

      const halfW = tierWidth / 2;
      const seatPitch = 0.78;
      const seatCount = Math.floor((tierWidth - 2.8) / seatPitch);

      for (let s = 0; s <= seatCount; s++) {
        const sx = -halfW + 1.4 + s * seatPitch;
        if (
          Math.abs(sx) < 1.1 ||
          Math.abs(sx - 28) < 1.1 ||
          Math.abs(sx + 28) < 1.1 ||
          Math.abs(sx - 52) < 1.1 ||
          Math.abs(sx + 52) < 1.1
        ) {
          continue;
        }

        const curveOffset = Math.pow(sx / halfW, 2) * 3.5;
        const sz = centerZ + 0.25 + curveOffset;

        const dx = 0.05;
        const dz = (Math.pow((sx + dx) / halfW, 2) - Math.pow(sx / halfW, 2)) * 3.5;
        const yawAngle = -Math.atan2(dz, dx);

        seatDummy.position.set(sx, baseY + 0.06, sz);
        seatDummy.rotation.set(0, yawAngle, 0);
        seatDummy.scale.set(1, 1, 1);
        seatDummy.updateMatrix();

        const bayIdx = sx < -20 ? 0 : (sx > 20 ? 2 : 1);
        if (Math.abs(sx) < 13.0 && t >= 2 && t <= 7) {
          bayGoldMatrices[bayIdx].push(seatDummy.matrix.clone());
        } else if (t % 2 === 0) {
          bayRedMatrices[bayIdx].push(seatDummy.matrix.clone());
        } else {
          bayBlueMatrices[bayIdx].push(seatDummy.matrix.clone());
        }
      }
    }

    const frontHalfW = 126 / 2;
    const railPoints: THREE.Vector3[] = [];
    for (let rp = 0; rp <= 24; rp++) {
      const ru = rp / 24;
      const rx = -frontHalfW + ru * 126;
      const rz = -149.5 + 1.1 + Math.pow(rx / frontHalfW, 2) * 3.5;
      railPoints.push(new THREE.Vector3(rx, 2.85, rz));
    }
    const frontRailCurve = new THREE.CatmullRomCurve3(railPoints);
    const frontRailGeo = new THREE.TubeGeometry(frontRailCurve, 28, 0.06, 6, false);
    railingGeos.push(frontRailGeo);

    for (let up = 0; up <= 16; up++) {
      const u = up / 16;
      const px = -frontHalfW + 2 + u * (126 - 4);
      const pz = -149.5 + 1.1 + Math.pow(px / frontHalfW, 2) * 3.5;
      const postGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.95, 6);
      postGeo.translate(px, 2.4, pz);
      railingGeos.push(postGeo);

      const capBall = new THREE.SphereGeometry(0.07, 6, 6);
      capBall.translate(px, 2.88, pz);
      railingGeos.push(capBall);
    }

    const redSeatMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
    const blueSeatMat = new THREE.MeshLambertMaterial({ color: 0x1d4ed8 });
    const goldSeatMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });

    for (let b = 0; b < 3; b++) {
      if (bayRedMatrices[b].length > 0) {
        const count = bayRedMatrices[b].length;
        const redInst = new THREE.InstancedMesh(baseSeatUnit, redSeatMat, count);
        for (let i = 0; i < count; i++) {
          redInst.setMatrixAt(i, bayRedMatrices[b][i]);
        }
        redInst.instanceMatrix.needsUpdate = true;
        redInst.castShadow = false;
        redInst.receiveShadow = false;
        redInst.computeBoundingSphere();
        redInst.computeBoundingBox();
        standsGroup.add(redInst);
      }
      if (bayBlueMatrices[b].length > 0) {
        const count = bayBlueMatrices[b].length;
        const blueInst = new THREE.InstancedMesh(baseSeatUnit, blueSeatMat, count);
        for (let i = 0; i < count; i++) {
          blueInst.setMatrixAt(i, bayBlueMatrices[b][i]);
        }
        blueInst.instanceMatrix.needsUpdate = true;
        blueInst.castShadow = false;
        blueInst.receiveShadow = false;
        blueInst.computeBoundingSphere();
        blueInst.computeBoundingBox();
        standsGroup.add(blueInst);
      }
      if (bayGoldMatrices[b].length > 0) {
        const count = bayGoldMatrices[b].length;
        const goldInst = new THREE.InstancedMesh(baseSeatUnit, goldSeatMat, count);
        for (let i = 0; i < count; i++) {
          goldInst.setMatrixAt(i, bayGoldMatrices[b][i]);
        }
        goldInst.instanceMatrix.needsUpdate = true;
        goldInst.castShadow = false;
        goldInst.receiveShadow = false;
        goldInst.computeBoundingSphere();
        goldInst.computeBoundingBox();
        standsGroup.add(goldInst);
      }
    }

    const structureGeos: THREE.BufferGeometry[] = [];
    const ribXs = [-60, -48, -36, -24, -12, 0, 12, 24, 36, 48, 60];

    ribXs.forEach((rx) => {
      const crestY = 21.0 + Math.cos((rx / 60) * (Math.PI * 0.45)) * 2.8;
      const points = [
        new THREE.Vector3(rx, 0.6, -172.0),
        new THREE.Vector3(rx, 12.5, -170.0),
        new THREE.Vector3(rx, crestY, -160.0),
        new THREE.Vector3(rx, crestY - 2.6, -149.0),
        new THREE.Vector3(rx, crestY - 6.0, -142.5),
      ];
      const spineCurve = new THREE.CatmullRomCurve3(points);
      const spineGeo = new THREE.TubeGeometry(spineCurve, 24, 0.46, 10, false);
      structureGeos.push(spineGeo);

      [-2.6, 2.6].forEach((dx) => {
        const strutP1 = new THREE.Vector3(rx + dx, 0.3, -174.5);
        const strutP2 = new THREE.Vector3(rx, 12.0, -170.0);
        const strutCurve = new THREE.LineCurve3(strutP1, strutP2);
        const strutGeo = new THREE.TubeGeometry(strutCurve, 8, 0.28, 8, false);
        structureGeos.push(strutGeo);
      });
    });

    const membraneWidth = 126;
    const membraneDepth = 30;
    const membraneSegmentsX = 32;
    const membraneSegmentsZ = 16;
    const membraneGeo = new THREE.PlaneGeometry(membraneWidth, membraneDepth, membraneSegmentsX, membraneSegmentsZ);
    membraneGeo.rotateX(-Math.PI / 2);
    membraneGeo.translate(0, 0, -157.0);

    const mPos = membraneGeo.attributes.position;
    for (let i = 0; i < mPos.count; i++) {
      const vx = mPos.getX(i);
      const vz = mPos.getZ(i);
      const normX = vx / (membraneWidth / 2);
      const normZ = (vz - (-157.0)) / (membraneDepth / 2);

      const archProfile = 1 - Math.pow(normZ - 0.15, 2);
      const waveProfile = Math.cos(normX * Math.PI * 0.45);
      const wy = 17.2 + archProfile * 4.4 + waveProfile * 2.5;
      mPos.setY(i, wy);
    }
    membraneGeo.computeVertexNormals();
    structureGeos.push(membraneGeo);

    if (structureGeos.length > 0) {
      const mergedStructure = safeMergeBufferGeometries(structureGeos);
      if (mergedStructure) {
        const structureMesh = new THREE.Mesh(mergedStructure, materials.metalSilverMat);
        structureMesh.geometry.computeBoundingSphere();
        structureMesh.geometry.computeBoundingBox();
        structureMesh.castShadow = false;
        structureMesh.receiveShadow = false;
        standsGroup.add(structureMesh);
      }
    }

    if (railingGeos.length > 0) {
      const mergedRailing = safeMergeBufferGeometries(railingGeos);
      if (mergedRailing) {
        const railMesh = new THREE.Mesh(mergedRailing, materials.metalSilverMat);
        railMesh.geometry.computeBoundingSphere();
        railMesh.geometry.computeBoundingBox();
        railMesh.castShadow = false;
        railMesh.receiveShadow = false;
        standsGroup.add(railMesh);
      }
    }

    // VIP Aero Lounge Capsule Pods
    const podGeos: THREE.BufferGeometry[] = [];
    const glassGeos: THREE.BufferGeometry[] = [];
    const podConfigs = [
      { x: 0, length: 24, radius: 2.3 },
      { x: -38, length: 16, radius: 2.0 },
      { x: 38, length: 16, radius: 2.0 },
    ];

    podConfigs.forEach((cfg) => {
      const podZ = -162.0;
      const podY = 13.5;

      const podCyl = new THREE.CylinderGeometry(cfg.radius, cfg.radius, cfg.length, 18);
      podCyl.rotateZ(Math.PI / 2);
      podCyl.translate(cfg.x, podY, podZ);
      podGeos.push(podCyl);

      const leftCap = new THREE.SphereGeometry(cfg.radius, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      leftCap.rotateZ(Math.PI / 2);
      leftCap.translate(cfg.x - cfg.length / 2, podY, podZ);
      podGeos.push(leftCap);

      const rightCap = new THREE.SphereGeometry(cfg.radius, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      rightCap.rotateZ(-Math.PI / 2);
      rightCap.translate(cfg.x + cfg.length / 2, podY, podZ);
      podGeos.push(rightCap);

      const glassSector = new THREE.CylinderGeometry(
        cfg.radius + 0.04,
        cfg.radius + 0.04,
        cfg.length - 2.0,
        18,
        1,
        true,
        Math.PI * 0.5,
        Math.PI
      );
      glassSector.rotateZ(Math.PI / 2);
      glassSector.translate(cfg.x, podY, podZ);
      glassGeos.push(glassSector);
    });

    if (podGeos.length > 0) {
      const mergedPod = safeMergeBufferGeometries(podGeos);
      if (mergedPod) {
        const podMesh = new THREE.Mesh(mergedPod, materials.metalDarkMat);
        podMesh.geometry.computeBoundingSphere();
        podMesh.geometry.computeBoundingBox();
        podMesh.castShadow = false;
        podMesh.receiveShadow = false;
        standsGroup.add(podMesh);
      }
    }
    if (glassGeos.length > 0) {
      const mergedGlass = safeMergeBufferGeometries(glassGeos);
      if (mergedGlass) {
        const glassMesh = new THREE.Mesh(mergedGlass, materials.glassMat);
        glassMesh.geometry.computeBoundingSphere();
        glassMesh.geometry.computeBoundingBox();
        glassMesh.castShadow = false;
        glassMesh.receiveShadow = false;
        standsGroup.add(glassMesh);
      }
    }

    // Ribbon Sponsor Board
    const ribbonCanvas = document.createElement('canvas');
    ribbonCanvas.width = 1024;
    ribbonCanvas.height = 128;
    const rCtx = ribbonCanvas.getContext('2d')!;
    rCtx.fillStyle = '#0f172a';
    rCtx.beginPath();
    rCtx.roundRect(12, 12, 1000, 104, 28);
    rCtx.fill();
    rCtx.fillStyle = '#ef4444';
    rCtx.beginPath();
    rCtx.roundRect(24, 18, 976, 8, 4);
    rCtx.fill();
    rCtx.fillStyle = '#f59e0b';
    rCtx.beginPath();
    rCtx.roundRect(24, 102, 976, 8, 4);
    rCtx.fill();
    rCtx.fillStyle = '#ffffff';
    rCtx.font = 'bold 44px sans-serif';
    rCtx.textAlign = 'center';
    rCtx.fillText('APEX GRAND PRIX  ·  PIRELLI  ·  BREMBO  ·  SHELL  ·  ROLEX', 512, 70);

    const ribbonTex = new THREE.CanvasTexture(ribbonCanvas);
    const ribbonMat = new THREE.MeshBasicMaterial({ map: ribbonTex, transparent: true });

    const sponsorRibbonGeo = new THREE.CylinderGeometry(
      160,
      160,
      2.4,
      32,
      1,
      true,
      Math.PI * 0.38,
      Math.PI * 0.24
    );
    sponsorRibbonGeo.rotateZ(Math.PI / 2);
    sponsorRibbonGeo.rotateY(Math.PI / 2);
    const sponsorMesh = new THREE.Mesh(sponsorRibbonGeo, ribbonMat);
    sponsorMesh.position.set(0, 2.5, -145.2);
    sponsorMesh.geometry.computeBoundingSphere();
    sponsorMesh.geometry.computeBoundingBox();
    sponsorMesh.castShadow = false;
    sponsorMesh.receiveShadow = false;
    standsGroup.add(sponsorMesh);

    if (southConcreteGeos.length > 0) {
      const mergedSouthConcrete = safeMergeBufferGeometries(southConcreteGeos);
      if (mergedSouthConcrete) {
        const southConcreteMesh = new THREE.Mesh(mergedSouthConcrete, concreteMat);
        southConcreteMesh.geometry.computeBoundingSphere();
        southConcreteMesh.geometry.computeBoundingBox();
        southConcreteMesh.castShadow = false;
        southConcreteMesh.receiveShadow = false;
        standsGroup.add(southConcreteMesh);
      }
    }

    // 2. NORTH SECONDARY GRANDSTAND
    const northGrandstandGroup = new THREE.Group();
    northGrandstandGroup.name = 'NorthSecondaryGrandstand';

    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      '/models/photorealistic_secondary_grandstand.glb',
      (gltf) => {
        const grandstandModel = gltf.scene;
        const texLoader = new THREE.TextureLoader();
        let bannerTexture: THREE.Texture | null = null;

        grandstandModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            mesh.geometry.computeBoundingSphere();
            mesh.geometry.computeBoundingBox();
            if (mesh.material) {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              mat.roughness = Math.max(0.40, mat.roughness);
              mat.side = THREE.DoubleSide;
              const meshNameLow = mesh.name.toLowerCase();
              if (meshNameLow.includes('canopy')) {
                mat.color.setHex(0x94a3b8);
                mat.roughness = 0.65;
              } else if (meshNameLow.includes('deck') || meshNameLow.includes('scaffold')) {
                mat.color.multiplyScalar(0.70);
                mat.roughness = Math.max(0.50, mat.roughness);
              } else if (meshNameLow.includes('seat')) {
                mat.color.multiplyScalar(0.75);
                mat.roughness = Math.max(0.55, mat.roughness);
              }
              if (mesh.name.includes('Banner') && !mat.map) {
                if (!bannerTexture) {
                  bannerTexture = texLoader.load('/textures/grandstands/sponsor_banner_apex.png');
                  bannerTexture.anisotropy = 16;
                }
                mat.map = bannerTexture;
              }
              mat.needsUpdate = true;
            }
          }
        });
        while (northGrandstandGroup.children.length > 0) {
          northGrandstandGroup.remove(northGrandstandGroup.children[0]);
        }
        northGrandstandGroup.add(grandstandModel);
      },
      undefined,
      (err) => {
        console.warn('Fallback to procedural secondary grandstand:', err);
      }
    );

    const procFallback = this.buildProceduralSecondaryGrandstandFallback();
    northGrandstandGroup.add(procFallback);
    standsGroup.add(northGrandstandGroup);

    // 3. POPULATE DENSE 3D HUMAN SPECTATOR CROWD & ANIMATED FLAGS
    const placements: CrowdPlacementConfig[] = [];
    const southCrowd = GrandstandCrowdSystem.generateSouthAmphitheaterCrowd(126, 10, 1.18, -149.5, 0.88);
    placements.push(...southCrowd);

    const northCrowd = GrandstandCrowdSystem.generateNorthBankCrowd(88, 6, 0.98, 152.0, 0.88);
    placements.push(...northCrowd);

    crowdSystem.generateCrowd(placements);
    group.add(crowdSystem.group);
    group.add(standsGroup);
  }

  public static buildProceduralSecondaryGrandstandFallback(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'ProceduralSecondaryGrandstandFallback';

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.75, roughness: 0.45 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.60, roughness: 0.55 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const seatRedMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.60 });
    const seatBlueMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.60 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.65, side: THREE.DoubleSide });

    const concreteGeos: THREE.BufferGeometry[] = [];
    const deckGeos: THREE.BufferGeometry[] = [];
    const scaffoldGeos: THREE.BufferGeometry[] = [];
    const redSeatGeos: THREE.BufferGeometry[] = [];
    const blueSeatGeos: THREE.BufferGeometry[] = [];

    const width = 88;
    const tiers = 6;
    const tierRise = 0.98;
    const tierRun = 2.15;
    const baseZ = 152.0;
    const baseY = 1.80;

    const fGeo = this.createCurvedAmphitheaterTier(width, 16, 2.4, baseY, baseZ + 6.0, 32);
    concreteGeos.push(fGeo);

    for (let t = 0; t < tiers; t++) {
      const tWidth = width - t * 2.0;
      const tY = baseY + t * tierRise;
      const tZ = baseZ + t * tierRun;
      const tierGeo = this.createCurvedAmphitheaterTier(tWidth, tierRun, tierRise, tY, tZ + tierRun * 0.5, 28);
      deckGeos.push(tierGeo);

      const halfW = tWidth / 2;
      const seatPitch = 1.0;
      const count = Math.floor((tWidth - 2.4) / seatPitch);
      for (let s = 0; s <= count; s++) {
        const sx = -halfW + 1.2 + s * seatPitch;
        if (Math.abs(sx) < 1.2 || Math.abs(sx - 24) < 1.2 || Math.abs(sx + 24) < 1.2) continue;
        const curveOffset = Math.pow(sx / (width / 2), 2) * 3.2;
        const sz = tZ + 0.65 + curveOffset;

        const seatBox = new THREE.BoxGeometry(0.42, 0.38, 0.36);
        seatBox.translate(sx, tY + 0.32, sz);
        if (Math.abs(sx) < 14) {
          blueSeatGeos.push(seatBox);
        } else {
          redSeatGeos.push(seatBox);
        }
      }
    }

    for (let x = -40; x <= 40; x += 8) {
      const cz = Math.pow(x / (width / 2), 2) * 3.2;
      const pillarGeo = new THREE.CylinderGeometry(0.12, 0.12, 11.5, 6);
      pillarGeo.translate(x, 5.75, baseZ + tiers * tierRun + cz);
      scaffoldGeos.push(pillarGeo);
    }

    const canopyGeo = this.createCurvedAmphitheaterTier(width + 2, 18, 0.15, baseY + tiers * tierRise + 4.8, baseZ + 5.5, 32);
    const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
    canopyMesh.castShadow = false;
    canopyMesh.receiveShadow = false;
    group.add(canopyMesh);

    const mConc = safeMergeBufferGeometries(concreteGeos);
    if (mConc) group.add(new THREE.Mesh(mConc, concreteMat));

    const mDeck = safeMergeBufferGeometries(deckGeos);
    if (mDeck) group.add(new THREE.Mesh(mDeck, deckMat));

    const mScaff = safeMergeBufferGeometries(scaffoldGeos);
    if (mScaff) group.add(new THREE.Mesh(mScaff, steelMat));

    const mRed = safeMergeBufferGeometries(redSeatGeos);
    if (mRed) group.add(new THREE.Mesh(mRed, seatRedMat));

    const mBlue = safeMergeBufferGeometries(blueSeatGeos);
    if (mBlue) group.add(new THREE.Mesh(mBlue, seatBlueMat));

    return group;
  }

  public static buildPaddockBuildingAndPitLane(group: THREE.Group, materials: TrackMaterials): void {
    const curvedPaddock = CurvedPitBuildingBuilder.buildCurvedPitBuilding(
      {
        metalDarkMat: materials.metalDarkMat,
        metalSilverMat: materials.metalSilverMat,
        glassMat: materials.glassMat,
        concreteMat: materials.concreteBarrierMat,
      },
      96.0,
      { x: -2.0, y: 0, z: -99.0 }
    );

    const stallBoxGeo = new THREE.PlaneGeometry(4.8, 8.5);
    stallBoxGeo.rotateX(-Math.PI / 2);
    const stallCanvas = document.createElement('canvas');
    stallCanvas.width = 256;
    stallCanvas.height = 512;
    const sCtx = stallCanvas.getContext('2d');
    if (sCtx) {
      sCtx.clearRect(0, 0, 256, 512);
      sCtx.strokeStyle = '#ffffff';
      sCtx.lineWidth = 14;
      sCtx.strokeRect(10, 10, 236, 492);
      sCtx.fillStyle = '#facc15';
      sCtx.fillRect(16, 80, 48, 48);
      sCtx.fillRect(192, 80, 48, 48);
      sCtx.fillRect(16, 380, 48, 48);
      sCtx.fillRect(192, 380, 48, 48);
      sCtx.fillStyle = '#ef4444';
      sCtx.fillRect(40, 240, 176, 28);
      sCtx.font = 'bold 36px monospace';
      sCtx.fillStyle = '#ffffff';
      sCtx.textAlign = 'center';
      sCtx.fillText('RIVAL', 128, 200);
    }
    const stallTex = new THREE.CanvasTexture(stallCanvas);
    stallTex.colorSpace = THREE.SRGBColorSpace;
    const stallMat = new THREE.MeshStandardMaterial({
      map: stallTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -2.0,
      roughness: 0.6,
    });
    const stallMesh = new THREE.Mesh(stallBoxGeo, stallMat);
    stallMesh.position.set(22.0, 0.016, -110.5);
    stallMesh.renderOrder = 2;
    curvedPaddock.add(stallMesh);

    group.add(curvedPaddock);
  }

  public static buildModernVIPArchitecture(group: THREE.Group, staticObstacles: StaticObstacle[]): void {
    const modernVIPBuilding = ModernVIPBuildingBuilder.buildModernVIPBuilding(
      { x: 88.0, y: 0, z: -152.0 },
      Math.PI
    );
    group.add(modernVIPBuilding);

    staticObstacles.push({
      x: 88.0,
      z: -152.0,
      radius: 16.0,
      type: 'building',
    });
  }

  public static buildPitEntryAndExitArchitecture(group: THREE.Group, materials: TrackMaterials): void {
    const pitEntryGroup = new THREE.Group();
    const noseX = -48;
    const noseZ = -121.5;

    const cushionGeo = new THREE.BoxGeometry(2.4, 1.35, 1.2);
    const cushionCanvas = document.createElement('canvas');
    cushionCanvas.width = 256;
    cushionCanvas.height = 128;
    const cCtx = cushionCanvas.getContext('2d')!;
    cCtx.fillStyle = '#d49e15';
    cCtx.fillRect(0, 0, 256, 128);

    const cGrime = cCtx.createLinearGradient(0, 80, 0, 128);
    cGrime.addColorStop(0, 'rgba(18, 20, 26, 0.0)');
    cGrime.addColorStop(1, 'rgba(18, 20, 26, 0.55)');
    cCtx.fillStyle = cGrime;
    cCtx.fillRect(0, 80, 256, 48);

    cCtx.fillStyle = '#11141a';
    cCtx.lineWidth = 28;
    for (let x = -100; x < 350; x += 55) {
      cCtx.beginPath();
      cCtx.moveTo(x, 128);
      cCtx.lineTo(x + 50, 0);
      cCtx.lineTo(x + 75, 0);
      cCtx.lineTo(x + 25, 128);
      cCtx.fill();
    }
    const cushionTex = new THREE.CanvasTexture(cushionCanvas);
    const cushionMat = new THREE.MeshStandardMaterial({
      map: cushionTex,
      roughness: 0.65,
      metalness: 0.15,
    });
    const cushionMesh = new THREE.Mesh(cushionGeo, cushionMat);
    cushionMesh.position.set(noseX - 1.2, 0.68, noseZ);
    cushionMesh.castShadow = false;
    pitEntryGroup.add(cushionMesh);

    for (let cyl = 0; cyl < 4; cyl++) {
      const cylGeo = new THREE.CylinderGeometry(0.48 - cyl * 0.04, 0.48 - cyl * 0.04, 1.2, 16);
      const cylMat = new THREE.MeshStandardMaterial({ color: cyl % 2 === 0 ? 0xd49e15 : 0x1e293b, roughness: 0.60 });
      const cylMesh = new THREE.Mesh(cylGeo, cylMat);
      cylMesh.position.set(noseX - 2.8 - cyl * 0.85, 0.6, noseZ);
      cylMesh.castShadow = false;
      pitEntryGroup.add(cylMesh);
    }

    const beaconBaseGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.35, 12);
    const beaconBase = new THREE.Mesh(beaconBaseGeo, materials.metalDarkMat);
    beaconBase.position.set(noseX - 0.8, 1.5, noseZ);
    pitEntryGroup.add(beaconBase);

    const beaconLightGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.25, 12);
    const beaconLightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf59e0b,
      emissiveIntensity: 6.0,
      roughness: 0.1,
    });
    const beaconLight = new THREE.Mesh(beaconLightGeo, beaconLightMat);
    beaconLight.position.set(noseX - 0.8, 1.75, noseZ);
    pitEntryGroup.add(beaconLight);

    const gantryX = -54.0;
    const gantryH = 5.8;
    const pitWallZ = -121.5;
    const paddockWallZ = -106.0;
    const gantryCenterZ = (pitWallZ + paddockWallZ) / 2;

    const fiaGantry = PitEntryGantryBuilder.buildPitEntryGantry({
      gantryX,
      gantryH,
      pitWallZ,
      paddockWallZ,
      facingAngle: -Math.PI / 2,
    });
    pitEntryGroup.add(fiaGantry);

    const limiterLineGeo = new THREE.PlaneGeometry(1.6, 15.5);
    limiterLineGeo.rotateX(-Math.PI / 2);
    const limiterCanvas = document.createElement('canvas');
    limiterCanvas.width = 256;
    limiterCanvas.height = 1024;
    const lCtx = limiterCanvas.getContext('2d')!;

    lCtx.clearRect(0, 0, 256, 1024);
    lCtx.fillStyle = 'rgba(16, 18, 24, 0.75)';
    lCtx.fillRect(6, 0, 244, 1024);

    const bandHeight = 64;
    for (let y = 0; y < 1024; y += bandHeight) {
      const isRed = (y / bandHeight) % 2 === 0;
      lCtx.fillStyle = isRed ? 'rgba(118, 28, 34, 0.82)' : 'rgba(182, 188, 196, 0.80)';
      lCtx.fillRect(16, y, 224, bandHeight);

      lCtx.fillStyle = 'rgba(22, 25, 32, 0.18)';
      for (let dot = 0; dot < 45; dot++) {
        const dx = 18 + Math.random() * 220;
        const dy = y + Math.random() * bandHeight;
        lCtx.fillRect(dx, dy, 2 + Math.random() * 3, 2);
      }
    }

    for (const rx of [48, 112, 176]) {
      const rGrad = lCtx.createLinearGradient(rx - 28, 0, rx + 28, 0);
      rGrad.addColorStop(0, 'rgba(14, 16, 20, 0.0)');
      rGrad.addColorStop(0.5, 'rgba(14, 16, 20, 0.50)');
      rGrad.addColorStop(1, 'rgba(14, 16, 20, 0.0)');
      lCtx.fillStyle = rGrad;
      lCtx.fillRect(rx - 28, 0, 56, 1024);
    }

    const limiterTex = new THREE.CanvasTexture(limiterCanvas);
    limiterTex.anisotropy = 8;
    const limiterMat = new THREE.MeshStandardMaterial({
      map: limiterTex,
      transparent: true,
      roughness: 0.88,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
      depthWrite: false,
    });
    const limiterLine = new THREE.Mesh(limiterLineGeo, limiterMat);
    limiterLine.position.set(gantryX, 0.014, gantryCenterZ);
    limiterLine.renderOrder = 2;
    pitEntryGroup.add(limiterLine);

    const skidGeo = new THREE.PlaneGeometry(36, 6.0);
    skidGeo.rotateX(-Math.PI / 2);
    skidGeo.rotateY(0.42);
    const skidCanvas = document.createElement('canvas');
    skidCanvas.width = 512;
    skidCanvas.height = 128;
    const skCtx = skidCanvas.getContext('2d')!;
    skCtx.fillStyle = 'rgba(0,0,0,0)';
    skCtx.fillRect(0, 0, 512, 128);

    const drawTireRubber = (offsetY: number) => {
      const grad = skCtx.createLinearGradient(0, 0, 512, 0);
      grad.addColorStop(0.0, 'rgba(10, 10, 12, 0.0)');
      grad.addColorStop(0.3, 'rgba(10, 10, 12, 0.65)');
      grad.addColorStop(0.8, 'rgba(10, 10, 12, 0.85)');
      grad.addColorStop(1.0, 'rgba(10, 10, 12, 0.35)');
      skCtx.fillStyle = grad;
      skCtx.fillRect(0, offsetY, 512, 14);
    };
    drawTireRubber(32);
    drawTireRubber(82);
    const skidTex = new THREE.CanvasTexture(skidCanvas);
    const skidMat = new THREE.MeshBasicMaterial({
      map: skidTex,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0,
    });
    const skidMesh = new THREE.Mesh(skidGeo, skidMat);
    skidMesh.position.set(-66, 0.011, -121.8);
    skidMesh.renderOrder = 1;
    pitEntryGroup.add(skidMesh);

    const postGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.75, 8);
    postGeo.translate(0, 0.375, 0);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.65,
      metalness: 0.05,
    });
    const postInst = new THREE.InstancedMesh(postGeo, postMat, 6);

    const ringGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.10, 8);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xdde2ea, roughness: 0.35 });
    const ringInst = new THREE.InstancedMesh(ringGeo, ringMat, 12);

    const dummyBollard = new THREE.Object3D();
    for (let b = 0; b < 6; b++) {
      const bt = b / 5;
      const bx = -56 + bt * 7.5;
      const bz = -123.2 + bt * 2.0;

      dummyBollard.position.set(bx, 0, bz);
      dummyBollard.updateMatrix();
      postInst.setMatrixAt(b, dummyBollard.matrix);

      for (let r = 0; r < 2; r++) {
        dummyBollard.position.set(bx, 0.48 + r * 0.16, bz);
        dummyBollard.updateMatrix();
        ringInst.setMatrixAt(b * 2 + r, dummyBollard.matrix);
      }
    }

    postInst.instanceMatrix.needsUpdate = true;
    postInst.castShadow = false;
    postInst.receiveShadow = false;
    postInst.computeBoundingSphere();
    postInst.computeBoundingBox();
    pitEntryGroup.add(postInst);

    ringInst.instanceMatrix.needsUpdate = true;
    ringInst.castShadow = false;
    ringInst.receiveShadow = false;
    ringInst.computeBoundingSphere();
    ringInst.computeBoundingBox();
    pitEntryGroup.add(ringInst);

    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 1024;
    bannerCanvas.height = 128;
    const bCtx = bannerCanvas.getContext('2d')!;
    bCtx.fillStyle = '#0f172a';
    bCtx.fillRect(0, 0, 1024, 128);
    bCtx.fillStyle = '#ef4444';
    bCtx.fillRect(0, 0, 1024, 8);
    bCtx.fillStyle = '#f59e0b';
    bCtx.fillRect(0, 120, 1024, 8);
    bCtx.fillStyle = '#ffffff';
    bCtx.font = 'black 44px sans-serif';
    bCtx.fillText('APEX GT PIT LANE  ·  ROLEX  ·  PIRELLI  ·  BREMBO  ·  SHELL', 28, 78);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.4 });
    const bannerGeo = new THREE.BoxGeometry(32, 1.1, 0.15);
    const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
    bannerMesh.position.set(-32, 1.4, -121.9);
    pitEntryGroup.add(bannerMesh);

    group.add(pitEntryGroup);
  }

  public static buildOverheadGantriesAndBridges(
    group: THREE.Group,
    materials: TrackMaterials,
    halfSize: number
  ): void {
    const structGroup = new THREE.Group();

    const startArch = this.buildAerodynamicCurvedArch(
      18.5,
      8.2,
      'CIRCUIT 1 · GRAND PRIX',
      '#ef4444',
      materials
    );
    startArch.position.set(0, 0, -130.75);
    structGroup.add(startArch);

    const westArch = this.buildAerodynamicCurvedArch(
      21.0,
      8.2,
      'APEX GT · WORLD TOUR',
      '#38bdf8',
      materials
    );
    westArch.rotation.y = Math.PI / 2;
    westArch.position.set(-halfSize, 0, 0);
    structGroup.add(westArch);

    group.add(structGroup);
  }

  public static buildAerodynamicCurvedArch(
    spanZ: number,
    height: number,
    titleText: string,
    accentColorHex: string,
    materials: TrackMaterials
  ): THREE.Group {
    const archGroup = new THREE.Group();
    const halfSpan = spanZ / 2;

    const curvePoints: THREE.Vector3[] = [];
    const segments = 16;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const z = -halfSpan + t * spanZ;
      const normalizedZ = (t - 0.5) * 2;
      const y = Math.max(0.4, height * (1 - Math.pow(normalizedZ, 4) * 0.48));
      curvePoints.push(new THREE.Vector3(0, y, z));
    }

    const archCurve = new THREE.CatmullRomCurve3(curvePoints);
    const mainTubeGeo = new THREE.TubeGeometry(archCurve, 28, 0.40, 14, false);
    const mainTubeMesh = new THREE.Mesh(mainTubeGeo, materials.metalDarkMat);
    mainTubeMesh.castShadow = false;
    mainTubeMesh.receiveShadow = false;
    archGroup.add(mainTubeMesh);

    const upperPoints = curvePoints.map((p, idx) => {
      const normZ = ((idx / segments) - 0.5) * 2;
      return new THREE.Vector3(-0.35, p.y + 0.52 * (1 - Math.pow(normZ, 2)), p.z);
    });
    const upperCurve = new THREE.CatmullRomCurve3(upperPoints);
    const upperTubeGeo = new THREE.TubeGeometry(upperCurve, 24, 0.16, 10, false);
    const upperTubeMesh = new THREE.Mesh(upperTubeGeo, materials.metalSilverMat);
    upperTubeMesh.castShadow = false;
    upperTubeMesh.receiveShadow = false;
    archGroup.add(upperTubeMesh);

    [-halfSpan, halfSpan].forEach((baseZ) => {
      const baseGeo = new THREE.CylinderGeometry(0.48, 0.82, 3.2, 20);
      const baseMesh = new THREE.Mesh(baseGeo, materials.metalDarkMat);
      baseMesh.position.set(0, 1.6, baseZ);
      archGroup.add(baseMesh);

      const ringGeo = new THREE.TorusGeometry(0.84, 0.07, 8, 20);
      ringGeo.rotateX(Math.PI / 2);
      const ringMesh = new THREE.Mesh(ringGeo, materials.metalSilverMat);
      ringMesh.position.set(0, 0.25, baseZ);
      archGroup.add(ringMesh);

      const sphereCapGeo = new THREE.SphereGeometry(0.52, 16, 12);
      const sphereCapMesh = new THREE.Mesh(sphereCapGeo, materials.metalSilverMat);
      sphereCapMesh.position.set(0, 3.2, baseZ);
      archGroup.add(sphereCapMesh);
    });

    const ribbonCanvas = document.createElement('canvas');
    ribbonCanvas.width = 1024;
    ribbonCanvas.height = 128;
    const rCtx = ribbonCanvas.getContext('2d')!;

    rCtx.fillStyle = '#0f172a';
    rCtx.beginPath();
    rCtx.roundRect(12, 12, 1000, 104, 32);
    rCtx.fill();

    rCtx.fillStyle = accentColorHex;
    rCtx.beginPath();
    rCtx.roundRect(24, 20, 976, 8, 4);
    rCtx.fill();

    rCtx.fillStyle = '#ffffff';
    rCtx.font = 'bold 36px sans-serif';
    rCtx.textAlign = 'center';
    rCtx.fillText(titleText, 512, 68);

    rCtx.fillStyle = '#f59e0b';
    rCtx.font = 'bold 20px monospace';
    rCtx.fillText('FIA OFFICIAL TIMING & TELEMETRY', 512, 98);

    const ribbonTex = new THREE.CanvasTexture(ribbonCanvas);
    const ribbonMat = new THREE.MeshBasicMaterial({ map: ribbonTex, transparent: true });

    const ribbonGeo = new THREE.CylinderGeometry(
      28.0, 28.0, 1.35, 24, 1, true,
      Math.PI * 0.42, Math.PI * 0.16
    );
    ribbonGeo.rotateZ(Math.PI / 2);
    ribbonGeo.rotateY(Math.PI / 2);
    const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbonMesh.position.set(-0.48, height - 0.2, 0);
    archGroup.add(ribbonMesh);

    const shadowMesh = TrackTextureFactory.createCurvedArchSoftShadow(3.8, spanZ + 4.0, 0.45);
    shadowMesh.position.set(-1.2, 0.016, 0);
    archGroup.add(shadowMesh);

    return archGroup;
  }

  public static buildHighMastFloodlights(group: THREE.Group, materials: TrackMaterials): void {
    const floodlightConfigs = [
      { x: -75, z: -178, tx: -75, tz: -130 },
      { x: -40, z: -178, tx: -40, tz: -130 },
      { x: 0, z: -178, tx: 0, tz: -130 },
      { x: 40, z: -178, tx: 40, tz: -130 },
      { x: 75, z: -178, tx: 75, tz: -130 },

      { x: 125, z: -156, tx: 110, tz: -125 },
      { x: 156, z: -125, tx: 125, tz: -110 },
      { x: 156, z: -80, tx: 130, tz: -80 },

      { x: 156, z: -40, tx: 130, tz: -40 },
      { x: 156, z: 0, tx: 130, tz: 0 },
      { x: 156, z: 40, tx: 130, tz: 40 },

      { x: 156, z: 80, tx: 130, tz: 80 },
      { x: 156, z: 125, tx: 125, tz: 110 },
      { x: 125, z: 156, tx: 110, tz: 125 },

      { x: 75, z: 156, tx: 75, tz: 130 },
      { x: 42, z: 172, tx: 42, tz: 130 },
      { x: 0, z: 172, tx: 0, tz: 130 },
      { x: -42, z: 172, tx: -42, tz: 130 },
      { x: -75, z: 156, tx: -75, tz: 130 },

      { x: -125, z: 156, tx: -110, tz: 125 },
      { x: -156, z: 125, tx: -125, tz: 110 },
      { x: -156, z: 80, tx: -130, tz: 80 },

      { x: -156, z: 40, tx: -130, tz: 40 },
      { x: -156, z: 0, tx: -130, tz: 0 },
      { x: -156, z: -40, tx: -130, tz: -40 },

      { x: -156, z: -80, tx: -130, tz: -80 },
      { x: -156, z: -125, tx: -125, tz: -110 },
      { x: -125, z: -156, tx: -110, tz: -125 },
    ];

    const mastGeos: THREE.BufferGeometry[] = [];
    const lensGeos: THREE.BufferGeometry[] = [];

    const mastH = 24;
    const baseMastGeo = new THREE.CylinderGeometry(0.55, 1.1, mastH, 8);
    baseMastGeo.translate(0, mastH / 2, 0);

    const baseArmGeo = new THREE.BoxGeometry(0.8, 0.8, 2.2);
    baseArmGeo.translate(0, 0, 1.1);

    const baseHeadGeo = new THREE.BoxGeometry(5.4, 1.4, 0.8);
    baseHeadGeo.translate(0, 0, 2.2);

    const baseSpotHousingGeo = new THREE.BoxGeometry(0.75, 0.75, 0.4);
    const baseLensGeo = new THREE.PlaneGeometry(0.65, 0.65);

    const mastMat = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.40, roughness: 0.65 });

    floodlightConfigs.forEach((cfg) => {
      const yawAngle = Math.atan2(cfg.tx - cfg.x, cfg.tz - cfg.z);
      const towerMatrix = new THREE.Matrix4();
      towerMatrix.makeRotationY(yawAngle);
      towerMatrix.setPosition(cfg.x, 0, cfg.z);

      const mGeo = baseMastGeo.clone();
      mGeo.applyMatrix4(towerMatrix);
      mastGeos.push(mGeo);

      const headPitchMatrix = new THREE.Matrix4().makeRotationX(0.62);
      const headPosMatrix = new THREE.Matrix4().makeTranslation(0, mastH, 0);
      const headLocalMatrix = new THREE.Matrix4().multiplyMatrices(headPosMatrix, headPitchMatrix);
      const headWorldMatrix = new THREE.Matrix4().multiplyMatrices(towerMatrix, headLocalMatrix);

      const armGeo = baseArmGeo.clone();
      armGeo.applyMatrix4(headWorldMatrix);
      mastGeos.push(armGeo);

      const headGeo = baseHeadGeo.clone();
      headGeo.applyMatrix4(headWorldMatrix);
      mastGeos.push(headGeo);

      for (let s = 0; s < 6; s++) {
        const spotX = -2.1 + s * 0.84;

        const spotMat = new THREE.Matrix4().makeTranslation(spotX, 0, 2.45);
        const spotWorldMat = new THREE.Matrix4().multiplyMatrices(headWorldMatrix, spotMat);
        const spotGeo = baseSpotHousingGeo.clone();
        spotGeo.applyMatrix4(spotWorldMat);
        mastGeos.push(spotGeo);

        const lensMat = new THREE.Matrix4().makeTranslation(spotX, 0, 2.66);
        const lensWorldMat = new THREE.Matrix4().multiplyMatrices(headWorldMatrix, lensMat);
        const lensGeo = baseLensGeo.clone();
        lensGeo.applyMatrix4(lensWorldMat);
        lensGeos.push(lensGeo);
      }
    });

    if (mastGeos.length > 0) {
      const mergedMast = safeMergeBufferGeometries(mastGeos);
      if (mergedMast) {
        const mastMesh = new THREE.Mesh(mergedMast, mastMat);
        mastMesh.castShadow = false;
        group.add(mastMesh);
      }
    }

    if (lensGeos.length > 0) {
      const mergedLenses = safeMergeBufferGeometries(lensGeos);
      if (mergedLenses) {
        const lensMesh = new THREE.Mesh(mergedLenses, materials.floodlightMat);
        lensMesh.castShadow = false;
        group.add(lensMesh);
      }
    }
  }

  public static buildSpeedTrapRadarAndSectorGantries(
    group: THREE.Group,
    materials: TrackMaterials,
    halfSize: number
  ): void {
    const radarGroup = new THREE.Group();
    const northArch = this.buildAerodynamicCurvedArch(
      21.0,
      7.8,
      'SPEED TRAP · 328 KM/H',
      '#10b981',
      materials
    );
    northArch.position.set(0, 0, halfSize);
    radarGroup.add(northArch);
    group.add(radarGroup);
  }

  public static buildPitEquipment(group: THREE.Group): void {
    const pitEquipGroup = new THREE.Group();
    const armGeos: THREE.BufferGeometry[] = [];
    const hoseGeos: THREE.BufferGeometry[] = [];

    const baseArmGeo = new THREE.BoxGeometry(0.15, 0.15, 4.5);
    baseArmGeo.translate(0, 0, -2.25);

    const baseHoseGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6);
    baseHoseGeo.translate(0, -1.1, -4.2);

    for (let b = 0; b < 6; b++) {
      const boomX = -38 + b * 15;
      const matrix = new THREE.Matrix4().setPosition(boomX, 4.2, -110.5);

      const aGeo = baseArmGeo.clone();
      aGeo.applyMatrix4(matrix);
      armGeos.push(aGeo);

      const hGeo = baseHoseGeo.clone();
      hGeo.applyMatrix4(matrix);
      hoseGeos.push(hGeo);
    }

    if (armGeos.length > 0) {
      const armMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.8, roughness: 0.3 });
      const mergedArm = safeMergeBufferGeometries(armGeos);
      if (mergedArm) pitEquipGroup.add(new THREE.Mesh(mergedArm, armMat));
    }
    if (hoseGeos.length > 0) {
      const hoseMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });
      const mergedHose = safeMergeBufferGeometries(hoseGeos);
      if (mergedHose) pitEquipGroup.add(new THREE.Mesh(mergedHose, hoseMat));
    }

    group.add(pitEquipGroup);
  }
}
