/**
 * CarEffectsSystem.ts - DRS Hydraulic Kinematics, Exhaust Flames & Optical FX
 * Manages active DRS aerodynamic flap rotation and hydraulic lift,
 * underbody baked contact shadow plate, dual titanium exhaust backfire flame shader,
 * and FIA rain/telemetry optical strobe lights.
 */

import * as THREE from 'three';
import { CarBodyBuilder } from './CarBodyBuilder';
import { CarMaterials } from './CarMaterials';

export class CarEffectsSystem {
  // DRS Hydraulic Articulation State
  public currentDrsAngle: number = 0.12;

  // Contact Shadow
  public contactShadowMesh?: THREE.Mesh;
  public underbodyShadowTexture?: THREE.CanvasTexture;
  public underbodyShadowMaterial?: THREE.MeshBasicMaterial;

  // Exhaust System & Flame Shader
  public exhaustTips: THREE.Group[] = [];
  public exhaustFlameMaterials: THREE.ShaderMaterial[] = [];
  public exhaustFlameMeshes: THREE.Mesh[] = [];
  public exhaustPointLight?: THREE.PointLight;
  public backfireState = { active: false, phaseTime: 0, totalDuration: 0.17, isHighRpm: false };
  public flameGlobalTime = 0;

  // Telemetry & Lights
  private lastBrakeLit: boolean = false;
  private currentSteerAnim: number = 0;
  private lastActiveLeds: number = -1;

  public buildLights(parentGroup: THREE.Group, materials: CarMaterials): void {
    const rainLightGeo = new THREE.BoxGeometry(0.08, 0.05, 0.03);
    const rainLightMesh = new THREE.Mesh(rainLightGeo, materials.fiaRainLight);
    rainLightMesh.position.set(0, 0.22, -1.94);
    parentGroup.add(rainLightMesh);

    [-0.18, 0.18].forEach((sideX) => {
      const ledGeo = new THREE.BoxGeometry(0.06, 0.016, 0.18);
      const ledMesh = new THREE.Mesh(ledGeo, materials.headlightGlowMat);
      ledMesh.position.set(sideX, 0.36, 1.35);
      ledMesh.rotation.y = sideX > 0 ? -0.15 : 0.15;
      parentGroup.add(ledMesh);
    });
  }

