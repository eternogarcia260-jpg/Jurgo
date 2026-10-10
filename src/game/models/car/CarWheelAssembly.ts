/**
 * CarWheelAssembly.ts - Competition 18" Wheels, Tires, Brakes & Kinetic Suspension
 * Manages 4-corner wheel assemblies, PBR tire deformation, BBS forged rims,
 * radial motion blur transitions, centerlock nuts, carbon-ceramic thermal brake glow,
 * and Ackermann steering geometry.
 */

import * as THREE from 'three';
import { safeMergeAndDispose } from '../../utils/GeometryUtils';
import { TireCompoundType, TIRE_COMPOUNDS } from '../../physics/TireCompound';
import { DamageState } from '../../physics/VehiclePhysics';
import { CarLiveryFactory } from './CarLiveryFactory';
import { CarMaterials } from './CarMaterials';

export class CarWheelAssembly {
  public wheelMeshes: THREE.Group[] = [];
  public wheelPivots: THREE.Group[] = [];
  public wheelPivotsFront: THREE.Group[] = [];
  public brakeDiscs: THREE.Mesh[] = [];
  public tireStripeMaterials: THREE.MeshStandardMaterial[] = [];
  public tireMeshList: THREE.Mesh[] = [];
  public spokeMeshes: THREE.Mesh[] = [];
  public spokeMaterials: THREE.MeshStandardMaterial[] = [];
  public wheelBlurMeshes: THREE.Mesh[] = [];
  public wheelBlurMaterials: THREE.MeshStandardMaterial[] = [];
  public centerlockNuts: THREE.Mesh[] = [];

  public currentTireCompoundColor: string = '#ef4444';
  public currentBlurOpacity: number = 0;
  public currentTireTemp: number[] = [0, 0, 0, 0];
  public currentWheelCompression: number[] = [0, 0, 0, 0];

  private currentBrakeTemp: number = 0;
  private lastBrakeIntensity: number = -1;
  private materialsRef?: CarMaterials;

