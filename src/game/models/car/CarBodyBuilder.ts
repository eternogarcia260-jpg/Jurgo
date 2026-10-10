/**
 * CarBodyBuilder.ts - Aerodynamic Monocoque Chassis, Wings, Cockpit & Driver
 * Generates continuous lofted carbon monocoque fuselage, sidepod undercut tunnels,
 * multi-element front & rear wings, titanium halo arch, double-wishbone suspension,
 * digital F1 butterfly steering wheel, and animated driver helmet.
 */

import * as THREE from 'three';
import { safeMergeAndDispose } from '../../utils/GeometryUtils';
import { CarMaterials } from './CarMaterials';

export class CarBodyBuilder {
  public noseMesh!: THREE.Mesh;
  public pristineNosePositions!: Float32Array;

  // Aerodynamic Wings & Deformable Cascades
  public wingGroup!: THREE.Group;
  public frontWingGroup!: THREE.Group;
  public frontWingLeftGroup!: THREE.Group;
  public frontWingRightGroup!: THREE.Group;
  public frontWingLeftMainGroup!: THREE.Group;
  public frontWingLeftUpperFlapGroup!: THREE.Group;
  public frontWingLeftStubMesh!: THREE.Mesh;
  public frontWingRightMainGroup!: THREE.Group;
  public frontWingRightUpperFlapGroup!: THREE.Group;
  public frontWingRightStubMesh!: THREE.Mesh;
  public endplateLeftGroup!: THREE.Group;
  public endplateRightGroup!: THREE.Group;
  public rwEndplateLeft!: THREE.Object3D;
  public rwEndplateRight!: THREE.Object3D;
  public rwPylonLeft!: THREE.Object3D;
  public rwPylonRight!: THREE.Object3D;

  // DRS Kinetic Flap & Actuator Pod
  public drsPivotGroup!: THREE.Group;
  public drsLedMesh!: THREE.Mesh;
  public drsPistonMesh!: THREE.Mesh;
  public drsPointLight!: THREE.PointLight;
  public drsRockerArmLeft!: THREE.Mesh;
  public drsRockerArmRight!: THREE.Mesh;

  // Steering Wheel, LEDs & Driver Helmet
  public steeringWheelPivot!: THREE.Group;
  public steeringWheel!: THREE.Group;
  public driverHelmet!: THREE.Group;
  public revLedMeshes: THREE.Mesh[] = [];