  public buildExhausts(parentGroup: THREE.Group, materials: CarMaterials, isAi: boolean): void {
    const exhaustPositions = [
      { x: -0.065, y: 0.44, z: -1.48 },
      { x: 0.065, y: 0.44, z: -1.48 },
    ];

    this.exhaustTips = [];
    this.exhaustFlameMaterials = [];
    this.exhaustFlameMeshes = [];

    exhaustPositions.forEach((pos) => {
      const tipGroup = new THREE.Group();
      tipGroup.position.set(pos.x, pos.y, pos.z);

      const pipeGeo = new THREE.CylinderGeometry(0.038, 0.042, 0.16, 14, 1, true);
      pipeGeo.rotateX(Math.PI / 2);
      const pipeMesh = new THREE.Mesh(pipeGeo, materials.exhaustGlowMat);
      tipGroup.add(pipeMesh);

      const flameGeo = new THREE.ConeGeometry(0.055, 0.38, 10, 4, true);
      flameGeo.rotateX(-Math.PI / 2);
      flameGeo.translate(0, 0, -0.19);

      const flameMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 0 },
          uColorCore: { value: new THREE.Color(0x60a5fa) },
          uColorOuter: { value: new THREE.Color(0xf97316) },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormal;
          void main() {
            vUv = uv;
            vNormal = normal;
            vec3 pos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uIntensity;
          uniform vec3 uColorCore;
          uniform vec3 uColorOuter;
          varying vec2 vUv;
          void main() {
            if (uIntensity < 0.01) discard;
            float pulse = sin(uTime * 45.0 + vUv.y * 12.0) * 0.15 + 0.85;
            float alpha = (1.0 - vUv.y) * uIntensity * pulse;
            vec3 col = mix(uColorCore, uColorOuter, smoothstep(0.2, 0.9, vUv.y));
            gl_FragColor = vec4(col * 2.5, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const flameMesh = new THREE.Mesh(flameGeo, flameMat);
      flameMesh.visible = false;
      tipGroup.add(flameMesh);

      this.exhaustFlameMaterials.push(flameMat);
      this.exhaustFlameMeshes.push(flameMesh);
      this.exhaustTips.push(tipGroup);
      parentGroup.add(tipGroup);
    });

    if (!isAi) {
      this.exhaustPointLight = new THREE.PointLight(0xff6600, 0, 6, 2);
      this.exhaustPointLight.position.set(0, 0.44, -1.65);
      parentGroup.add(this.exhaustPointLight);
    }
  }

  public triggerBackfire(isHighRpm: boolean = false): void {
    this.backfireState.active = true;
    this.backfireState.phaseTime = 0;
    this.backfireState.isHighRpm = isHighRpm;
    this.backfireState.totalDuration = isHighRpm ? 0.22 : 0.16;

    this.exhaustFlameMeshes.forEach((m) => {
      m.visible = true;
    });
  }

  public setDRS(body: CarBodyBuilder, isOpen: boolean, dt: number = 0.016, speedKmh: number = 0): void {
    if (!body.drsPivotGroup) return;

    const CLOSED_ANGLE = 0.12;
    const OPEN_ANGLE = -0.72;
    const targetAngle = isOpen ? OPEN_ANGLE : CLOSED_ANGLE;

    const transitionRate = isOpen ? 22.0 : 36.0;
    this.currentDrsAngle += (targetAngle - this.currentDrsAngle) * Math.min(1.0, transitionRate * dt);

    const openFactor = THREE.MathUtils.clamp(
      (CLOSED_ANGLE - this.currentDrsAngle) / (CLOSED_ANGLE - OPEN_ANGLE),
      0.0,
      1.0
    );

    const flutter = (isOpen && speedKmh > 120.0)
      ? Math.sin(performance.now() * 0.045) * 0.0022 * Math.min(1.0, speedKmh / 240.0)
      : 0.0;

    const liftY = openFactor * 0.18;
    const shiftZ = openFactor * 0.04;
    body.drsPivotGroup.position.set(0, 0.88 + liftY, -1.86 + shiftZ);
    body.drsPivotGroup.rotation.x = this.currentDrsAngle + flutter;

    if (body.drsPistonMesh) {
      body.drsPistonMesh.scale.z = 1.0 + openFactor * 4.2;
      body.drsPistonMesh.position.z = -0.04 - openFactor * 0.085;
      body.drsPistonMesh.position.y = 0.028 + openFactor * 0.085;
      body.drsPistonMesh.rotation.x = openFactor * 0.45;
    }

    const rockerAngle = openFactor * 0.75;
    if (body.drsRockerArmLeft) body.drsRockerArmLeft.rotation.x = rockerAngle;
    if (body.drsRockerArmRight) body.drsRockerArmRight.rotation.x = rockerAngle;

    if (body.drsLedMesh) {
      const mat = body.drsLedMesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        if (openFactor > 0.06) {
          mat.color.setHex(0x10b981);
          mat.emissive.setHex(0x10b981);
          mat.emissiveIntensity = 4.2 + Math.sin(performance.now() * 0.03) * 0.8;
          if (body.drsPointLight) {
            body.drsPointLight.intensity = openFactor * 3.5;
          }
        } else {
          mat.color.setHex(0x1e293b);
          mat.emissive.setHex(0x0f172a);
          mat.emissiveIntensity = 0.15;
          if (body.drsPointLight) {
            body.drsPointLight.intensity = 0.0;
          }
        }
      }
    }
  }

  public getUnderbodyPlankWorldPosition(
    groupPos: THREE.Vector3,
    groupYaw: number,
    outPos: THREE.Vector3,
    rearDir: THREE.Vector3
  ): void {
    const sinY = Math.sin(groupYaw);
    const cosY = Math.cos(groupYaw);
    outPos.set(
      groupPos.x - sinY * 0.65,
      Math.max(0.008, groupPos.y + 0.012),
      groupPos.z - cosY * 0.65
    );
    rearDir.set(-sinY, 0, -cosY);
  }

  public getExhaustWorldPositions(
    groupPos: THREE.Vector3,
    groupYaw: number,
    leftPipe: THREE.Vector3,
    rightPipe: THREE.Vector3,
    rearDir: THREE.Vector3
  ): void {
    const cosY = Math.cos(groupYaw);
    const sinY = Math.sin(groupYaw);

    const pipeZ = -1.48;
    const pipeY = 0.44;
    const pipeDist = 0.065;

    leftPipe.set(
      groupPos.x - cosY * pipeDist + sinY * pipeZ,
      groupPos.y + pipeY,
      groupPos.z + sinY * pipeDist + cosY * pipeZ
    );

    rightPipe.set(
      groupPos.x + cosY * pipeDist + sinY * pipeZ,
      groupPos.y + pipeY,
      groupPos.z - sinY * pipeDist + cosY * pipeZ
    );

    rearDir.set(-sinY, 0, -cosY);
  }

  public buildUnderbodyContactShadow(rootGroup: THREE.Group): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // 1. Broad soft ambient occlusion envelope
    const ambientGrad = ctx.createRadialGradient(512, 512, 100, 512, 512, 480);
    ambientGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.70)');
    ambientGrad.addColorStop(0.40, 'rgba(0, 0, 0, 0.45)');
    ambientGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0.18)');
    ambientGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    // 2. Underfloor plank & venturi aero tunnel deep ground occlusion
    const underfloorGrad = ctx.createLinearGradient(0, 180, 0, 730);
    underfloorGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.90)');
    underfloorGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.96)');
    underfloorGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.96)');
    underfloorGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.88)');
    ctx.fillStyle = underfloorGrad;
    ctx.beginPath();
    ctx.roundRect(240, 180, 544, 550, 48);
    ctx.fill();

    // 3. Central keel plank maximum umbra
    ctx.fillStyle = 'rgba(0, 0, 0, 0.98)';
    ctx.beginPath();
    ctx.roundRect(360, 200, 304, 520, 24);
    ctx.fill();

    // 4. Front wing wash
    const fwGrad = ctx.createLinearGradient(0, 740, 0, 960);
    fwGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.85)');
    fwGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.65)');
    fwGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = fwGrad;
    ctx.beginPath();
    ctx.moveTo(140, 760);
    ctx.lineTo(884, 760);
    ctx.lineTo(840, 950);
    ctx.lineTo(184, 950);
    ctx.closePath();
    ctx.fill();

    // 5. Rear wing wash
    const rwGrad = ctx.createLinearGradient(0, 200, 0, 60);
    rwGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.88)');
    rwGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.55)');
    rwGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = rwGrad;
    ctx.beginPath();
    ctx.moveTo(180, 200);
    ctx.lineTo(844, 200);
    ctx.lineTo(820, 70);
    ctx.lineTo(204, 70);
    ctx.closePath();
    ctx.fill();

    // 6. 4 Tire Ground Contact Patches
    const tires = [
      { cx: 176, cy: 759, rx: 56, ry: 42, blur: 28 },
      { cx: 848, cy: 759, rx: 56, ry: 42, blur: 28 },
      { cx: 161, cy: 265, rx: 72, ry: 50, blur: 32 },
      { cx: 863, cy: 265, rx: 72, ry: 50, blur: 32 },
    ];

    tires.forEach((t) => {
      const haloGrad = ctx.createRadialGradient(t.cx, t.cy, 8, t.cx, t.cy, t.rx + t.blur);
      haloGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.95)');
      haloGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.70)');
      haloGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.ellipse(t.cx, t.cy, t.rx + t.blur, t.ry + t.blur, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.99)';
      ctx.beginPath();
      ctx.ellipse(t.cx, t.cy, t.rx, t.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    this.underbodyShadowTexture = tex;

    const geo = new THREE.PlaneGeometry(2.8, 5.6);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -1.0,
    });
    this.underbodyShadowMaterial = mat;

    const contactMesh = new THREE.Mesh(geo, mat);
    contactMesh.position.set(0, 0.008, 0.0);
    contactMesh.renderOrder = 4;
    rootGroup.add(contactMesh);
    this.contactShadowMesh = contactMesh;
  }

  public update(
    body: CarBodyBuilder,
    materials: CarMaterials,
    steerAngle: number,
    brake: number,
    speedKmh: number,
    throttle: number,
    rpm: number,
    isBackfiring: boolean,
    dt: number
  ): void {
    // 1. FIA Rear LED Safety Cluster & ERS Energy Recovery Strobe
    const isBraking = brake > 0.10;
    const isHarvesting = !isBraking && (speedKmh > 10 && (speedKmh < 85 || throttle < 0.25));
    const strobePhase = Math.floor(this.flameGlobalTime * 8) % 2 === 0;

    let targetLightIntensity = 0.5;
    let targetLightColor = 0xaa0510;

    if (isBraking) {
      targetLightIntensity = 4.2;
      targetLightColor = 0xff0020;
    } else if (isHarvesting && strobePhase) {
      targetLightIntensity = 3.6;
      targetLightColor = 0xff2200;
    } else if (isHarvesting) {
      targetLightIntensity = 0.15;
      targetLightColor = 0x330005;
    }

    if (this.lastBrakeLit !== (isBraking || (isHarvesting && strobePhase))) {
      this.lastBrakeLit = isBraking || (isHarvesting && strobePhase);
      materials.taillightMaterial.emissiveIntensity = targetLightIntensity;
      materials.taillightMaterial.color.setHex(targetLightColor);
      materials.taillightMaterial.emissive.setHex(targetLightColor);
    }

    // 2. Inconel Exhaust Thermal Glow & Backfire Flames
    const targetGlow = Math.min(2.4, (speedKmh / 210) * 2.0);
    materials.exhaustGlowMat.emissiveIntensity = THREE.MathUtils.lerp(
      materials.exhaustGlowMat.emissiveIntensity,
      targetGlow,
      0.08
    );

    if (isBackfiring && !this.backfireState.active) {
      this.triggerBackfire(false);
    }

    this.flameGlobalTime += dt;
    if (this.backfireState.active) {
      this.backfireState.phaseTime += dt;
      const progress = this.backfireState.phaseTime / this.backfireState.totalDuration;

      if (progress >= 1.0) {
        this.backfireState.active = false;
        this.exhaustFlameMeshes.forEach((m) => (m.visible = false));
        if (this.exhaustPointLight) this.exhaustPointLight.intensity = 0;
      } else {
        const flameIntensity = Math.sin(progress * Math.PI);
        this.exhaustFlameMaterials.forEach((mat) => {
          mat.uniforms.uTime.value = this.flameGlobalTime;
          mat.uniforms.uIntensity.value = flameIntensity;
        });
        if (this.exhaustPointLight) this.exhaustPointLight.intensity = flameIntensity * 4.5;
      }
    }

    // 3. F1 Steering Wheel & Driver Helmet Animation
    const targetSteerAngle = steerAngle * 2.8;
    this.currentSteerAnim += (targetSteerAngle - this.currentSteerAnim) * 0.35;

    if (body.steeringWheel) {
      body.steeringWheel.rotation.z = this.currentSteerAnim;
    }

    if (body.driverHelmet) {
      const helmetTiltTargetZ = -steerAngle * 0.14;
      const helmetYawTargetY = steerAngle * 0.20;
      const helmetPitchTargetX = (brake > 0.15 ? 0.055 : 0) - (throttle > 0.8 && speedKmh < 120 ? 0.025 : 0);
      body.driverHelmet.rotation.z += (helmetTiltTargetZ - body.driverHelmet.rotation.z) * 0.25;
      body.driverHelmet.rotation.y += (helmetYawTargetY - body.driverHelmet.rotation.y) * 0.25;
      body.driverHelmet.rotation.x += (helmetPitchTargetX - body.driverHelmet.rotation.x) * 0.22;
    }

    // 4. Shift Rev LEDs
    if (body.revLedMeshes.length > 0) {
      const rpmRatio = Math.min(1.0, Math.max(0, (rpm - 2200) / 7000));
      const totalLeds = body.revLedMeshes.length;
      const activeLeds = rpmRatio > 0.05 ? Math.floor(rpmRatio * totalLeds) : -1;
      if (activeLeds !== this.lastActiveLeds) {
        this.lastActiveLeds = activeLeds;
        for (let i = 0; i < totalLeds; i++) {
          const mat = body.revLedMeshes[i].material as THREE.MeshBasicMaterial;
          if (i <= activeLeds && activeLeds >= 0) {
            const color = i < 2 ? 0x22c55e : i < 5 ? 0xeab308 : 0xef4444;
            mat.color.setHex(color);
          } else {
            mat.color.setHex(0x18181b);
          }
        }
      }
    }
  }

  public dispose(): void {
    if (this.underbodyShadowTexture) {
      this.underbodyShadowTexture.dispose();
      this.underbodyShadowTexture = undefined;
    }
    if (this.underbodyShadowMaterial) {
      this.underbodyShadowMaterial.dispose();
      this.underbodyShadowMaterial = undefined;
    }
    this.exhaustFlameMaterials.forEach((m) => m.dispose());
  }
}