  public buildWheels(parentGroup: THREE.Group, materials: CarMaterials): void {
    this.materialsRef = materials;

    const wheelPositions = [
      { x: -0.92, y: 0.33, z: 1.35, isFront: true, isRight: false },
      { x: 0.92, y: 0.33, z: 1.35, isFront: true, isRight: true },
      { x: -0.96, y: 0.35, z: -1.35, isFront: false, isRight: false },
      { x: 0.96, y: 0.35, z: -1.35, isFront: false, isRight: true },
    ];

    this.wheelMeshes = [];
    this.wheelPivots = [];
    this.wheelPivotsFront = [];
    this.brakeDiscs = [];
    this.tireStripeMaterials = [];
    this.tireMeshList = [];
    this.centerlockNuts = [];
    this.spokeMeshes = [];
    this.spokeMaterials = [];
    this.wheelBlurMeshes = [];
    this.wheelBlurMaterials = [];

    const treadNormal = CarLiveryFactory.getTreadNormalTexture();

    wheelPositions.forEach((wp) => {
      const pivot = new THREE.Group();
      pivot.position.set(wp.x, wp.y, wp.z);
      pivot.userData = { baseY: wp.y };

      const wheelRotGroup = new THREE.Group();

      const tireRadius = wp.isFront ? 0.33 : 0.35;
      const tireWidth = wp.isFront ? 0.30 : 0.38;

      // 1. ROUNDED-SHOULDER COMPETITION SLICK TIRE WITH PBR TREAD NORMAL MAP
      const tireSegments = 28;
      const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, tireSegments, 6, false);
      tireGeo.rotateZ(Math.PI / 2);
      const tirePos = tireGeo.attributes.position;
      for (let i = 0; i < tirePos.count; i++) {
        const x = tirePos.getX(i);
        const normX = Math.min(1.0, Math.abs(x) / (tireWidth / 2));
        if (normX > 0.65) {
          const shoulderProgress = Math.min(1.0, Math.max(0.0, (normX - 0.65) / 0.35));
          const shoulderRound = Math.pow(shoulderProgress, 2.0) * 0.022;
          const y = tirePos.getY(i);
          const z = tirePos.getZ(i);
          const r = Math.sqrt(y * y + z * z);
          if (r > 0.05 && Number.isFinite(r)) {
            const newR = Math.max(0.01, r - shoulderRound);
            const scale = newR / r;
            if (Number.isFinite(scale)) {
              tirePos.setY(i, y * scale);
              tirePos.setZ(i, z * scale);
            }
          }
        }
      }
      tireGeo.computeVertexNormals();

      const tireMat = new THREE.MeshStandardMaterial({
        color: 0x141519,
        roughness: 0.74,
        metalness: 0.0,
        normalMap: treadNormal,
        normalScale: new THREE.Vector2(0.40, 0.40),
        envMapIntensity: 0.38,
      });
      const tireMesh = new THREE.Mesh(tireGeo, tireMat);
      tireMesh.castShadow = true;
      tireMesh.receiveShadow = true;
      wheelRotGroup.add(tireMesh);
      this.tireMeshList.push(tireMesh);

      // 2. Pirelli P-Zero Competition Sidewall Identification Ring & Stencil
      const sidewallTex = CarLiveryFactory.createTireSidewallTexture(this.currentTireCompoundColor);
      const pzeroGeo = new THREE.RingGeometry(tireRadius * 0.62, tireRadius * 0.98, 32);
      pzeroGeo.rotateY(wp.isRight ? Math.PI / 2 : -Math.PI / 2);
      const pzeroMat = new THREE.MeshStandardMaterial({
        map: sidewallTex,
        roughness: 0.52,
        metalness: 0.02,
        envMapIntensity: 0.60,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1.0,
      });
      const pzeroRing = new THREE.Mesh(pzeroGeo, pzeroMat);
      pzeroRing.position.x = wp.isRight ? tireWidth / 2 + 0.004 : -tireWidth / 2 - 0.004;
      wheelRotGroup.add(pzeroRing);
      this.tireStripeMaterials.push(pzeroMat);

      // 3. BBS FORGED DEEP-DISH CONCAVE RACING RIM
      const rimRadius = tireRadius * 0.64;
      const rimGroup = new THREE.Group();

      const barrelGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, tireWidth * 0.92, 20, 1, true);
      barrelGeo.rotateZ(Math.PI / 2);
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0x181a20,
        metalness: 0.92,
        roughness: 0.26,
        envMapIntensity: 1.40,
      });
      const barrel = new THREE.Mesh(barrelGeo, rimMat);
      rimGroup.add(barrel);

      // 10 Sculpted Deep-Dish Concave Forged Spokes
      const spokeCount = 10;
      const spokeGeos: THREE.BufferGeometry[] = [];
      for (let s = 0; s < spokeCount; s++) {
        const angle = (s / spokeCount) * Math.PI * 2;
        const hubPoint = new THREE.Vector3(
          wp.isRight ? tireWidth * 0.36 : -tireWidth * 0.36,
          0,
          0
        );
        const rimPoint = new THREE.Vector3(
          wp.isRight ? tireWidth * 0.48 : -tireWidth * 0.48,
          Math.sin(angle) * (rimRadius * 0.96),
          Math.cos(angle) * (rimRadius * 0.96)
        );
        const sGeo = this.createSpokeGeometry(hubPoint, rimPoint, 0.012, 6, 0.016);
        if (sGeo) spokeGeos.push(sGeo);
      }
      const mergedSpokes = safeMergeAndDispose(spokeGeos);
      const spokeMat = new THREE.MeshStandardMaterial({
        color: 0x181a20,
        metalness: 0.92,
        roughness: 0.26,
        envMapIntensity: 1.40,
        transparent: true,
        opacity: 1.0,
      });
      if (mergedSpokes) {
        const spokeMesh = new THREE.Mesh(mergedSpokes, spokeMat);
        rimGroup.add(spokeMesh);
        this.spokeMeshes.push(spokeMesh);
        this.spokeMaterials.push(spokeMat);
      }
      wheelRotGroup.add(rimGroup);

      // 4. High-Speed Radial Motion Blur Disk
      const blurTex = CarLiveryFactory.createWheelRadialBlurTexture(this.currentTireCompoundColor);
      const blurGeo = new THREE.RingGeometry(rimRadius * 0.20, tireRadius * 0.985, 36);
      blurGeo.rotateY(wp.isRight ? Math.PI / 2 : -Math.PI / 2);
      const blurMat = new THREE.MeshStandardMaterial({
        map: blurTex,
        roughness: 0.26,
        metalness: 0.88,
        envMapIntensity: 1.25,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const blurMesh = new THREE.Mesh(blurGeo, blurMat);
      blurMesh.position.x = wp.isRight ? tireWidth / 2 + 0.006 : -tireWidth / 2 - 0.006;
      blurMesh.visible = false;
      wheelRotGroup.add(blurMesh);
      this.wheelBlurMeshes.push(blurMesh);
      this.wheelBlurMaterials.push(blurMat);

      // 5. Anodized Centerlock Wheel Nut (Blue on Right, Red on Left)
      const nutGeo = new THREE.CylinderGeometry(0.045, 0.055, tireWidth + 0.025, 8);
      nutGeo.rotateZ(Math.PI / 2);
      const nutMat = new THREE.MeshStandardMaterial({
        color: wp.isRight ? 0x0284c7 : 0xcc0022,
        metalness: 0.95,
        roughness: 0.16,
      });
      const nut = new THREE.Mesh(nutGeo, nutMat);
      wheelRotGroup.add(nut);
      this.centerlockNuts.push(nut);

      // 6. Perforated Carbon-Ceramic Brake Disc (Shared Material)
      const discRadius = rimRadius * 0.82;
      const discGeo = new THREE.CylinderGeometry(discRadius, discRadius, 0.028, 20);
      discGeo.rotateZ(Math.PI / 2);
      const disc = new THREE.Mesh(discGeo, materials.brakeDiscMaterial);
      this.brakeDiscs.push(disc);
      pivot.add(disc);

      // 7. Brembo 6-Piston Caliper (Fluorescent Race Yellow)
      const caliperGeo = new THREE.BoxGeometry(0.075, 0.14, 0.20);
      const caliperMat = new THREE.MeshStandardMaterial({
        color: 0xeab308,
        roughness: 0.24,
        metalness: 0.55,
      });
      const caliper = new THREE.Mesh(caliperGeo, caliperMat);
      caliper.position.set(wp.isRight ? -0.05 : 0.05, 0.06, 0.06);
      pivot.add(caliper);

      // 8. Titanium Axle Spindle
      const spindleGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.22, 10);
      spindleGeo.rotateZ(Math.PI / 2);
      const spindle = new THREE.Mesh(spindleGeo, materials.mechanicalMetalMat);
      spindle.position.set(wp.isRight ? 0.04 : -0.04, 0, 0);
      pivot.add(spindle);

      pivot.add(wheelRotGroup);
      parentGroup.add(pivot);

      this.wheelMeshes.push(wheelRotGroup);
      this.wheelPivots.push(pivot);
      if (wp.isFront) {
        this.wheelPivotsFront.push(pivot);
      }
    });
  }

  private createSpokeGeometry(
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

  public setWheelOffset(wheelIdx: number, offset: number): void {
    if (this.wheelMeshes[wheelIdx]) {
      const isRight = wheelIdx === 1 || wheelIdx === 3;
      this.wheelMeshes[wheelIdx].position.x = offset * (isRight ? 1 : -1);
    }
  }

  public setWheelVisible(wheelIdx: number, visible: boolean): void {
    if (this.wheelMeshes[wheelIdx]) {
      this.wheelMeshes[wheelIdx].visible = visible;
    }
  }

  public setAllWheelsVisible(visible: boolean = true): void {
    for (let i = 0; i < 4; i++) {
      if (this.wheelMeshes[i]) {
        this.wheelMeshes[i].visible = visible;
      }
    }
  }

  public resetWheelOffsets(): void {
    for (let i = 0; i < 4; i++) {
      if (this.wheelMeshes[i]) {
        this.wheelMeshes[i].position.x = 0;
        this.wheelMeshes[i].scale.set(1.0, 1.0, 1.0);
      }
      this.currentWheelCompression[i] = 0;
      if (this.wheelPivots[i] && this.wheelPivots[i].userData?.baseY !== undefined) {
        this.wheelPivots[i].position.y = this.wheelPivots[i].userData.baseY;
        this.wheelPivots[i].rotation.z = 0;
      }
    }
  }

  public setTireCompoundVisuals(compound: TireCompoundType): void {
    const config = TIRE_COMPOUNDS[compound] || TIRE_COMPOUNDS.soft;
    const colorHexStr = `#${config.stripeColorHex.toString(16).padStart(6, '0')}`;
    this.currentTireCompoundColor = colorHexStr;
    const newSidewallTex = CarLiveryFactory.createTireSidewallTexture(colorHexStr);
    const newBlurTex = CarLiveryFactory.createWheelRadialBlurTexture(colorHexStr);
    this.tireStripeMaterials.forEach((mat) => {
      mat.map = newSidewallTex;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
    });
    this.wheelBlurMaterials.forEach((mat) => {
      mat.map = newBlurTex;
      mat.needsUpdate = true;
    });
  }

  public setBrakeDiscThermalGlow(glowFactor: number): void {
    const f = Math.max(0, Math.min(1.0, glowFactor));
    this.brakeDiscs.forEach((disc) => {
      const mat = disc.material as THREE.MeshStandardMaterial;
      if (mat) {
        if (f > 0.01) {
          mat.emissive.setRGB(0.95 * f, 0.22 * f * f, 0.03 * f * f);
          mat.emissiveIntensity = f * 3.5;
        } else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      }
    });
  }

  public setCenterlockNutSpin(wheelIdx: number, angle: number): void {
    if (this.centerlockNuts[wheelIdx]) {
      this.centerlockNuts[wheelIdx].rotation.x = angle;
    }
  }

  public getWheelHubWorldPos(wheelIdx: number, target: THREE.Vector3): THREE.Vector3 {
    if (this.wheelPivots[wheelIdx]) {
      this.wheelPivots[wheelIdx].getWorldPosition(target);
      return target;
    }
    if (this.wheelMeshes[wheelIdx]) {
      this.wheelMeshes[wheelIdx].getWorldPosition(target);
      return target;
    }
    return target.set(0, 0, 0);
  }

  public getFourWheelWorldPositions(
    wFL: THREE.Vector3,
    wFR: THREE.Vector3,
    wRL: THREE.Vector3,
    wRR: THREE.Vector3,
    groupPos: THREE.Vector3
  ): void {
    if (this.wheelPivots.length >= 4) {
      this.wheelPivots[0].getWorldPosition(wFL);
      this.wheelPivots[1].getWorldPosition(wFR);
      this.wheelPivots[2].getWorldPosition(wRL);
      this.wheelPivots[3].getWorldPosition(wRR);
    } else {
      wFL.set(groupPos.x - 0.92, groupPos.y + 0.33, groupPos.z + 1.35);
      wFR.set(groupPos.x + 0.92, groupPos.y + 0.33, groupPos.z + 1.35);
      wRL.set(groupPos.x - 0.96, groupPos.y + 0.35, groupPos.z - 1.35);
      wRR.set(groupPos.x + 0.96, groupPos.y + 0.35, groupPos.z - 1.35);
    }
  }

  public getSingleWheelWorldPosition(wheelIdx: number, out: THREE.Vector3, groupPos: THREE.Vector3): void {
    if (this.wheelPivots.length > wheelIdx && this.wheelPivots[wheelIdx]) {
      this.wheelPivots[wheelIdx].getWorldPosition(out);
    } else {
      const xSign = (wheelIdx % 2 === 0) ? -1 : 1;
      const zOffset = wheelIdx < 2 ? 1.35 : -1.35;
      out.set(groupPos.x + xSign * 0.94, groupPos.y + 0.34, groupPos.z + zOffset);
    }
  }

  public getSpindleWorldTransform(
    wheelIdx: number,
    outPos: THREE.Vector3,
    outAxleDir: THREE.Vector3,
    outQuat: THREE.Quaternion
  ): void {
    if (this.wheelPivots[wheelIdx]) {
      this.wheelPivots[wheelIdx].getWorldPosition(outPos);
      this.wheelPivots[wheelIdx].getWorldQuaternion(outQuat);
      const isRight = wheelIdx === 1 || wheelIdx === 3;
      outAxleDir.set(isRight ? 1 : -1, 0, 0).applyQuaternion(outQuat).normalize();
    } else {
      outPos.set(0, 0, 0);
      outAxleDir.set(1, 0, 0);
      outQuat.identity();
    }
  }

  public update(
    steerAngle: number,
    wheelRotations: number[],
    brake: number,
    speedKmh: number,
    damage: DamageState,
    suspensionCompression?: number[],
    isPunctured?: boolean[],
    tireWear?: number[],
    dt: number = 0.016
  ): void {
    // 1. Front Wheels Ackermann Steering Geometry
    if (this.wheelPivotsFront[0] && this.wheelPivotsFront[1]) {
      if (steerAngle > 0) {
        this.wheelPivotsFront[0].rotation.y = steerAngle * 1.08;
        this.wheelPivotsFront[1].rotation.y = steerAngle * 0.92;
      } else if (steerAngle < 0) {
        this.wheelPivotsFront[0].rotation.y = steerAngle * 0.92;
        this.wheelPivotsFront[1].rotation.y = steerAngle * 1.08;
      } else {
        this.wheelPivotsFront[0].rotation.y = 0;
        this.wheelPivotsFront[1].rotation.y = 0;
      }
    }

    // 2. Dynamic Suspension Travel, Wheel Rolling, Radial Motion Blur & Puncture Deflation
    const absSpeed = Math.abs(speedKmh);
    const blurTarget = THREE.MathUtils.clamp((absSpeed - 24.0) / 48.0, 0.0, 0.96);
    this.currentBlurOpacity += (blurTarget - this.currentBlurOpacity) * Math.min(1.0, 20.0 * dt);
    const blurOpacity = this.currentBlurOpacity;
    const spokeOpacity = THREE.MathUtils.clamp(1.0 - blurOpacity * 0.88, 0.0, 1.0);
    const sidewallOpacity = THREE.MathUtils.clamp(1.0 - blurOpacity * 0.82, 0.0, 1.0);

    for (let i = 0; i < 4; i++) {
      const punctured = Boolean(isPunctured && isPunctured[i]);
      const wear = (tireWear && tireWear[i] !== undefined) ? tireWear[i] : 0;

      if (this.wheelPivots[i] && this.wheelPivots[i].userData?.baseY !== undefined) {
        const targetComp = (suspensionCompression && suspensionCompression[i] !== undefined)
          ? suspensionCompression[i]
          : 0;

        this.currentWheelCompression[i] += (targetComp - this.currentWheelCompression[i]) * Math.min(1.0, 24.0 * dt);
        const comp = this.currentWheelCompression[i];

        const punctureDrop = punctured ? -0.075 : 0;
        this.wheelPivots[i].position.y = this.wheelPivots[i].userData.baseY + comp + punctureDrop;

        let brokenCamber = 0;
        if (i === 0) brokenCamber = damage.suspensionCamberFL || 0;
        else if (i === 1) brokenCamber = -(damage.suspensionCamberFR || 0);
        else if (i === 2) brokenCamber = damage.suspensionCamberRL || 0;
        else if (i === 3) brokenCamber = -(damage.suspensionCamberRR || 0);

        const brokenWobble = (brokenCamber !== 0 && absSpeed > 3.0)
          ? Math.sin(wheelRotations[i] * 2.0) * (Math.abs(brokenCamber) * 0.40)
          : 0;

        if (punctured && absSpeed > 2) {
          const flapFreq = wheelRotations[i] * 2.0;
          this.wheelPivots[i].rotation.z = (i % 2 === 0 ? -0.09 : 0.09) + Math.sin(flapFreq) * 0.04 + brokenCamber + brokenWobble;
        } else {
          this.wheelPivots[i].rotation.z = (punctured ? (i % 2 === 0 ? -0.08 : 0.08) : 0) + brokenCamber + brokenWobble;
        }

        if (i < 2 && this.wheelPivotsFront[i] && brokenCamber !== 0) {
          const brokenToe = (i === 0 ? -1 : 1) * Math.abs(brokenCamber) * 0.45;
          this.wheelPivotsFront[i].rotation.y += brokenToe;
        }
      }

      // Wheel Forward Roll
      if (this.wheelMeshes[i]) {
        this.wheelMeshes[i].rotation.x = wheelRotations[i];

        if (punctured) {
          const flatPulse = 0.76 + Math.sin(wheelRotations[i] * 2.0) * 0.04;
          this.wheelMeshes[i].scale.set(1.06, flatPulse, 1.06);
        } else {
          this.wheelMeshes[i].scale.set(1.0, 1.0, 1.0);
        }
      }

      // Radial Motion Blur & Spokes Cross-Fade
      if (this.spokeMaterials[i]) {
        this.spokeMaterials[i].opacity = spokeOpacity;
      }
      if (this.spokeMeshes[i]) {
        this.spokeMeshes[i].visible = spokeOpacity > 0.04;
      }
      if (this.tireStripeMaterials[i]) {
        this.tireStripeMaterials[i].opacity = sidewallOpacity;
      }
      if (this.wheelBlurMaterials[i]) {
        this.wheelBlurMaterials[i].opacity = blurOpacity;
      }
      if (this.wheelBlurMeshes[i]) {
        this.wheelBlurMeshes[i].visible = blurOpacity > 0.03;
      }

      // Thermodynamic Tire Temperature Evolution
      const targetTemp = punctured ? 0.0 : THREE.MathUtils.clamp((absSpeed / 95.0) * 0.70 + (brake > 0.20 ? 0.30 : 0.0), 0.0, 1.0);
      const tempRate = targetTemp > this.currentTireTemp[i] ? 1.8 : 0.7;
      this.currentTireTemp[i] += (targetTemp - this.currentTireTemp[i]) * Math.min(1.0, tempRate * dt);
      const thermalFactor = this.currentTireTemp[i];

      // Dynamic Rubber Thermal PBR & Wear
      if (this.tireMeshList[i]) {
        const mat = this.tireMeshList[i].material as THREE.MeshStandardMaterial;
        if (punctured) {
          const pRate = Math.min(1.0, 6.0 * dt);
          mat.roughness = THREE.MathUtils.lerp(mat.roughness, 0.96, pRate);
          mat.metalness = THREE.MathUtils.lerp(mat.metalness, 0.02, pRate);
          mat.color.r = THREE.MathUtils.lerp(mat.color.r, 0.018, pRate);
          mat.color.g = THREE.MathUtils.lerp(mat.color.g, 0.019, pRate);
          mat.color.b = THREE.MathUtils.lerp(mat.color.b, 0.022, pRate);
        } else {
          const wearFactor = THREE.MathUtils.clamp((wear - 45.0) / 50.0, 0.0, 1.0);
          let targetR = THREE.MathUtils.lerp(0.024, 0.010, thermalFactor);
          let targetG = THREE.MathUtils.lerp(0.026, 0.012, thermalFactor);
          let targetB = THREE.MathUtils.lerp(0.030, 0.016, thermalFactor);

          if (wearFactor > 0.01) {
            targetR = THREE.MathUtils.lerp(targetR, 0.042, wearFactor);
            targetG = THREE.MathUtils.lerp(targetG, 0.044, wearFactor);
            targetB = THREE.MathUtils.lerp(targetB, 0.052, wearFactor);
          }

          const targetRoughness = THREE.MathUtils.lerp(
            THREE.MathUtils.lerp(0.65, 0.22, thermalFactor),
            0.88,
            wearFactor
          );
          const targetMetalness = THREE.MathUtils.lerp(
            THREE.MathUtils.lerp(0.06, 0.28, thermalFactor),
            0.02,
            wearFactor
          );

          const lerpRate = Math.min(1.0, 5.0 * dt);
          const dR = targetRoughness - mat.roughness;
          if (Math.abs(dR) > 0.002) mat.roughness += dR * lerpRate;
          const dM = targetMetalness - mat.metalness;
          if (Math.abs(dM) > 0.002) mat.metalness += dM * lerpRate;
          const dCr = targetR - mat.color.r;
          if (Math.abs(dCr) > 0.002) {
            mat.color.r += dCr * lerpRate;
            mat.color.g += (targetG - mat.color.g) * lerpRate;
            mat.color.b += (targetB - mat.color.b) * lerpRate;
          }
        }
      }
    }

    // 3. Thermodynamic Carbon-Ceramic Brake Disc Thermal Glow
    const isBrakingHard = brake > 0.15 && speedKmh > 20;
    const targetBrakeHeat = isBrakingHard ? Math.min(1.0, (brake * speedKmh) / 105.0) : 0;
    if (targetBrakeHeat > this.currentBrakeTemp) {
      this.currentBrakeTemp += (targetBrakeHeat - this.currentBrakeTemp) * Math.min(1.0, 5.5 * dt);
    } else {
      const aeroCoolingRate = 0.45 + (speedKmh / 160.0) * 0.85;
      this.currentBrakeTemp = Math.max(0, this.currentBrakeTemp - this.currentBrakeTemp * Math.min(1.0, aeroCoolingRate * dt));
    }

    const brakeTemp = this.currentBrakeTemp;
    if (Math.abs(brakeTemp - this.lastBrakeIntensity) > 0.015 || (brakeTemp <= 0.01 && this.lastBrakeIntensity > 0)) {
      this.lastBrakeIntensity = brakeTemp;
      const mat = this.materialsRef?.brakeDiscMaterial;
      if (mat) {
        if (brakeTemp > 0.02) {
          const r = Math.min(1.0, brakeTemp * 1.35);
          const g = Math.max(0.0, Math.pow(brakeTemp, 2.2) * 0.72);
          const b = Math.max(0.0, Math.pow(brakeTemp, 3.5) * 0.28);
          mat.emissive.setRGB(r, g, b);
          mat.emissiveIntensity = brakeTemp * 4.2;
        } else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      }
    }
  }

  public dispose(): void {
    this.wheelBlurMaterials.forEach((m) => m.dispose());
    this.tireStripeMaterials.forEach((m) => m.dispose());
    this.spokeMaterials.forEach((m) => m.dispose());
  }
}
