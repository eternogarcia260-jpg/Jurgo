/**
 * TrackRoadGeometry.ts - FIA Grade-1 Circuit Road, Kerbs & Traffic Marking Geometry
 * Generates continuous smooth swept asphalt ribbons, 3D beveled kerbs, pit aprons,
 * deceleration entry curves, and high-contrast checkered finish line marking.
 */

import * as THREE from 'three';
import { safeMergeAndDispose } from '../../utils/GeometryUtils';
import { TrackMaterials } from './TrackMaterials';

export class TrackRoadGeometry {
  /**
   * Helper to build a seamless curved road quad geometry in the XZ plane
   */
  public static createCornerRoadGeometry(
    cx: number,
    cz: number,
    innerR: number,
    outerR: number,
    startAngle: number,
    endAngle: number,
    segments: number = 32,
    yPos: number = 0.005
  ): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = startAngle + t * (endAngle - startAngle);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      positions.push(cx + cosA * innerR, yPos, cz + sinA * innerR);
      uvs.push(0, t * 6);

      positions.push(cx + cosA * outerR, yPos, cz + sinA * outerR);
      uvs.push(1, t * 6);
    }

    for (let i = 0; i < segments; i++) {
      const p1 = i * 2;
      const p2 = p1 + 1;
      const p3 = (i + 1) * 2;
      const p4 = p3 + 1;

      indices.push(p1, p3, p2);
      indices.push(p2, p3, p4);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Helper to build a seamless curved road quad mesh in the XZ plane
   */
  public static createCornerRoadMesh(
    cx: number,
    cz: number,
    innerR: number,
    outerR: number,
    startAngle: number,
    endAngle: number,
    segments: number = 32,
    mat: THREE.Material = new THREE.MeshBasicMaterial(),
    yPos: number = 0.005
  ): THREE.Mesh {
    const geo = this.createCornerRoadGeometry(cx, cz, innerR, outerR, startAngle, endAngle, segments, yPos);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * Gravel Traps and Compacted Soil Shoulder Strips
   */
  public static buildGravelAndShoulders(
    terrainGroup: THREE.Group,
    materials: TrackMaterials,
    halfSize: number,
    trackWidth: number,
    innerCornerCenter: number,
    cornerRadius: number
  ): void {
    const cornerArcs = [
      { cx: innerCornerCenter, cz: -innerCornerCenter, startA: -Math.PI / 2, endA: 0 },
      { cx: innerCornerCenter, cz: innerCornerCenter, startA: 0, endA: Math.PI / 2 },
      { cx: -innerCornerCenter, cz: innerCornerCenter, startA: Math.PI / 2, endA: Math.PI },
      { cx: -innerCornerCenter, cz: -innerCornerCenter, startA: Math.PI, endA: Math.PI * 1.5 },
    ];

    const outerR = cornerRadius + trackWidth / 2;
    const gravelGeos: THREE.BufferGeometry[] = [];
    cornerArcs.forEach((ca) => {
      gravelGeos.push(
        this.createCornerRoadGeometry(
          ca.cx,
          ca.cz,
          outerR + 1.2,
          outerR + 16,
          ca.startA,
          ca.endA,
          24,
          0.008
        )
      );
    });
    if (gravelGeos.length > 0) {
      const mergedGravel = safeMergeAndDispose(gravelGeos, false);
      if (mergedGravel) {
        const gravelMesh = new THREE.Mesh(mergedGravel, materials.gravelMat);
        gravelMesh.receiveShadow = true;
        terrainGroup.add(gravelMesh);
      }
    }

    // Shoulder transition strips along kerbs and track limits
    const c = innerCornerCenter;
    const half = halfSize;
    const w = trackWidth;
    const shoulderWidth = 2.2;
    const dirtGeos: THREE.BufferGeometry[] = [];

    // Straight Outer Dirt Shoulders
    const straightShoulderGeoX = new THREE.PlaneGeometry(c * 2 + 16, shoulderWidth);
    straightShoulderGeoX.rotateX(-Math.PI / 2);

    const sSouthGeo = straightShoulderGeoX.clone();
    sSouthGeo.translate(0, 0.007, -half - w / 2 - shoulderWidth / 2 - 0.1);
    dirtGeos.push(sSouthGeo);

    const sNorthGeo = straightShoulderGeoX.clone();
    sNorthGeo.translate(0, 0.007, half + w / 2 + shoulderWidth / 2 + 0.1);
    dirtGeos.push(sNorthGeo);

    const straightShoulderGeoZ = new THREE.PlaneGeometry(shoulderWidth, c * 2 + 16);
    straightShoulderGeoZ.rotateX(-Math.PI / 2);

    const sEastGeo = straightShoulderGeoZ.clone();
    sEastGeo.translate(half + w / 2 + shoulderWidth / 2 + 0.1, 0.007, 0);
    dirtGeos.push(sEastGeo);

    const sWestGeo = straightShoulderGeoZ.clone();
    sWestGeo.translate(-half - w / 2 - shoulderWidth / 2 - 0.1, 0.007, 0);
    dirtGeos.push(sWestGeo);

    // Straight Inner Dirt Shoulders (North, East, West)
    const sNorthInGeo = straightShoulderGeoX.clone();
    sNorthInGeo.translate(0, 0.007, half - w / 2 - shoulderWidth / 2 - 0.1);
    dirtGeos.push(sNorthInGeo);

    const sEastInGeo = straightShoulderGeoZ.clone();
    sEastInGeo.translate(half - w / 2 - shoulderWidth / 2 - 0.1, 0.007, 0);
    dirtGeos.push(sEastInGeo);

    const sWestInGeo = straightShoulderGeoZ.clone();
    sWestInGeo.translate(-half + w / 2 + shoulderWidth / 2 + 0.1, 0.007, 0);
    dirtGeos.push(sWestInGeo);

    // 4 Corner Apex Inner Dirt Arcs
    const innerR = cornerRadius - w / 2;
    cornerArcs.forEach((ca) => {
      dirtGeos.push(
        this.createCornerRoadGeometry(
          ca.cx,
          ca.cz,
          innerR - shoulderWidth,
          innerR,
          ca.startA,
          ca.endA,
          24,
          0.007
        )
      );
    });

    if (dirtGeos.length > 0) {
      const mergedDirt = safeMergeAndDispose(dirtGeos, false);
      if (mergedDirt) {
        const dirtMesh = new THREE.Mesh(mergedDirt, materials.dirtShoulderMat);
        dirtMesh.receiveShadow = true;
        terrainGroup.add(dirtMesh);
      }
    }
  }

  /**
   * Continuous Asphalt Racing Surface with Pit Lane Integration
   */
  public static buildSquareCircuitTrack(
    trackGroup: THREE.Group,
    materials: TrackMaterials,
    halfSize: number,
    trackWidth: number,
    innerCornerCenter: number,
    cornerRadius: number
  ): void {
    const half = halfSize;
    const w = trackWidth;
    const c = innerCornerCenter;
    const straightLen = c * 2;
    const asphaltGeos: THREE.BufferGeometry[] = [];

    // 4 Straight Sections
    const hGeo = new THREE.PlaneGeometry(straightLen, w, 32, 2);
    hGeo.rotateX(-Math.PI / 2);

    const vGeo = new THREE.PlaneGeometry(w, straightLen, 2, 32);
    vGeo.rotateX(-Math.PI / 2);

    // South Straight (Main straight)
    const southGeo = hGeo.clone();
    southGeo.translate(0, 0.005, -half);
    asphaltGeos.push(southGeo);

    // North Straight
    const northGeo = hGeo.clone();
    northGeo.translate(0, 0.005, half);
    asphaltGeos.push(northGeo);

    // East Straight
    const eastGeo = vGeo.clone();
    eastGeo.translate(half, 0.005, 0);
    asphaltGeos.push(eastGeo);

    // West Straight
    const westGeo = vGeo.clone();
    westGeo.translate(-half, 0.005, 0);
    asphaltGeos.push(westGeo);

    // 4 Rounded Corner Sections
    const innerR = cornerRadius - w / 2;
    const outerR = cornerRadius + w / 2;

    // Corner 1: South-East (Turn 1)
    asphaltGeos.push(this.createCornerRoadGeometry(c, -c, innerR, outerR, -Math.PI / 2, 0));
    // Corner 2: North-East (Turn 2)
    asphaltGeos.push(this.createCornerRoadGeometry(c, c, innerR, outerR, 0, Math.PI / 2));
    // Corner 3: North-West (Turn 3)
    asphaltGeos.push(this.createCornerRoadGeometry(-c, c, innerR, outerR, Math.PI / 2, Math.PI));
    // Corner 4: South-West (Turn 4)
    asphaltGeos.push(this.createCornerRoadGeometry(-c, -c, innerR, outerR, Math.PI, Math.PI * 1.5));

    // Pit Lane Seamless Asphalt Apron
    const pitApronGeo = new THREE.PlaneGeometry(184, 16.5, 32, 2);
    pitApronGeo.rotateX(-Math.PI / 2);
    pitApronGeo.translate(0, 0.005, -113.75);
    asphaltGeos.push(pitApronGeo);

    const mergedAsphalt = safeMergeAndDispose(asphaltGeos, false);
    if (mergedAsphalt) {
      const asphaltMesh = new THREE.Mesh(mergedAsphalt, materials.asphaltMat);
      asphaltMesh.receiveShadow = true;
      trackGroup.add(asphaltMesh);
    }

    // Paint FIA White Road Markings & Boundary Lines
    this.buildTrackAndPitRoadLines(trackGroup, materials, halfSize, trackWidth, innerCornerCenter, cornerRadius);
  }

  /**
   * Crisp FIA Official Road Lines & High-Speed Optical Flow Markings
   */
  public static buildTrackAndPitRoadLines(
    trackGroup: THREE.Group,
    materials: TrackMaterials,
    halfSize: number,
    trackWidth: number,
    innerCornerCenter: number,
    cornerRadius: number
  ): void {
    const linesGroup = new THREE.Group();

    const lineNormal = materials.asphaltMat.normalMap ? materials.asphaltMat.normalMap.clone() : undefined;
    if (lineNormal) {
      lineNormal.repeat.set(16, 16);
      lineNormal.needsUpdate = true;
    }
    const whiteLineMat = new THREE.MeshStandardMaterial({
      color: 0xd8dbe2,
      normalMap: lineNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.58,
      metalness: 0.04,
      envMapIntensity: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
    });

    const half = halfSize;
    const w = trackWidth;
    const c = innerCornerCenter;
    const straightLen = c * 2; // 184m

    const whiteGeos: THREE.BufferGeometry[] = [];

    // --- A. CONTINUOUS FIA TRACK LIMIT BOUNDARY LINES ---
    const hLineGeo = new THREE.PlaneGeometry(straightLen, 0.25);
    hLineGeo.rotateX(-Math.PI / 2);
    const vLineGeo = new THREE.PlaneGeometry(0.25, straightLen);
    vLineGeo.rotateX(-Math.PI / 2);

    // South Straight Outer Line
    const southOuterGeo = hLineGeo.clone();
    southOuterGeo.translate(0, 0.009, -half - w / 2 + 0.25);
    whiteGeos.push(southOuterGeo);

    // North Straight Inner & Outer Lines
    const northOuterGeo = hLineGeo.clone();
    northOuterGeo.translate(0, 0.009, half + w / 2 - 0.25);
    whiteGeos.push(northOuterGeo);

    const northInnerGeo = hLineGeo.clone();
    northInnerGeo.translate(0, 0.009, half - w / 2 + 0.25);
    whiteGeos.push(northInnerGeo);

    // East Straight Inner & Outer Lines
    const eastOuterGeo = vLineGeo.clone();
    eastOuterGeo.translate(half + w / 2 - 0.25, 0.009, 0);
    whiteGeos.push(eastOuterGeo);

    const eastInnerGeo = vLineGeo.clone();
    eastInnerGeo.translate(half - w / 2 + 0.25, 0.009, 0);
    whiteGeos.push(eastInnerGeo);

    // West Straight Inner & Outer Lines
    const westOuterGeo = vLineGeo.clone();
    westOuterGeo.translate(-half - w / 2 + 0.25, 0.009, 0);
    whiteGeos.push(westOuterGeo);

    const westInnerGeo = vLineGeo.clone();
    westInnerGeo.translate(-half + w / 2 - 0.25, 0.009, 0);
    whiteGeos.push(westInnerGeo);

    // --- B. CONTINUOUS RACING DASHED CENTERLINES ---
    const baseDashHGeo = new THREE.PlaneGeometry(3.2, 0.25);
    baseDashHGeo.rotateX(-Math.PI / 2);
    const baseDashVGeo = new THREE.PlaneGeometry(0.25, 3.2);
    baseDashVGeo.rotateX(-Math.PI / 2);

    // South Straight
    for (let x = -c + 4; x <= c - 4; x += 8) {
      if (Math.abs(x - (-10.0)) < 4.0 || Math.abs(x) < 2.0) continue;
      const g = baseDashHGeo.clone();
      g.translate(x, 0.010, -half);
      whiteGeos.push(g);
    }

    // East Straight
    for (let z = -c + 4; z <= c - 4; z += 8) {
      const g = baseDashVGeo.clone();
      g.translate(half, 0.010, z);
      whiteGeos.push(g);
    }

    // North Straight
    for (let x = -c + 4; x <= c - 4; x += 8) {
      const g = baseDashHGeo.clone();
      g.translate(x, 0.010, half);
      whiteGeos.push(g);
    }

    // West Straight
    for (let z = -c + 4; z <= c - 4; z += 8) {
      const g = baseDashVGeo.clone();
      g.translate(-half, 0.010, z);
      whiteGeos.push(g);
    }

    // 4 Rounded Corners
    const cornerConfigs = [
      { cx: c, cz: -c, startA: -Math.PI / 2 },
      { cx: c, cz: c, startA: 0 },
      { cx: -c, cz: c, startA: Math.PI / 2 },
      { cx: -c, cz: -c, startA: Math.PI },
    ];

    cornerConfigs.forEach((cfg) => {
      for (let k = 0; k < 7; k++) {
        const t = (k + 0.5) / 7;
        const angle = cfg.startA + t * (Math.PI / 2);
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const g = baseDashHGeo.clone();
        g.rotateY(-angle - Math.PI / 2);
        g.translate(cfg.cx + cosA * cornerRadius, 0.010, cfg.cz + sinA * cornerRadius);
        whiteGeos.push(g);
      }
    });

    cornerConfigs.forEach((cfg) => {
      const innerR = cornerRadius - w / 2;
      const outerR = cornerRadius + w / 2;
      whiteGeos.push(this.createCornerRoadGeometry(
        cfg.cx,
        cfg.cz,
        innerR + 0.05,
        innerR + 0.30,
        cfg.startA,
        cfg.startA + Math.PI / 2,
        24,
        0.009
      ));

      whiteGeos.push(this.createCornerRoadGeometry(
        cfg.cx,
        cfg.cz,
        outerR - 0.30,
        outerR - 0.05,
        cfg.startA,
        cfg.startA + Math.PI / 2,
        24,
        0.009
      ));
    });

    // --- C. PIT LANE & PIT ENTRY MARKINGS ---
    const lineWestGeo = new THREE.PlaneGeometry(24, 0.3);
    lineWestGeo.rotateX(-Math.PI / 2);
    lineWestGeo.translate(-80, 0.010, -122);
    whiteGeos.push(lineWestGeo);

    const lineEastGeo = new THREE.PlaneGeometry(88, 0.3);
    lineEastGeo.rotateX(-Math.PI / 2);
    lineEastGeo.translate(4, 0.010, -122);
    whiteGeos.push(lineEastGeo);

    // Photorealistic Pit Entry Deceleration Line System
    const pitLineCanvas = document.createElement('canvas');
    pitLineCanvas.width = 256;
    pitLineCanvas.height = 1024;
    const pCtx = pitLineCanvas.getContext('2d')!;

    pCtx.clearRect(0, 0, 256, 1024);
    pCtx.fillStyle = 'rgba(16, 18, 22, 0.70)';
    pCtx.fillRect(10, 0, 236, 1024);
    pCtx.fillStyle = 'rgba(182, 188, 198, 0.90)';
    pCtx.fillRect(26, 0, 204, 1024);

    pCtx.fillStyle = 'rgba(22, 25, 32, 0.22)';
    for (let dot = 0; dot < 450; dot++) {
      const dx = 28 + Math.random() * 200;
      const dy = Math.random() * 1024;
      pCtx.fillRect(dx, dy, 2 + Math.random() * 3, 2);
    }

    for (const rx of [64, 128, 192]) {
      const grad = pCtx.createLinearGradient(rx - 24, 0, rx + 24, 0);
      grad.addColorStop(0.0, 'rgba(12, 14, 18, 0.0)');
      grad.addColorStop(0.5, 'rgba(12, 14, 18, 0.42)');
      grad.addColorStop(1.0, 'rgba(12, 14, 18, 0.0)');
      pCtx.fillStyle = grad;
      pCtx.fillRect(rx - 24, 0, 48, 1024);
    }

    const pitLineTex = new THREE.CanvasTexture(pitLineCanvas);
    pitLineTex.wrapS = THREE.RepeatWrapping;
    pitLineTex.wrapT = THREE.RepeatWrapping;
    pitLineTex.repeat.set(1, 6);
    pitLineTex.anisotropy = 8;

    const pitLineMat = new THREE.MeshStandardMaterial({
      map: pitLineTex,
      transparent: true,
      roughness: 0.88,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
      depthWrite: false,
    });

    const curveSegments = 48;
    const ribbonVerts: number[] = [];
    const ribbonUVs: number[] = [];
    const ribbonIndices: number[] = [];
    const ribbonWidth = 0.36;

    for (let i = 0; i <= curveSegments; i++) {
      const t = i / curveSegments;
      const lx = -74 + t * 26;
      const lz = -122 + (1 - Math.cos(t * Math.PI)) * 0.5 * 5.8;

      const dlx = 26;
      const dlz = Math.sin(t * Math.PI) * Math.PI * 0.5 * 5.8;
      const len = Math.hypot(dlx, dlz);
      const nx = -dlz / len;
      const nz = dlx / len;

      const pLeftX = lx + (nx * ribbonWidth) / 2;
      const pLeftZ = lz + (nz * ribbonWidth) / 2;
      const pRightX = lx - (nx * ribbonWidth) / 2;
      const pRightZ = lz - (nz * ribbonWidth) / 2;

      ribbonVerts.push(pLeftX, 0.013, pLeftZ);
      ribbonVerts.push(pRightX, 0.013, pRightZ);

      ribbonUVs.push(0, t);
      ribbonUVs.push(1, t);

      if (i < curveSegments) {
        const base = i * 2;
        ribbonIndices.push(base, base + 1, base + 2);
        ribbonIndices.push(base + 1, base + 3, base + 2);
      }
    }

    const pitCurveGeo = new THREE.BufferGeometry();
    pitCurveGeo.setAttribute('position', new THREE.Float32BufferAttribute(ribbonVerts, 3));
    pitCurveGeo.setAttribute('uv', new THREE.Float32BufferAttribute(ribbonUVs, 2));
    pitCurveGeo.setIndex(ribbonIndices);
    pitCurveGeo.computeVertexNormals();

    const pitCurveMesh = new THREE.Mesh(pitCurveGeo, pitLineMat);
    pitCurveMesh.receiveShadow = true;
    pitCurveMesh.renderOrder = 2;
    linesGroup.add(pitCurveMesh);

    // Pit Entry Dashed Commitment Line along Main Straight
    for (let d = 0; d < 8; d++) {
      const dashGeo = new THREE.PlaneGeometry(1.6, 0.34);
      dashGeo.rotateX(-Math.PI / 2);
      const dashMesh = new THREE.Mesh(dashGeo, pitLineMat);
      dashMesh.position.set(-71 + d * 3.0, 0.012, -122);
      dashMesh.receiveShadow = true;
      dashMesh.renderOrder = 2;
      linesGroup.add(dashMesh);
    }

    // Pit Lane Fast Lane Solid White Boundary Lines
    const pitInnerLineGeo = new THREE.PlaneGeometry(96, 0.25);
    pitInnerLineGeo.rotateX(-Math.PI / 2);
    pitInnerLineGeo.translate(0, 0.010, -113.2);
    whiteGeos.push(pitInnerLineGeo);

    const pitOuterLineGeo = new THREE.PlaneGeometry(96, 0.25);
    pitOuterLineGeo.rotateX(-Math.PI / 2);
    pitOuterLineGeo.translate(0, 0.010, -120.4);
    whiteGeos.push(pitOuterLineGeo);

    // Pit Lane Center Dashed Guidance Line
    for (let pd = 0; pd < 24; pd++) {
      const pDashGeo = new THREE.PlaneGeometry(2.0, 0.2);
      pDashGeo.rotateX(-Math.PI / 2);
      pDashGeo.translate(-44 + pd * 4.0, 0.010, -116.8);
      whiteGeos.push(pDashGeo);
    }

    // FIA Grade-1 Pit Exit Blend Line
    const exitCurveSegments = 32;
    for (let i = 0; i < exitCurveSegments; i++) {
      const t0 = i / exitCurveSegments;
      const t1 = (i + 1) / exitCurveSegments;
      const x0 = 44.0 + t0 * 20.0;
      const x1 = 44.0 + t1 * 20.0;
      const z0 = -120.4 + (1 - Math.cos(t0 * Math.PI)) * 0.5 * (-4.6);
      const z1 = -120.4 + (1 - Math.cos(t1 * Math.PI)) * 0.5 * (-4.6);
      const dx = x1 - x0;
      const dz = z1 - z0;
      const segLen = Math.hypot(dx, dz);
      const segAngle = Math.atan2(dz, dx);
      const segGeo = new THREE.PlaneGeometry(segLen, 0.28);
      segGeo.rotateX(-Math.PI / 2);
      segGeo.rotateY(-segAngle);
      segGeo.translate((x0 + x1) / 2, 0.010, (z0 + z1) / 2);
      whiteGeos.push(segGeo);
    }

    if (whiteGeos.length > 0) {
      const mergedWhiteLines = safeMergeAndDispose(whiteGeos, false);
      if (mergedWhiteLines) {
        const whiteMesh = new THREE.Mesh(mergedWhiteLines, whiteLineMat);
        whiteMesh.name = 'trackLineMesh';
        whiteMesh.receiveShadow = true;
        linesGroup.add(whiteMesh);
      }
    }

    trackGroup.add(linesGroup);
  }

  /**
   * Continuous Batched 3D Beveled Kerbs and Starting Grid
   */
  public static buildKerbsAndStartingGrid(
    group: THREE.Group,
    materials: TrackMaterials,
    halfSize: number,
    trackWidth: number,
    innerCornerCenter: number,
    cornerRadius: number
  ): void {
    const kerbGroup = new THREE.Group();
    const c = innerCornerCenter;
    const w = trackWidth;
    const innerR = cornerRadius - w / 2;
    const outerR = cornerRadius + w / 2;
    const kerbWidth = 1.6;

    const corners = [
      { cx: c, cz: -c, startAngle: -Math.PI / 2 },
      { cx: c, cz: c, startAngle: 0 },
      { cx: -c, cz: c, startAngle: Math.PI / 2 },
      { cx: -c, cz: -c, startAngle: Math.PI },
    ];

    const redVertices: number[] = [];
    const redIndices: number[] = [];
    const whiteVertices: number[] = [];
    const whiteIndices: number[] = [];

    const addQuad = (
      p1a: THREE.Vector3,
      p2a: THREE.Vector3,
      p1b: THREE.Vector3,
      p2b: THREE.Vector3,
      isOuter: boolean,
      isRed: boolean
    ) => {
      const targetVerts = isRed ? redVertices : whiteVertices;
      const targetIndices = isRed ? redIndices : whiteIndices;
      const baseIdx = targetVerts.length / 3;

      targetVerts.push(
        p1a.x, p1a.y, p1a.z,
        p2a.x, p2a.y, p2a.z,
        p1b.x, p1b.y, p1b.z,
        p2b.x, p2b.y, p2b.z
      );

      if (!isOuter) {
        targetIndices.push(baseIdx, baseIdx + 2, baseIdx + 1);
        targetIndices.push(baseIdx + 2, baseIdx + 3, baseIdx + 1);
      } else {
        targetIndices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        targetIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
      }
    };

    const numSegs = 32;
    const arcSpan = Math.PI / 2;

    corners.forEach((corner) => {
      // 1. Inner Apex Curb
      for (let i = 0; i < numSegs; i++) {
        const isRed = Math.floor(i / 2) % 2 === 0;
        const a1 = corner.startAngle + (i / numSegs) * arcSpan;
        const a2 = corner.startAngle + ((i + 1) / numSegs) * arcSpan;

        const taper1 = Math.min(1.0, (i + 0.5) / 2.5, (numSegs - 0.5 - i) / 2.5);
        const taper2 = Math.min(1.0, (i + 1.5) / 2.5, (numSegs - 1.5 - i) / 2.5);

        const y0_1 = 0.025;
        const y1_1 = 0.025 + 0.050 * taper1;
        const y2_1 = 0.025 + 0.010 * taper1;

        const y0_2 = 0.025;
        const y1_2 = 0.025 + 0.050 * taper2;
        const y2_2 = 0.025 + 0.010 * taper2;

        const r0 = innerR;
        const r1 = innerR - kerbWidth * 0.55;
        const r2 = innerR - kerbWidth;

        const cos1 = Math.cos(a1);
        const sin1 = Math.sin(a1);
        const cos2 = Math.cos(a2);
        const sin2 = Math.sin(a2);

        const p1_r0 = new THREE.Vector3(corner.cx + cos1 * r0, y0_1, corner.cz + sin1 * r0);
        const p2_r0 = new THREE.Vector3(corner.cx + cos2 * r0, y0_2, corner.cz + sin2 * r0);

        const p1_r1 = new THREE.Vector3(corner.cx + cos1 * r1, y1_1, corner.cz + sin1 * r1);
        const p2_r1 = new THREE.Vector3(corner.cx + cos2 * r1, y1_2, corner.cz + sin2 * r1);

        const p1_r2 = new THREE.Vector3(corner.cx + cos1 * r2, y2_1, corner.cz + sin1 * r2);
        const p2_r2 = new THREE.Vector3(corner.cx + cos2 * r2, y2_2, corner.cz + sin2 * r2);

        addQuad(p1_r0, p2_r0, p1_r1, p2_r1, false, isRed);
        addQuad(p1_r1, p2_r1, p1_r2, p2_r2, false, isRed);
      }

      // 2. Outer Curb
      for (let i = 0; i < numSegs; i++) {
        const isRed = Math.floor(i / 2) % 2 === 0;
        const a1 = corner.startAngle + (i / numSegs) * arcSpan;
        const a2 = corner.startAngle + ((i + 1) / numSegs) * arcSpan;

        const taper1 = Math.min(1.0, (i + 0.5) / 2.5, (numSegs - 0.5 - i) / 2.5);
        const taper2 = Math.min(1.0, (i + 1.5) / 2.5, (numSegs - 1.5 - i) / 2.5);

        const y0_1 = 0.025;
        const y1_1 = 0.025 + 0.050 * taper1;
        const y2_1 = 0.025 + 0.010 * taper1;

        const y0_2 = 0.025;
        const y1_2 = 0.025 + 0.050 * taper2;
        const y2_2 = 0.025 + 0.010 * taper2;

        const r0 = outerR;
        const r1 = outerR + kerbWidth * 0.55;
        const r2 = outerR + kerbWidth;

        const cos1 = Math.cos(a1);
        const sin1 = Math.sin(a1);
        const cos2 = Math.cos(a2);
        const sin2 = Math.sin(a2);

        const p1_r0 = new THREE.Vector3(corner.cx + cos1 * r0, y0_1, corner.cz + sin1 * r0);
        const p2_r0 = new THREE.Vector3(corner.cx + cos2 * r0, y0_2, corner.cz + sin2 * r0);

        const p1_r1 = new THREE.Vector3(corner.cx + cos1 * r1, y1_1, corner.cz + sin1 * r1);
        const p2_r1 = new THREE.Vector3(corner.cx + cos2 * r1, y1_2, corner.cz + sin2 * r1);

        const p1_r2 = new THREE.Vector3(corner.cx + cos1 * r2, y2_1, corner.cz + sin1 * r2);
        const p2_r2 = new THREE.Vector3(corner.cx + cos2 * r2, y2_2, corner.cz + sin2 * r2);

        addQuad(p1_r0, p2_r0, p1_r1, p2_r1, true, isRed);
        addQuad(p1_r1, p2_r1, p1_r2, p2_r2, true, isRed);
      }
    });

    if (redVertices.length > 0) {
      const redGeo = new THREE.BufferGeometry();
      redGeo.setAttribute('position', new THREE.Float32BufferAttribute(redVertices, 3));
      redGeo.setIndex(redIndices);
      redGeo.computeVertexNormals();
      const redMesh = new THREE.Mesh(redGeo, materials.kerbRedMat);
      redMesh.receiveShadow = true;
      redMesh.renderOrder = 2;
      kerbGroup.add(redMesh);
    }

    if (whiteVertices.length > 0) {
      const whiteGeo = new THREE.BufferGeometry();
      whiteGeo.setAttribute('position', new THREE.Float32BufferAttribute(whiteVertices, 3));
      whiteGeo.setIndex(whiteIndices);
      whiteGeo.computeVertexNormals();
      const whiteMesh = new THREE.Mesh(whiteGeo, materials.kerbWhiteMat);
      whiteMesh.receiveShadow = true;
      whiteMesh.renderOrder = 2;
      kerbGroup.add(whiteMesh);
    }

    // Checkered Start / Finish Line
    const sfGeo = new THREE.PlaneGeometry(2.2, trackWidth);
    sfGeo.rotateX(-Math.PI / 2);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 1024);
    ctx.fillStyle = '#09090b';
    const checkerSize = 64;
    for (let x = 0; x < 128; x += checkerSize) {
      for (let y = 0; y < 1024; y += checkerSize) {
        if ((x / checkerSize + y / checkerSize) % 2 === 0) {
          ctx.fillRect(x, y, checkerSize, checkerSize);
        }
      }
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(116, 0, 12, 1024);

    const sfTex = new THREE.CanvasTexture(canvas);
    sfTex.wrapS = THREE.ClampToEdgeWrapping;
    sfTex.wrapT = THREE.ClampToEdgeWrapping;
    sfTex.anisotropy = 8;
    const sfMat = new THREE.MeshStandardMaterial({
      map: sfTex,
      roughness: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
    });
    const sfMesh = new THREE.Mesh(sfGeo, sfMat);
    sfMesh.position.set(-10.0, 0.014, -halfSize);
    sfMesh.renderOrder = 3;
    kerbGroup.add(sfMesh);

    group.add(kerbGroup);
  }
}