  public buildCarBody(
    parentGroup: THREE.Group,
    materials: CarMaterials,
    isAi: boolean
  ): void {
    const carBodyGroup = new THREE.Group();

    // =========================================================================
    // 1. CONTINUOUS LOFTED AERODYNAMIC MONOCOQUE FUSELAGE
    // =========================================================================
    const fuselageGeo = this.createFuselageGeometry();
    this.noseMesh = new THREE.Mesh(fuselageGeo, materials.bodyMaterial);
    this.noseMesh.castShadow = true;
    this.noseMesh.receiveShadow = true;
    this.noseMesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.45, 0.8), 3.2);
    carBodyGroup.add(this.noseMesh);

    this.pristineNosePositions = new Float32Array(fuselageGeo.attributes.position.array);

    // Cockpit Opening Coaming Lip (Carbon Edge)
    const coamingGeo = new THREE.TorusGeometry(0.34, 0.020, 8, 28, Math.PI);
    coamingGeo.rotateX(Math.PI / 2);
    const coamingMesh = new THREE.Mesh(coamingGeo, materials.carbonMaterial);
    coamingMesh.position.set(0, 0.54, 0.16);
    carBodyGroup.add(coamingMesh);

    // Aerodynamic Tinted Windscreen Deflector
    const screenGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.05, 18, 1, true, 0, Math.PI);
    screenGeo.rotateX(Math.PI / 2);
    const screenMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a0f18,
      roughness: 0.05,
      transmission: 0.85,
      thickness: 0.04,
      transparent: true,
      opacity: 0.75,
    });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(0, 0.54, 0.44);
    carBodyGroup.add(screenMesh);

    // S-Duct Vanity Panel & Camera Pods
    const sDuctGeo = new THREE.BoxGeometry(0.18, 0.020, 0.26);
    const sDuctMesh = new THREE.Mesh(sDuctGeo, materials.carbonGlossMaterial);
    sDuctMesh.position.set(0, 0.45, 0.88);
    carBodyGroup.add(sDuctMesh);

    const chassisCamGeos: THREE.BufferGeometry[] = [];
    [-0.20, 0.20].forEach((camX) => {
      const camGeo = new THREE.CylinderGeometry(0.016, 0.020, 0.08, 8);
      camGeo.rotateX(Math.PI / 2);
      camGeo.translate(camX, 0.42, 1.68);
      chassisCamGeos.push(camGeo);
    });
    const mergedChassisCams = safeMergeAndDispose(chassisCamGeos);
    if (mergedChassisCams) {
      const camMesh = new THREE.Mesh(mergedChassisCams, materials.carbonGlossMaterial);
      carBodyGroup.add(camMesh);
    }

    // =========================================================================
    // 2. SCULPTED ORGANIC SIDEPODS WITH OVERBITE INTAKES & WATERSLIDE DECKS
    // =========================================================================
    [false, true].forEach((isRight) => {
      const side = isRight ? 1 : -1;
      const sidepodGeo = this.createSidepodGeometry(isRight);
      const sidepodMesh = new THREE.Mesh(sidepodGeo, materials.bodyMaterial);
      sidepodMesh.castShadow = true;
      sidepodMesh.receiveShadow = true;
      carBodyGroup.add(sidepodMesh);

      // Deep Hollow Radiator Intake Duct
      const intakeRingGeo = new THREE.TorusGeometry(0.13, 0.022, 8, 18);
      const intakeRing = new THREE.Mesh(intakeRingGeo, materials.carbonGlossMaterial);
      intakeRing.position.set(side * 0.46, 0.33, 0.63);
      intakeRing.scale.set(1.2, 0.85, 1.0);
      carBodyGroup.add(intakeRing);

      const intakeDarkGeo = new THREE.CircleGeometry(0.12, 16);
      const intakeDark = new THREE.Mesh(intakeDarkGeo, new THREE.MeshBasicMaterial({ color: 0x05070a }));
      intakeDark.position.set(side * 0.46, 0.33, 0.61);
      intakeDark.scale.set(1.2, 0.85, 1.0);
      carBodyGroup.add(intakeDark);

      // Downwash Waterfall Cooling Gills
      const gillGeos: THREE.BufferGeometry[] = [];
      for (let g = 0; g < 5; g++) {
        const gillGeo = new THREE.BoxGeometry(0.14, 0.008, 0.035);
        gillGeo.rotateY(side * 0.16);
        gillGeo.translate(side * 0.45, 0.43, -0.05 - g * 0.09);
        gillGeos.push(gillGeo);
      }
      const mergedGills = safeMergeAndDispose(gillGeos);
      if (mergedGills) {
        const gillMesh = new THREE.Mesh(mergedGills, materials.carbonMaterial);
        carBodyGroup.add(gillMesh);
      }

      // Aerodynamic Rearview Mirrors
      const p1 = new THREE.Vector3(side * 0.32, 0.46, 0.40);
      const p2 = new THREE.Vector3(side * 0.48, 0.56, 0.42);
      const p3 = new THREE.Vector3(side * 0.56, 0.55, 0.42);
      const rod1 = this.createRodGeometry(p1, p2, 0.008, 6);
      const rod2 = this.createRodGeometry(p2, p3, 0.008, 6);
      const mirrorRodGeos = [rod1, rod2].filter((g): g is THREE.BufferGeometry => g !== null);
      const mergedMirrorRods = safeMergeAndDispose(mirrorRodGeos);
      if (mergedMirrorRods) {
        const mirrorRodMesh = new THREE.Mesh(mergedMirrorRods, materials.carbonMaterial);
        carBodyGroup.add(mirrorRodMesh);
      }

      const mirrorHousingGeo = new THREE.BoxGeometry(0.12, 0.05, 0.06);
      const mirrorHousing = new THREE.Mesh(mirrorHousingGeo, materials.carbonGlossMaterial);
      mirrorHousing.position.set(side * 0.56, 0.55, 0.42);
      mirrorHousing.rotation.y = -side * 0.15;
      carBodyGroup.add(mirrorHousing);

      const mirrorGlassGeo = new THREE.PlaneGeometry(0.10, 0.04);
      const mirrorGlassMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.05 });
      const mirrorGlass = new THREE.Mesh(mirrorGlassGeo, mirrorGlassMat);
      mirrorGlass.position.set(side * 0.56, 0.55, 0.388);
      mirrorGlass.rotation.y = Math.PI - side * 0.15;
      carBodyGroup.add(mirrorGlass);
    });

    // =========================================================================
    // 3. CONTINUOUS CURVED TITANIUM SAFETY HALO (Merged Single Batch)
    // =========================================================================
    const haloGroup = new THREE.Group();
    const haloGeos: THREE.BufferGeometry[] = [];

    const v1 = new THREE.Vector3(0, 0.46, 0.50);
    const v2 = new THREE.Vector3(0, 0.62, 0.38);
    const v3 = new THREE.Vector3(0, 0.70, 0.24);
    const gv1 = this.createRodGeometry(v1, v2, 0.020, 10);
    const gv2 = this.createRodGeometry(v2, v3, 0.020, 10);
    if (gv1) haloGeos.push(gv1);
    if (gv2) haloGeos.push(gv2);

    const archPts = [
      new THREE.Vector3(-0.28, 0.53, -0.22),
      new THREE.Vector3(-0.30, 0.69, 0.02),
      new THREE.Vector3(0, 0.70, 0.24),
      new THREE.Vector3(0.30, 0.69, 0.02),
      new THREE.Vector3(0.28, 0.53, -0.22),
    ];
    for (let i = 0; i < archPts.length - 1; i++) {
      const gSeg = this.createRodGeometry(archPts[i], archPts[i + 1], 0.022, 10);
      if (gSeg) haloGeos.push(gSeg);
      if (i > 0) {
        const jointGeo = new THREE.SphereGeometry(0.022, 10, 8);
        jointGeo.translate(archPts[i].x, archPts[i].y, archPts[i].z);
        haloGeos.push(jointGeo);
      }
    }

    const mergedHalo = safeMergeAndDispose(haloGeos);
    if (mergedHalo) {
      const haloMesh = new THREE.Mesh(mergedHalo, materials.haloMaterial);
      haloMesh.castShadow = true;
      haloMesh.matrixAutoUpdate = false;
      haloMesh.updateMatrix();
      haloGroup.add(haloMesh);
    }

    const haloFairingGeo = new THREE.BoxGeometry(0.12, 0.012, 0.06);
    const haloFairingMesh = new THREE.Mesh(haloFairingGeo, materials.carbonGlossMaterial);
    haloFairingMesh.position.set(0, 0.725, 0.24);
    haloGroup.add(haloFairingMesh);

    const haloDecalGeo = new THREE.PlaneGeometry(0.118, 0.058);
    haloDecalGeo.rotateX(-Math.PI / 2);
    const haloDecalMesh = new THREE.Mesh(haloDecalGeo, materials.haloDecalMaterial);
    haloDecalMesh.position.set(0, 0.732, 0.24);
    haloGroup.add(haloDecalMesh);
    carBodyGroup.add(haloGroup);

    // =========================================================================
    // 4. OVERHEAD AIRBOX SCOOP & CARBON DORSAL SHARK FIN
    // =========================================================================
    const airboxRimGeo = new THREE.RingGeometry(0.06, 0.09, 16);
    const airboxRim = new THREE.Mesh(airboxRimGeo, materials.carbonGlossMaterial);
    airboxRim.position.set(0, 0.76, 0.18);
    carBodyGroup.add(airboxRim);

    const airboxDarkGeo = new THREE.CircleGeometry(0.07, 16);
    const airboxDark = new THREE.Mesh(airboxDarkGeo, new THREE.MeshBasicMaterial({ color: 0x050508 }));
    airboxDark.position.set(0, 0.76, 0.17);
    carBodyGroup.add(airboxDark);

    const sharkFinShape = new THREE.Shape();
    sharkFinShape.moveTo(0, 0.78);
    sharkFinShape.lineTo(-1.32, 0.74);
    sharkFinShape.lineTo(-1.42, 0.42);
    sharkFinShape.lineTo(0.05, 0.50);
    sharkFinShape.closePath();

    const sharkFinGeo = new THREE.ExtrudeGeometry(sharkFinShape, {
      depth: 0.016,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 2,
    });
    sharkFinGeo.rotateY(Math.PI / 2);

    const sPos = sharkFinGeo.attributes.position;
    const sUvs = sharkFinGeo.attributes.uv;
    for (let i = 0; i < sPos.count; i++) {
      const z = sPos.getZ(i);
      const y = sPos.getY(i);
      const u = THREE.MathUtils.clamp((0.05 - z) / 1.47, 0, 1);
      const v = THREE.MathUtils.clamp((y - 0.42) / 0.36, 0, 1);
      sUvs.setXY(i, u, v);
    }
    sUvs.needsUpdate = true;

    const sharkFinMesh = new THREE.Mesh(sharkFinGeo, materials.sharkFinMaterial);
    sharkFinMesh.position.set(-0.008, 0, 0.12);
    sharkFinMesh.castShadow = true;
    carBodyGroup.add(sharkFinMesh);

    // =========================================================================
    // 5. STEPPED GROUND-EFFECT CARBON FLOOR & REAR VENTURI DIFFUSER (Batched)
    // =========================================================================
    const floorGeos: THREE.BufferGeometry[] = [];
    const floorGeo = new THREE.BoxGeometry(1.68, 0.032, 2.90);
    floorGeo.translate(0, 0.11, 0.05);
    floorGeos.push(floorGeo);

    const diffRampGeo = new THREE.PlaneGeometry(1.26, 0.78);
    diffRampGeo.rotateX(Math.PI / 2 - 0.28);
    diffRampGeo.translate(0, 0.19, -1.68);
    floorGeos.push(diffRampGeo);

    [-0.46, -0.16, 0.16, 0.46].forEach((fenceX) => {
      const fenceGeo = new THREE.BoxGeometry(0.016, 0.16, 0.70);
      fenceGeo.rotateX(-0.28);
      fenceGeo.translate(fenceX, 0.18, -1.68);
      floorGeos.push(fenceGeo);
    });

    const mergedFloor = safeMergeAndDispose(floorGeos);
    if (mergedFloor) {
      const floorMesh = new THREE.Mesh(mergedFloor, materials.carbonMaterial);
      floorMesh.receiveShadow = true;
      floorMesh.castShadow = true;
      carBodyGroup.add(floorMesh);
    }

    const strakeGeos: THREE.BufferGeometry[] = [];
    [-0.84, 0.84].forEach((sideX) => {
      const strakeGeo = new THREE.BoxGeometry(0.024, 0.055, 1.90);
      strakeGeo.translate(sideX, 0.13, 0.10);
      strakeGeos.push(strakeGeo);
    });
    const mergedStrakes = safeMergeAndDispose(strakeGeos);
    if (mergedStrakes) {
      const strakeMesh = new THREE.Mesh(mergedStrakes, materials.carbonGlossMaterial);
      carBodyGroup.add(strakeMesh);
    }

    // =========================================================================
    // 6. ADVANCED GROUND-EFFECT MULTI-ELEMENT 3D FRONT WING ASSEMBLY
    // =========================================================================
    const frontWingGroup = new THREE.Group();
    this.frontWingGroup = frontWingGroup;

    this.frontWingLeftGroup = new THREE.Group();
    this.frontWingRightGroup = new THREE.Group();
    frontWingGroup.add(this.frontWingLeftGroup);
    frontWingGroup.add(this.frontWingRightGroup);

    [-1, 1].forEach((dir) => {
      const isRight = dir > 0;
      const targetSideGroup = isRight ? this.frontWingRightGroup : this.frontWingLeftGroup;

      const mainplaneGroup = new THREE.Group();
      const upperFlapsGroup = new THREE.Group();
      const endplateGroup = new THREE.Group();

      const stubGeo = new THREE.BoxGeometry(0.12, 0.038, 0.22);
      const stubMesh = new THREE.Mesh(stubGeo, materials.carbonMaterial);
      stubMesh.position.set(isRight ? 0.14 : -0.14, 0.12, 2.18);
      stubMesh.rotation.y = isRight ? -0.15 : 0.15;
      stubMesh.visible = false;
      targetSideGroup.add(stubMesh);

      // Element 1: Mainplane
      const fwMainGeo = new THREE.BoxGeometry(0.97, 0.026, 0.46, 16, 1, 8);
      const fwMainPos = fwMainGeo.attributes.position;
      for (let i = 0; i < fwMainPos.count; i++) {
        const localX = fwMainPos.getX(i);
        const globalX = isRight ? (localX + 0.485) : (localX - 0.485);
        const z = fwMainPos.getZ(i);
        const normX = Math.abs(globalX) / 0.97;
        const spoonDip = (1.0 - Math.min(1.0, Math.pow(normX, 1.8))) * -0.055;
        const chordNorm = (z + 0.23) / 0.46;
        const camberLift = Math.sin(chordNorm * Math.PI) * 0.018;
        const tipDihedral = Math.pow(normX, 3.0) * 0.028;

        fwMainPos.setY(i, fwMainPos.getY(i) + spoonDip + camberLift + tipDihedral);
        if (chordNorm > 0.7) {
          fwMainPos.setZ(i, z - Math.pow(normX, 2.2) * 0.06);
        }
      }
      fwMainGeo.computeVertexNormals();
      const fwMainMesh = new THREE.Mesh(fwMainGeo, materials.carbonMaterial);
      fwMainMesh.position.set(isRight ? 0.485 : -0.485, 0.115, 2.22);
      fwMainMesh.castShadow = true;
      mainplaneGroup.add(fwMainMesh);

      // Element 2: Secondary Flap
      const fwFlap2Geo = new THREE.BoxGeometry(0.94, 0.018, 0.28, 14, 1, 6);
      const fwFlap2Pos = fwFlap2Geo.attributes.position;
      for (let i = 0; i < fwFlap2Pos.count; i++) {
        const localX = fwFlap2Pos.getX(i);
        const globalX = isRight ? (localX + 0.47) : (localX - 0.47);
        const normX = Math.abs(globalX) / 0.94;
        const spoonDip = (1.0 - Math.min(1.0, Math.pow(normX, 1.8))) * -0.048;
        const tipDihedral = Math.pow(normX, 3.0) * 0.025;
        fwFlap2Pos.setY(i, fwFlap2Pos.getY(i) + spoonDip + tipDihedral);
      }
      fwFlap2Geo.computeVertexNormals();
      const fwFlap2Mesh = new THREE.Mesh(fwFlap2Geo, materials.carbonGlossMaterial);
      fwFlap2Mesh.position.set(isRight ? 0.47 : -0.47, 0.145, 2.12);
      fwFlap2Mesh.rotation.x = -0.12;
      fwFlap2Mesh.castShadow = false;
      mainplaneGroup.add(fwFlap2Mesh);

      // Element 3: Tertiary Downwash Flap
      const fwFlap3Geo = new THREE.BoxGeometry(0.92, 0.016, 0.22, 12, 1, 4);
      const fwFlap3Pos = fwFlap3Geo.attributes.position;
      for (let i = 0; i < fwFlap3Pos.count; i++) {
        const localX = fwFlap3Pos.getX(i);
        const globalX = isRight ? (localX + 0.46) : (localX - 0.46);
        const normX = Math.abs(globalX) / 0.92;
        const spoonDip = (1.0 - Math.min(1.0, Math.pow(normX, 1.8))) * -0.042;
        const tipDihedral = Math.pow(normX, 3.0) * 0.022;
        fwFlap3Pos.setY(i, fwFlap3Pos.getY(i) + spoonDip + tipDihedral);
      }
      fwFlap3Geo.computeVertexNormals();
      const fwFlap3Mesh = new THREE.Mesh(fwFlap3Geo, materials.bodyMaterial);
      fwFlap3Mesh.position.set(isRight ? 0.46 : -0.46, 0.175, 2.04);
      fwFlap3Mesh.rotation.x = -0.19;
      fwFlap3Mesh.castShadow = false;
      upperFlapsGroup.add(fwFlap3Mesh);

      // Element 4: Top Flap with Decal Banner
      const fwTopFlapGeo = new THREE.BoxGeometry(0.90, 0.015, 0.18, 12, 1, 4);
      const fwTopFlapPos = fwTopFlapGeo.attributes.position;
      for (let i = 0; i < fwTopFlapPos.count; i++) {
        const localX = fwTopFlapPos.getX(i);
        const globalX = isRight ? (localX + 0.45) : (localX - 0.45);
        const normX = Math.abs(globalX) / 0.90;
        const spoonDip = (1.0 - Math.min(1.0, Math.pow(normX, 1.8))) * -0.038;
        const tipDihedral = Math.pow(normX, 3.0) * 0.020;
        fwTopFlapPos.setY(i, fwTopFlapPos.getY(i) + spoonDip + tipDihedral);
      }
      fwTopFlapGeo.computeVertexNormals();
      const fwTopFlapMesh = new THREE.Mesh(fwTopFlapGeo, materials.frontWingFlapMaterial);
      fwTopFlapMesh.position.set(isRight ? 0.45 : -0.45, 0.205, 1.96);
      fwTopFlapMesh.rotation.x = -0.25;
      fwTopFlapMesh.castShadow = false;
      upperFlapsGroup.add(fwTopFlapMesh);

      // Gurney Lip
      const gurneyGeo = new THREE.BoxGeometry(0.89, 0.008, 0.006);
      const gurneyMesh = new THREE.Mesh(gurneyGeo, materials.carbonGlossMaterial);
      gurneyMesh.position.set(isRight ? 0.45 : -0.45, 0.228, 1.88);
      upperFlapsGroup.add(gurneyMesh);

      (isRight ? [0.20, 0.42, 0.68] : [-0.68, -0.42, -0.20]).forEach((bx) => {
        const bracketGeo = new THREE.BoxGeometry(0.008, 0.08, 0.28);
        const bracketMesh = new THREE.Mesh(bracketGeo, materials.mechanicalMetalMat);
        bracketMesh.position.set(bx, 0.165, 2.05);
        upperFlapsGroup.add(bracketMesh);
      });

      // Endplates
      const sideX = isRight ? 0.97 : -0.97;
      const epShape = new THREE.Shape();
      epShape.moveTo(0, 0.03);
      epShape.lineTo(0.54, 0.04);
      epShape.lineTo(0.48, 0.32);
      epShape.lineTo(0.04, 0.28);
      epShape.quadraticCurveTo(-0.04, 0.18, 0, 0.03);

      const epGeo = new THREE.ExtrudeGeometry(epShape, {
        depth: 0.016,
        bevelEnabled: true,
        bevelThickness: 0.003,
        bevelSize: 0.003,
        bevelSegments: 2,
      });
      epGeo.rotateY(Math.PI / 2);

      const epPos = epGeo.attributes.position;
      for (let i = 0; i < epPos.count; i++) {
        const y = epPos.getY(i);
        if (y > 0.15) {
          epPos.setX(i, epPos.getX(i) + (isRight ? 1 : -1) * (y - 0.15) * 0.18);
        }
      }
      epGeo.computeVertexNormals();

      const epMesh = new THREE.Mesh(epGeo, materials.endplateDecalMaterial);
      epMesh.position.set(sideX, 0.05, 2.38);
      epMesh.castShadow = true;
      endplateGroup.add(epMesh);

      // Canard / Dive Plane
      const canardShape = new THREE.Shape();
      canardShape.moveTo(0, 0);
      canardShape.lineTo(0.24, 0.02);
      canardShape.quadraticCurveTo(0.18, 0.08, 0, 0.06);
      canardShape.closePath();
      const canardGeo = new THREE.ExtrudeGeometry(canardShape, { depth: 0.006, bevelEnabled: false });
      canardGeo.rotateY(isRight ? Math.PI / 2 : -Math.PI / 2);
      const canardMesh = new THREE.Mesh(canardGeo, materials.carbonGlossMaterial);
      canardMesh.position.set(sideX + (isRight ? 0.02 : -0.02), 0.18, 2.24);
      canardMesh.rotation.z = isRight ? -0.22 : 0.22;
      endplateGroup.add(canardMesh);

      // Footplate Tunnel
      const footGeo = new THREE.BoxGeometry(0.065, 0.008, 0.50);
      const footMesh = new THREE.Mesh(footGeo, materials.carbonMaterial);
      footMesh.position.set(sideX + (isRight ? 0.026 : -0.026), 0.065, 2.12);
      endplateGroup.add(footMesh);

      // Vortex Louvers
      for (let sl = 0; sl < 3; sl++) {
        const slatGeo = new THREE.BoxGeometry(0.006, 0.018, 0.08);
        const slatMesh = new THREE.Mesh(slatGeo, materials.carbonMaterial);
        slatMesh.position.set(sideX, 0.16 + sl * 0.035, 1.86);
        slatMesh.rotation.x = 0.35;
        endplateGroup.add(slatMesh);
      }

      if (isRight) {
        this.frontWingRightMainGroup = mainplaneGroup;
        this.frontWingRightUpperFlapGroup = upperFlapsGroup;
        this.endplateRightGroup = endplateGroup;
        this.frontWingRightStubMesh = stubMesh;
      } else {
        this.frontWingLeftMainGroup = mainplaneGroup;
        this.frontWingLeftUpperFlapGroup = upperFlapsGroup;
        this.endplateLeftGroup = endplateGroup;
        this.frontWingLeftStubMesh = stubMesh;
      }

      targetSideGroup.add(mainplaneGroup);
      targetSideGroup.add(upperFlapsGroup);
      targetSideGroup.add(endplateGroup);
    });

    // Central Nose Mounting Pylons & Cameras
    const pylonGeos: THREE.BufferGeometry[] = [];
    [-0.11, 0.11].forEach((pylonX) => {
      const p1 = new THREE.Vector3(pylonX, 0.34, 2.05);
      const p2 = new THREE.Vector3(pylonX * 1.15, 0.11, 2.22);
      const g = this.createRodGeometry(p1, p2, 0.016, 8);
      if (g) pylonGeos.push(g);
    });
    const mergedPylons = safeMergeAndDispose(pylonGeos);
    if (mergedPylons) {
      const pylonMesh = new THREE.Mesh(mergedPylons, materials.carbonMaterial);
      pylonMesh.castShadow = true;
      frontWingGroup.add(pylonMesh);
    }

    const camPodGeos: THREE.BufferGeometry[] = [];
    [-0.17, 0.17].forEach((camX) => {
      const camPodGeo = new THREE.CylinderGeometry(0.018, 0.024, 0.12, 10);
      camPodGeo.rotateX(Math.PI / 2);
      camPodGeo.translate(camX, 0.38, 2.02);
      camPodGeos.push(camPodGeo);
    });
    const mergedCamPods = safeMergeAndDispose(camPodGeos);
    if (mergedCamPods) {
      const camPodMesh = new THREE.Mesh(mergedCamPods, materials.carbonGlossMaterial);
      frontWingGroup.add(camPodMesh);
    }
    carBodyGroup.add(frontWingGroup);

    // =========================================================================
    // 7. ADVANCED 2026 GROUND-EFFECT REAR WING & ARTICULATED DRS SYSTEM
    // =========================================================================
    this.wingGroup = new THREE.Group();

    const rwMainGeo = new THREE.BoxGeometry(1.52, 0.036, 0.40, 32, 1, 8);
    const rwMainPos = rwMainGeo.attributes.position;
    for (let i = 0; i < rwMainPos.count; i++) {
      const x = rwMainPos.getX(i);
      const z = rwMainPos.getZ(i);
      const normX = Math.abs(x) / 0.76;
      const spoonDip = (1.0 - Math.min(1.0, Math.pow(normX, 1.8))) * -0.052;
      const chordNorm = (z + 0.20) / 0.40;
      const aerofoilCamber = Math.sin(chordNorm * Math.PI) * 0.022;
      const tipRise = Math.pow(normX, 2.5) * 0.034;
      rwMainPos.setY(i, rwMainPos.getY(i) + spoonDip + aerofoilCamber + tipRise);
    }
    rwMainGeo.computeVertexNormals();
    const rwMainMesh = new THREE.Mesh(rwMainGeo, materials.bodyMaterial);
    rwMainMesh.position.set(0, 0.76, -1.80);
    rwMainMesh.rotation.x = 0.14;
    rwMainMesh.castShadow = true;
    this.wingGroup.add(rwMainMesh);

    // Slot-Gap Separators
    const sepGeos: THREE.BufferGeometry[] = [];
    const stopGeos: THREE.BufferGeometry[] = [];
    [-0.34, 0.34].forEach((sepX) => {
      const sepGeo = new THREE.BoxGeometry(0.008, 0.08, 0.16);
      sepGeo.rotateX(0.14);
      sepGeo.translate(sepX, 0.81, -1.78);
      sepGeos.push(sepGeo);

      const stopGeo = new THREE.BoxGeometry(0.014, 0.010, 0.022);
      stopGeo.rotateX(0.14);
      stopGeo.translate(sepX, 0.846, -1.74);
      stopGeos.push(stopGeo);
    });
    const mergedSeps = safeMergeAndDispose(sepGeos);
    if (mergedSeps) {
      const sepMesh = new THREE.Mesh(mergedSeps, materials.carbonGlossMaterial);
      this.wingGroup.add(sepMesh);
    }
    const mergedStops = safeMergeAndDispose(stopGeos);
    if (mergedStops) {
      const stopMesh = new THREE.Mesh(mergedStops, materials.carbonMaterial);
      this.wingGroup.add(stopMesh);
    }

    // DRS Flap Pivot Group
    this.drsPivotGroup = new THREE.Group();
    this.drsPivotGroup.position.set(0, 0.88, -1.86);

    const drsFlapGeo = new THREE.BoxGeometry(1.48, 0.024, 0.22, 32, 1, 8);
    const drsFlapPos = drsFlapGeo.attributes.position;
    for (let i = 0; i < drsFlapPos.count; i++) {
      const x = drsFlapPos.getX(i);
      const z = drsFlapPos.getZ(i);
      const normX = Math.abs(x) / 0.74;
      const spoonDip = (1.0 - Math.min(1.0, Math.pow(normX, 1.8))) * -0.036;
      const tipRise = Math.pow(normX, 2.5) * 0.024;
      const chordNorm = (z + 0.11) / 0.22;
      const camber = Math.sin(chordNorm * Math.PI) * 0.014;
      drsFlapPos.setY(i, drsFlapPos.getY(i) + spoonDip + tipRise + camber);
    }
    drsFlapGeo.computeVertexNormals();
    const drsFlapMesh = new THREE.Mesh(drsFlapGeo, materials.carbonMaterial);
    drsFlapMesh.position.set(0, 0.0, 0.11);
    drsFlapMesh.castShadow = true;
    this.drsPivotGroup.add(drsFlapMesh);

    const drsBannerGeo = new THREE.PlaneGeometry(1.46, 0.18);
    const drsBannerMesh = new THREE.Mesh(drsBannerGeo, materials.rearWingMaterial);
    drsBannerMesh.position.set(0, 0.0, -0.002);
    drsBannerMesh.rotation.y = Math.PI;
    this.drsPivotGroup.add(drsBannerMesh);

    const drsTopPlateGeo = new THREE.PlaneGeometry(1.46, 0.21);
    drsTopPlateGeo.rotateX(-Math.PI / 2);
    const drsTopPlateMesh = new THREE.Mesh(drsTopPlateGeo, materials.carbonGlossMaterial);
    drsTopPlateMesh.position.set(0, 0.013, 0.11);
    this.drsPivotGroup.add(drsTopPlateMesh);

    const drsGurney = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.014, 0.006), materials.carbonGlossMaterial);
    drsGurney.position.set(0, 0.016, 0.001);
    this.drsPivotGroup.add(drsGurney);

    [-0.42, 0, 0.42].forEach((rx) => {
      const ribGeo = new THREE.BoxGeometry(0.010, 0.018, 0.20);
      const ribMesh = new THREE.Mesh(ribGeo, materials.carbonGlossMaterial);
      ribMesh.position.set(rx, -0.019, 0.11);
      this.drsPivotGroup.add(ribMesh);
    });

    const clevisGeo = new THREE.BoxGeometry(0.032, 0.038, 0.045);
    const clevisMesh = new THREE.Mesh(clevisGeo, materials.mechanicalMetalMat);
    clevisMesh.position.set(0, -0.020, 0.04);
    this.drsPivotGroup.add(clevisMesh);

    [-0.34, 0.34].forEach((px) => {
      const padGeo = new THREE.BoxGeometry(0.018, 0.008, 0.035);
      const padMesh = new THREE.Mesh(padGeo, materials.carbonMaterial);
      padMesh.position.set(px, -0.019, 0.19);
      this.drsPivotGroup.add(padMesh);
    });

    this.drsPivotGroup.rotation.x = 0.12;
    this.wingGroup.add(this.drsPivotGroup);

    // DRS Actuator Bullet Pod
    const drsPodGroup = new THREE.Group();
    drsPodGroup.position.set(0, 0.80, -1.78);

    const podBodyGeo = new THREE.CylinderGeometry(0.026, 0.034, 0.16, 14);
    podBodyGeo.rotateX(Math.PI / 2);
    const podBody = new THREE.Mesh(podBodyGeo, materials.carbonGlossMaterial);
    drsPodGroup.add(podBody);

    const podNoseGeo = new THREE.SphereGeometry(0.026, 12, 8);
    podNoseGeo.scale(1, 1, 1.8);
    const podNose = new THREE.Mesh(podNoseGeo, materials.carbonGlossMaterial);
    podNose.position.set(0, 0, 0.09);
    drsPodGroup.add(podNose);

    const pistonGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.10, 12);
    pistonGeo.rotateX(Math.PI / 2);
    this.drsPistonMesh = new THREE.Mesh(pistonGeo, materials.mechanicalMetalMat);
    this.drsPistonMesh.position.set(0, 0.028, -0.04);
    drsPodGroup.add(this.drsPistonMesh);

    const rockerGeo = new THREE.BoxGeometry(0.007, 0.065, 0.014);
    [-0.034, 0.034].forEach((rx, idx) => {
      const rockerArm = new THREE.Mesh(rockerGeo, materials.carbonGlossMaterial);
      rockerArm.position.set(rx, 0.040, -0.05);
      rockerArm.rotation.x = 0.15;
      drsPodGroup.add(rockerArm);
      if (idx === 0) this.drsRockerArmLeft = rockerArm;
      else this.drsRockerArmRight = rockerArm;
    });

    [-0.018, 0.018].forEach((hx) => {
      const p1 = new THREE.Vector3(hx, -0.04, 0.14);
      const p2 = new THREE.Vector3(hx * 0.6, 0.01, 0.06);
      const hose = this.createRodMesh(p1, p2, 0.005, materials.mechanicalMetalMat, 6);
      drsPodGroup.add(hose);
    });

    const ledGeo = new THREE.BoxGeometry(0.044, 0.014, 0.05);
    this.drsLedMesh = new THREE.Mesh(ledGeo, materials.drsLedMaterial);
    this.drsLedMesh.position.set(0, 0.034, 0.01);
    drsPodGroup.add(this.drsLedMesh);

    if (!isAi) {
      this.drsPointLight = new THREE.PointLight(0x10b981, 0, 1.8, 2.0);
      this.drsPointLight.position.set(0, 0.08, -0.06);
      drsPodGroup.add(this.drsPointLight);
    }
    this.wingGroup.add(drsPodGroup);

    // Lower Beam Wings
    const beamWing1 = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.016, 0.22), materials.carbonMaterial);
    beamWing1.position.set(0, 0.38, -1.72);
    beamWing1.rotation.x = 0.26;
    beamWing1.castShadow = false;
    this.wingGroup.add(beamWing1);

    const beamWing2 = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.014, 0.18), materials.carbonMaterial);
    beamWing2.position.set(0, 0.45, -1.67);
    beamWing2.rotation.x = 0.20;
    beamWing2.castShadow = false;
    this.wingGroup.add(beamWing2);

    // Rear Endplates
    [-0.76, 0.76].forEach((sideX) => {
      const isRight = sideX > 0;
      const rwEndplateGroup = new THREE.Group();
      const endplateShape = new THREE.Shape();
      endplateShape.moveTo(-0.28, 0.44);
      endplateShape.lineTo(0.28, 0.44);
      endplateShape.lineTo(0.26, 1.16);
      endplateShape.quadraticCurveTo(0.18, 1.22, 0.02, 1.20);
      endplateShape.lineTo(-0.26, 1.14);
      endplateShape.quadraticCurveTo(-0.32, 0.72, -0.28, 0.44);
      endplateShape.closePath();

      const rwEndplateGeo = new THREE.ExtrudeGeometry(endplateShape, {
        depth: 0.018,
        bevelEnabled: true,
        bevelThickness: 0.003,
        bevelSize: 0.003,
        bevelSegments: 2,
      });
      rwEndplateGeo.rotateY(Math.PI / 2);

      const epPos = rwEndplateGeo.attributes.position;
      const epUvs = rwEndplateGeo.attributes.uv;
      for (let i = 0; i < epPos.count; i++) {
        const z = epPos.getZ(i);
        const y = epPos.getY(i);
        const u = THREE.MathUtils.clamp((z + 0.32) / 0.64, 0, 1);
        const v = THREE.MathUtils.clamp((y - 0.40) / 0.82, 0, 1);
        epUvs.setXY(i, u, v);
      }
      epUvs.needsUpdate = true;

      const rwEndplate = new THREE.Mesh(rwEndplateGeo, materials.endplateDecalMaterial);
      rwEndplate.position.set(sideX, 0, -1.82);
      rwEndplate.castShadow = true;
      rwEndplateGroup.add(rwEndplate);

      const blisterGeo = new THREE.CylinderGeometry(0.016, 0.020, 0.026, 12);
      blisterGeo.rotateZ(Math.PI / 2);
      const blisterMesh = new THREE.Mesh(blisterGeo, materials.carbonGlossMaterial);
      blisterMesh.position.set(sideX + (isRight ? 0.012 : -0.012), 0.985, -1.86);
      rwEndplateGroup.add(blisterMesh);

      const pinGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.034, 10);
      pinGeo.rotateZ(Math.PI / 2);
      const pinMesh = new THREE.Mesh(pinGeo, materials.mechanicalMetalMat);
      pinMesh.position.set(sideX + (isRight ? 0.014 : -0.014), 0.985, -1.86);
      rwEndplateGroup.add(pinMesh);

      const innerX = sideX + (isRight ? -0.012 : 0.012);
      [0.68, 0.82].forEach((sy) => {
        const strake = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.014, 0.36), materials.carbonGlossMaterial);
        strake.position.set(innerX, sy, -1.82);
        strake.rotation.x = -0.14;
        rwEndplateGroup.add(strake);
      });

      for (let v = 0; v < 3; v++) {
        const vGenGeo = new THREE.BoxGeometry(0.012, 0.012, 0.07);
        const vGen = new THREE.Mesh(vGenGeo, materials.carbonGlossMaterial);
        vGen.position.set(sideX + (isRight ? 0.012 : -0.012), 0.92 + v * 0.045, -1.66);
        vGen.rotation.x = 0.42;
        rwEndplateGroup.add(vGen);
      }

      if (isRight) {
        this.rwEndplateRight = rwEndplateGroup;
      } else {
        this.rwEndplateLeft = rwEndplateGroup;
      }
      this.wingGroup.add(rwEndplateGroup);
    });

    // Dual Overhead Swan-Neck Pylons
    [-0.15, 0.15].forEach((pylonX) => {
      const isRight = pylonX > 0;
      const sw1 = new THREE.Vector3(pylonX, 0.42, -1.45);
      const sw2 = new THREE.Vector3(pylonX, 0.76, -1.66);
      const sw3 = new THREE.Vector3(pylonX, 0.98, -1.78);
      const sw4 = new THREE.Vector3(pylonX, 0.94, -1.86);
      const seg1 = this.createRodGeometry(sw1, sw2, 0.014, 8);
      const seg2 = this.createRodGeometry(sw2, sw3, 0.014, 8);
      const seg3 = this.createRodGeometry(sw3, sw4, 0.014, 8);
      const pylonGeos = [seg1, seg2, seg3].filter((g): g is THREE.BufferGeometry => g !== null);
      const mergedPylon = safeMergeAndDispose(pylonGeos);

      if (mergedPylon) {
        const pylonMesh = new THREE.Mesh(mergedPylon, materials.carbonMaterial);
        pylonMesh.castShadow = true;
        pylonMesh.matrixAutoUpdate = false;
        pylonMesh.updateMatrix();
        if (isRight) {
          this.rwPylonRight = pylonMesh;
        } else {
          this.rwPylonLeft = pylonMesh;
        }
        this.wingGroup.add(pylonMesh);
      }
    });
    carBodyGroup.add(this.wingGroup);

    // =========================================================================
    // 8. EXPOSED CARBON DOUBLE-WISHBONE SUSPENSION (Airfoil Profiles)
    // =========================================================================
    const suspensionGroup = new THREE.Group();
    const carbonWishboneGeos: THREE.BufferGeometry[] = [];
    const metalWishboneGeos: THREE.BufferGeometry[] = [];

    const frontAxleZ = 1.35;
    [-1, 1].forEach((side) => {
      const hubX = side * 0.88;
      const chassX = side * 0.22;

      const uFwdStart = new THREE.Vector3(chassX, 0.42, frontAxleZ + 0.16);
      const uFwdEnd = new THREE.Vector3(hubX, 0.36, frontAxleZ);
      const uAftStart = new THREE.Vector3(chassX, 0.42, frontAxleZ - 0.16);
      const uAftEnd = new THREE.Vector3(hubX, 0.36, frontAxleZ);
      const g1 = this.createRodGeometry(uFwdStart, uFwdEnd, 0.012, 6);
      const g2 = this.createRodGeometry(uAftStart, uAftEnd, 0.012, 6);
      if (g1) carbonWishboneGeos.push(g1);
      if (g2) carbonWishboneGeos.push(g2);

      const lFwdStart = new THREE.Vector3(chassX, 0.18, frontAxleZ + 0.18);
      const lFwdEnd = new THREE.Vector3(hubX, 0.20, frontAxleZ);
      const lAftStart = new THREE.Vector3(chassX, 0.18, frontAxleZ - 0.18);
      const lAftEnd = new THREE.Vector3(hubX, 0.20, frontAxleZ);
      const g3 = this.createRodGeometry(lFwdStart, lFwdEnd, 0.014, 6);
      const g4 = this.createRodGeometry(lAftStart, lAftEnd, 0.014, 6);
      if (g3) carbonWishboneGeos.push(g3);
      if (g4) carbonWishboneGeos.push(g4);

      const pushrodStart = new THREE.Vector3(hubX, 0.22, frontAxleZ);
      const pushrodEnd = new THREE.Vector3(chassX * 0.7, 0.46, frontAxleZ + 0.06);
      const g5 = this.createRodGeometry(pushrodStart, pushrodEnd, 0.011, 6);
      if (g5) metalWishboneGeos.push(g5);

      const tieRodStart = new THREE.Vector3(chassX * 0.9, 0.26, frontAxleZ - 0.12);
      const tieRodEnd = new THREE.Vector3(hubX * 0.96, 0.26, frontAxleZ - 0.08);
      const g6 = this.createRodGeometry(tieRodStart, tieRodEnd, 0.010, 6);
      if (g6) metalWishboneGeos.push(g6);
    });

    const rearAxleZ = -1.35;
    [-1, 1].forEach((side) => {
      const hubX = side * 0.92;
      const chassX = side * 0.26;

      const uFwdStart = new THREE.Vector3(chassX, 0.44, rearAxleZ + 0.18);
      const uFwdEnd = new THREE.Vector3(hubX, 0.38, rearAxleZ);
      const uAftStart = new THREE.Vector3(chassX, 0.44, rearAxleZ - 0.18);
      const uAftEnd = new THREE.Vector3(hubX, 0.38, rearAxleZ);
      const g1 = this.createRodGeometry(uFwdStart, uFwdEnd, 0.013, 6);
      const g2 = this.createRodGeometry(uAftStart, uAftEnd, 0.013, 6);
      if (g1) carbonWishboneGeos.push(g1);
      if (g2) carbonWishboneGeos.push(g2);

      const lFwdStart = new THREE.Vector3(chassX, 0.18, rearAxleZ + 0.20);
      const lFwdEnd = new THREE.Vector3(hubX, 0.20, rearAxleZ);
      const lAftStart = new THREE.Vector3(chassX, 0.18, rearAxleZ - 0.20);
      const lAftEnd = new THREE.Vector3(hubX, 0.20, rearAxleZ);
      const g3 = this.createRodGeometry(lFwdStart, lFwdEnd, 0.015, 6);
      const g4 = this.createRodGeometry(lAftStart, lAftEnd, 0.015, 6);
      if (g3) carbonWishboneGeos.push(g3);
      if (g4) carbonWishboneGeos.push(g4);

      const driveShaftStart = new THREE.Vector3(chassX * 0.8, 0.28, rearAxleZ);
      const driveShaftEnd = new THREE.Vector3(hubX * 0.95, 0.28, rearAxleZ);
      const g5 = this.createRodGeometry(driveShaftStart, driveShaftEnd, 0.018, 8);
      if (g5) metalWishboneGeos.push(g5);
    });

    const mergedCarbonWishbones = safeMergeAndDispose(carbonWishboneGeos);
    if (mergedCarbonWishbones) {
      const carbonMesh = new THREE.Mesh(mergedCarbonWishbones, materials.carbonMaterial);
      carbonMesh.matrixAutoUpdate = false;
      carbonMesh.updateMatrix();
      suspensionGroup.add(carbonMesh);
    }

    const mergedMetalWishbones = safeMergeAndDispose(metalWishboneGeos);
    if (mergedMetalWishbones) {
      const metalMesh = new THREE.Mesh(mergedMetalWishbones, materials.mechanicalMetalMat);
      metalMesh.matrixAutoUpdate = false;
      metalMesh.updateMatrix();
      suspensionGroup.add(metalMesh);
    }
    carBodyGroup.add(suspensionGroup);

    // =========================================================================
    // 9. RACING COCKPIT, F1 BUTTERFLY STEERING WHEEL & DRIVER
    // =========================================================================
    this.steeringWheelPivot = new THREE.Group();
    this.steeringWheelPivot.position.set(0, 0.46, 0.28);
    this.steeringWheel = new THREE.Group();

    const hubMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.024), materials.carbonMaterial);
    this.steeringWheel.add(hubMesh);

    const gripMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
    [-0.082, 0.082].forEach((gripX) => {
      const isRight = gripX > 0;
      const gripGeo = new THREE.CylinderGeometry(0.014, 0.016, 0.11, 10);
      gripGeo.rotateZ(isRight ? -0.12 : 0.12);
      const grip = new THREE.Mesh(gripGeo, gripMat);
      grip.position.set(gripX, 0, 0.005);
      this.steeringWheel.add(grip);

      const gloveGeo = new THREE.SphereGeometry(0.026, 12, 10);
      gloveGeo.scale(0.85, 1.35, 1.05);
      const gloveMat = new THREE.MeshStandardMaterial({
        color: materials.liveryConfig.accentColor ? new THREE.Color(materials.liveryConfig.accentColor) : new THREE.Color(0xdc2626),
        roughness: 0.70,
        metalness: 0.05,
      });
      const glove = new THREE.Mesh(gloveGeo, gloveMat);
      glove.position.set(gripX, 0.005, 0.012);
      this.steeringWheel.add(glove);
    });

    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.038), new THREE.MeshBasicMaterial({ color: 0x0284c7 }));
    lcd.position.set(0, 0.005, 0.013);
    this.steeringWheel.add(lcd);

    this.revLedMeshes = [];
    for (let led = -3; led <= 3; led++) {
      const baseColor = Math.abs(led) <= 1 ? 0x22c55e : Math.abs(led) === 2 ? 0xeab308 : 0xef4444;
      const ledMesh = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8), new THREE.MeshBasicMaterial({ color: baseColor }));
      ledMesh.position.set(led * 0.011, 0.032, 0.014);
      this.steeringWheel.add(ledMesh);
      this.revLedMeshes.push(ledMesh);
    }
    this.steeringWheelPivot.add(this.steeringWheel);
    carBodyGroup.add(this.steeringWheelPivot);

    // Driver Torso & Harness
    const torsoGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.24, 16);
    torsoGeo.scale(1.15, 1.0, 0.75);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.88,
      metalness: 0.04,
    });
    const torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
    torsoMesh.position.set(0, 0.40, 0.02);
    carBodyGroup.add(torsoMesh);

    const beltGeos: THREE.BufferGeometry[] = [];
    [-0.055, 0.055].forEach((harnessX) => {
      const beltGeo = new THREE.BoxGeometry(0.026, 0.22, 0.008);
      beltGeo.rotateX(-0.15);
      beltGeo.translate(harnessX, 0.41, 0.08);
      beltGeos.push(beltGeo);
    });
    const mergedBelts = safeMergeAndDispose(beltGeos);
    if (mergedBelts) {
      const beltMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 });
      const beltMesh = new THREE.Mesh(mergedBelts, beltMat);
      carBodyGroup.add(beltMesh);
    }

    // Driver Helmet Assembly
    this.driverHelmet = new THREE.Group();
    this.driverHelmet.position.set(0, 0.58, 0.04);

    const helmetCraniumGeo = new THREE.SphereGeometry(0.126, 24, 20);
    helmetCraniumGeo.scale(0.92, 1.0, 1.10);

    const chinGeo = new THREE.CylinderGeometry(0.086, 0.106, 0.072, 18);
    chinGeo.scale(0.95, 1.0, 1.18);
    chinGeo.translate(0, -0.048, 0.042);

    const mergedHelmetShell = safeMergeAndDispose([helmetCraniumGeo, chinGeo]);
    if (mergedHelmetShell) {
      const helmetShellMesh = new THREE.Mesh(mergedHelmetShell, materials.helmetShellMat);
      helmetShellMesh.castShadow = true;
      this.driverHelmet.add(helmetShellMesh);
    }

    const chinVentGeo = new THREE.BoxGeometry(0.045, 0.016, 0.012);
    const chinVent = new THREE.Mesh(chinVentGeo, new THREE.MeshBasicMaterial({ color: 0x09090b }));
    chinVent.position.set(0, -0.045, 0.138);
    this.driverHelmet.add(chinVent);

    const visorGeo = new THREE.CylinderGeometry(0.124, 0.124, 0.044, 20, 1, true, -Math.PI * 0.36, Math.PI * 0.72);
    const visorMesh = new THREE.Mesh(visorGeo, materials.helmetVisorMat);
    visorMesh.rotation.y = Math.PI;
    visorMesh.position.set(0, 0.014, 0.022);
    this.driverHelmet.add(visorMesh);

    const sunstripGeo = new THREE.CylinderGeometry(0.1245, 0.1245, 0.012, 20, 1, true, -Math.PI * 0.36, Math.PI * 0.72);
    const sunstripMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.45,
      metalness: 0.1,
    });
    const sunstripMesh = new THREE.Mesh(sunstripGeo, sunstripMat);
    sunstripMesh.rotation.y = Math.PI;
    sunstripMesh.position.set(0, 0.032, 0.022);
    this.driverHelmet.add(sunstripMesh);

    const napeSpoilerGeo = new THREE.BoxGeometry(0.11, 0.016, 0.055);
    const napeSpoilerMat = new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.65,
      roughness: 0.12,
      metalness: 0.1,
      transmission: 0.6,
      ior: 1.5,
    });
    const napeSpoiler = new THREE.Mesh(napeSpoilerGeo, napeSpoilerMat);
    napeSpoiler.position.set(0, 0.035, -0.092);
    napeSpoiler.rotation.x = -0.38;
    this.driverHelmet.add(napeSpoiler);

    const hansGeo = new THREE.TorusGeometry(0.116, 0.022, 8, 18, Math.PI * 1.35);
    const hansMesh = new THREE.Mesh(hansGeo, materials.carbonMaterial);
    hansMesh.rotation.x = Math.PI * 0.52;
    hansMesh.rotation.z = -Math.PI * 0.675;
    hansMesh.position.set(0, -0.075, -0.015);
    this.driverHelmet.add(hansMesh);

    carBodyGroup.add(this.driverHelmet);
    parentGroup.add(carBodyGroup);
  }

  public createRodMesh(
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    material: THREE.Material,
    radialSegments = 8,
    radiusBottom = radius
  ): THREE.Mesh {
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    if (length < 0.0001) return new THREE.Mesh();

    const geo = new THREE.CylinderGeometry(radius, radiusBottom, length, radialSegments);
    geo.translate(0, length / 2, 0);
    geo.rotateX(Math.PI / 2);

    const mesh = new THREE.Mesh(geo, material);
    mesh.position.copy(start);
    mesh.lookAt(end);
    return mesh;
  }

  public createRodGeometry(
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    radialSegments = 8,
    radiusBottom = radius
  ): THREE.BufferGeometry | null {
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    if (length < 0.0001) return null;

    const geo = new THREE.CylinderGeometry(radius, radiusBottom, length, radialSegments);
    geo.translate(0, length / 2, 0);
    geo.rotateX(Math.PI / 2);

    const dummy = new THREE.Object3D();
    dummy.position.copy(start);
    dummy.lookAt(end);
    dummy.updateMatrix();
    geo.applyMatrix4(dummy.matrix);
    return geo;
  }

  public createFuselageGeometry(): THREE.BufferGeometry {
    const stations = [
      { z: 2.45,  yc: 0.18, rx: 0.06, ryt: 0.05, ryb: 0.04 },
      { z: 2.25,  yc: 0.22, rx: 0.11, ryt: 0.08, ryb: 0.06 },
      { z: 1.95,  yc: 0.27, rx: 0.18, ryt: 0.12, ryb: 0.08 },
      { z: 1.60,  yc: 0.32, rx: 0.25, ryt: 0.16, ryb: 0.11 },
      { z: 1.30,  yc: 0.36, rx: 0.32, ryt: 0.19, ryb: 0.13 },
      { z: 0.95,  yc: 0.40, rx: 0.38, ryt: 0.22, ryb: 0.15 },
      { z: 0.65,  yc: 0.43, rx: 0.44, ryt: 0.24, ryb: 0.16 },
      { z: 0.35,  yc: 0.45, rx: 0.48, ryt: 0.23, ryb: 0.17 },
      { z: 0.05,  yc: 0.46, rx: 0.48, ryt: 0.22, ryb: 0.17 },
      { z: -0.18, yc: 0.52, rx: 0.44, ryt: 0.32, ryb: 0.17 },
      { z: -0.38, yc: 0.50, rx: 0.40, ryt: 0.28, ryb: 0.17 },
      { z: -0.65, yc: 0.46, rx: 0.38, ryt: 0.24, ryb: 0.16 },
      { z: -0.92, yc: 0.42, rx: 0.34, ryt: 0.20, ryb: 0.15 },
      { z: -1.20, yc: 0.38, rx: 0.28, ryt: 0.16, ryb: 0.14 },
      { z: -1.45, yc: 0.35, rx: 0.22, ryt: 0.13, ryb: 0.12 },
      { z: -1.62, yc: 0.33, rx: 0.16, ryt: 0.10, ryb: 0.10 },
    ];

    const radialSegments = 32;
    const axialCount = stations.length;
    const vertexCount = axialCount * radialSegments + 2;

    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices: number[] = [];

    let vIdx = 0;
    for (let a = 0; a < axialCount; a++) {
      const st = stations[a];
      const v = a / (axialCount - 1);

      for (let r = 0; r < radialSegments; r++) {
        const u = r / radialSegments;
        const angle = u * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const radY = sinA >= 0 ? st.ryt : st.ryb;
        const x = cosA * st.rx;
        const y = st.yc + sinA * radY;
        const z = st.z;

        positions[vIdx * 3] = x;
        positions[vIdx * 3 + 1] = y;
        positions[vIdx * 3 + 2] = z;

        uvs[vIdx * 2] = u;
        uvs[vIdx * 2 + 1] = v;

        vIdx++;
      }
    }

    const frontPoleIdx = vIdx;
    positions[frontPoleIdx * 3] = 0;
    positions[frontPoleIdx * 3 + 1] = stations[0].yc;
    positions[frontPoleIdx * 3 + 2] = stations[0].z + 0.04;
    uvs[frontPoleIdx * 2] = 0.5;
    uvs[frontPoleIdx * 2 + 1] = 0.0;
    vIdx++;

    const rearPoleIdx = vIdx;
    positions[rearPoleIdx * 3] = 0;
    positions[rearPoleIdx * 3 + 1] = stations[axialCount - 1].yc;
    positions[rearPoleIdx * 3 + 2] = stations[axialCount - 1].z - 0.04;
    uvs[rearPoleIdx * 2] = 0.5;
    uvs[rearPoleIdx * 2 + 1] = 1.0;

    for (let a = 0; a < axialCount - 1; a++) {
      const ringA = a * radialSegments;
      const ringB = (a + 1) * radialSegments;

      for (let r = 0; r < radialSegments; r++) {
        const nextR = (r + 1) % radialSegments;

        const p1 = ringA + r;
        const p2 = ringA + nextR;
        const p3 = ringB + r;
        const p4 = ringB + nextR;

        indices.push(p1, p3, p2);
        indices.push(p2, p3, p4);
      }
    }

    for (let r = 0; r < radialSegments; r++) {
      const nextR = (r + 1) % radialSegments;
      indices.push(frontPoleIdx, r, nextR);
    }

    const lastRing = (axialCount - 1) * radialSegments;
    for (let r = 0; r < radialSegments; r++) {
      const nextR = (r + 1) % radialSegments;
      indices.push(rearPoleIdx, lastRing + nextR, lastRing + r);
    }

    const morphCrumplePos = new Float32Array(positions.length);
    const morphLeftDentPos = new Float32Array(positions.length);
    const morphRightDentPos = new Float32Array(positions.length);

    for (let i = 0; i < vertexCount; i++) {
      const origX = positions[i * 3];
      const origY = positions[i * 3 + 1];
      const origZ = positions[i * 3 + 2];

      if (origZ > 0.8) {
        const zRatio = (origZ - 0.8) / 1.65;
        const crumpleAmount = 0.42 * zRatio;
        const dentNoise = Math.sin(origX * 9.5 + origY * 6.0) * 0.11;
        const lateralCrease = Math.cos(origY * 8.0) * 0.05;

        morphCrumplePos[i * 3] = origX + lateralCrease;
        morphCrumplePos[i * 3 + 1] = origY + Math.abs(dentNoise) * 0.55;
        morphCrumplePos[i * 3 + 2] = origZ - crumpleAmount;

        const leftSideFactor = 1.0 + (origX < 0 ? 0.85 : 0.0);
        morphLeftDentPos[i * 3] = origX - 0.14 * zRatio;
        morphLeftDentPos[i * 3 + 1] = origY + Math.abs(dentNoise) * 0.4;
        morphLeftDentPos[i * 3 + 2] = origZ - crumpleAmount * leftSideFactor;

        const rightSideFactor = 1.0 + (origX > 0 ? 0.85 : 0.0);
        morphRightDentPos[i * 3] = origX + 0.14 * zRatio;
        morphRightDentPos[i * 3 + 1] = origY + Math.abs(dentNoise) * 0.4;
        morphRightDentPos[i * 3 + 2] = origZ - crumpleAmount * rightSideFactor;
      } else {
        morphCrumplePos[i * 3] = origX;
        morphCrumplePos[i * 3 + 1] = origY;
        morphCrumplePos[i * 3 + 2] = origZ;

        morphLeftDentPos[i * 3] = origX;
        morphLeftDentPos[i * 3 + 1] = origY;
        morphLeftDentPos[i * 3 + 2] = origZ;

        morphRightDentPos[i * 3] = origX;
        morphRightDentPos[i * 3 + 1] = origY;
        morphRightDentPos[i * 3 + 2] = origZ;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    geo.morphAttributes.position = [
      new THREE.BufferAttribute(morphCrumplePos, 3),
      new THREE.BufferAttribute(morphLeftDentPos, 3),
      new THREE.BufferAttribute(morphRightDentPos, 3),
    ];

    return geo;
  }

  public createSidepodGeometry(isRight: boolean): THREE.BufferGeometry {
    const side = isRight ? 1 : -1;
    const podStations = [
      { z: 0.62,  xc: 0.44, yc: 0.32, rx: 0.17, ry: 0.12 },
      { z: 0.42,  xc: 0.48, yc: 0.33, rx: 0.20, ry: 0.14 },
      { z: 0.15,  xc: 0.52, yc: 0.33, rx: 0.22, ry: 0.15 },
      { z: -0.15, xc: 0.50, yc: 0.32, rx: 0.21, ry: 0.14 },
      { z: -0.45, xc: 0.46, yc: 0.30, rx: 0.18, ry: 0.13 },
      { z: -0.75, xc: 0.40, yc: 0.27, rx: 0.15, ry: 0.11 },
      { z: -1.05, xc: 0.34, yc: 0.24, rx: 0.12, ry: 0.09 },
      { z: -1.30, xc: 0.28, yc: 0.22, rx: 0.08, ry: 0.07 },
    ];

    const radialSegments = 20;
    const axialCount = podStations.length;
    const vertexCount = axialCount * radialSegments + 2;

    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices: number[] = [];

    let vIdx = 0;
    for (let a = 0; a < axialCount; a++) {
      const st = podStations[a];
      const v = a / (axialCount - 1);

      for (let r = 0; r < radialSegments; r++) {
        const u = r / radialSegments;
        const angle = u * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const undercut = (sinA < 0 && cosA * side > 0) ? 0.65 : 1.0;
        const x = (st.xc + cosA * st.rx * undercut) * side;
        const y = st.yc + sinA * st.ry * undercut;
        const z = st.z;

        positions[vIdx * 3] = x;
        positions[vIdx * 3 + 1] = y;
        positions[vIdx * 3 + 2] = z;

        uvs[vIdx * 2] = u;
        uvs[vIdx * 2 + 1] = v;

        vIdx++;
      }
    }

    const frontPole = vIdx;
    positions[frontPole * 3] = podStations[0].xc * side;
    positions[frontPole * 3 + 1] = podStations[0].yc;
    positions[frontPole * 3 + 2] = podStations[0].z + 0.02;
    uvs[frontPole * 2] = 0.5;
    uvs[frontPole * 2 + 1] = 0.0;
    vIdx++;

    const rearPole = vIdx;
    positions[rearPole * 3] = podStations[axialCount - 1].xc * side;
    positions[rearPole * 3 + 1] = podStations[axialCount - 1].yc;
    positions[rearPole * 3 + 2] = podStations[axialCount - 1].z - 0.02;
    uvs[rearPole * 2] = 0.5;
    uvs[rearPole * 2 + 1] = 1.0;

    for (let a = 0; a < axialCount - 1; a++) {
      const ringA = a * radialSegments;
      const ringB = (a + 1) * radialSegments;

      for (let r = 0; r < radialSegments; r++) {
        const nextR = (r + 1) % radialSegments;
        const p1 = ringA + r;
        const p2 = ringA + nextR;
        const p3 = ringB + r;
        const p4 = ringB + nextR;

        if (side > 0) {
          indices.push(p1, p3, p2);
          indices.push(p2, p3, p4);
        } else {
          indices.push(p1, p2, p3);
          indices.push(p2, p4, p3);
        }
      }
    }

    for (let r = 0; r < radialSegments; r++) {
      const nextR = (r + 1) % radialSegments;
      if (side > 0) {
        indices.push(frontPole, r, nextR);
        indices.push(rearPole, (axialCount - 1) * radialSegments + nextR, (axialCount - 1) * radialSegments + r);
      } else {
        indices.push(frontPole, nextR, r);
        indices.push(rearPole, (axialCount - 1) * radialSegments + r, (axialCount - 1) * radialSegments + nextR);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }
}
