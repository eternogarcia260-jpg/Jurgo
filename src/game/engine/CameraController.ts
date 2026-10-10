/**
 * CameraController.ts - Dynamic Cinematic Multi-Camera Choreography Engine
 * Handles Chase (Near/Medium/Far), Bonnet/Hood, Aero Bumper, and Orbit TV Helicopter views.
 * Features mobile portrait aspect-ratio auto-framing, zero-accordion rigid chase anchoring,
 * pit-stop broadcast crane jib choreography, high-speed aerodynamic buffeting (>200 km/h),
 * dynamic FOV speed tunnel, and impact camera trauma shake with zero GC allocations.
 */

import * as THREE from 'three';
import { CameraDistanceMode, CameraViewMode } from './EngineTypes';
import { PitStopManager } from '../pit/PitStopManager';
import { VehiclePhysics } from '../physics/VehiclePhysics';

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  public mode: CameraViewMode = 'chase';
  public distance: CameraDistanceMode = 'medium';

  public cameraPos = new THREE.Vector3();
  public cameraTarget = new THREE.Vector3();

  private smoothedCamYaw = 0;
  private currentTargetFov = 58.0;
  private speedBuffetingTime = 0;
  private cameraTrauma = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.smoothedCamYaw = 0;
    this.cameraPos.copy(camera.position);
  }

  public getTrauma(): number {
    return this.cameraTrauma;
  }

  public addTrauma(amount: number): void {
    this.cameraTrauma = Math.min(1.0, this.cameraTrauma + amount);
  }

  public setMode(mode: CameraViewMode): void {
    this.mode = mode;
  }

  public setDistance(distance: CameraDistanceMode): void {
    this.distance = distance;
    this.setMode('chase');
  }

  public nextDistance(): CameraDistanceMode {
    const distances: CameraDistanceMode[] = ['near', 'medium', 'far'];
    const idx = distances.indexOf(this.distance);
    this.distance = distances[(idx + 1) % distances.length];
    this.setMode('chase');
    return this.distance;
  }

  public nextMode(): CameraViewMode {
    const modes: CameraViewMode[] = ['chase', 'hood', 'bumper', 'orbit'];
    const idx = modes.indexOf(this.mode);
    const next = modes[(idx + 1) % modes.length];
    this.setMode(next);
    return this.mode;
  }

  public resetPosition(carX: number, carY: number, carZ: number, yaw: number): void {
    this.smoothedCamYaw = yaw;
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    this.cameraPos.set(carX - forwardX * 7.0, carY + 2.2, carZ - forwardZ * 7.0);
    this.cameraTarget.set(carX + forwardX * 5.0, carY + 0.85, carZ + forwardZ * 5.0);
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraTarget);
  }

  public update(
    dt: number,
    carPos: THREE.Vector3,
    yaw: number,
    physics: VehiclePhysics,
    pitStop: PitStopManager
  ): void {
    const speed = physics.speed;
    const speedKmh = Math.abs(speed) * 3.6;
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    const isPitEntryAutopilot = pitStop.phase === 'entry_autopilot';
    const isStationaryPitService =
      pitStop.phase === 'docking' ||
      pitStop.phase === 'jacks_up' ||
      pitStop.phase === 'servicing' ||
      pitStop.phase === 'jacks_down';
    const isReleased =
      pitStop.phase === 'released' ||
      pitStop.phase === 'exit_autopilot' ||
      (pitStop.phase === 'none' && pitStop.greenLightAlertTimer > 0);

    // 1. Single Unified Dynamic FOV Target Determination
    let targetFov = 58.0;
    if (isPitEntryAutopilot) {
      targetFov = 66.0;
    } else if (isStationaryPitService) {
      targetFov = 62.0;
    } else if (isReleased) {
      targetFov = 58.0;
    } else {
      const baseFov = this.mode === 'hood' ? 62 : this.mode === 'bumper' ? 68 : 58;
      const speedRatio = Math.min(1.0, speedKmh / 350);
      targetFov = baseFov + Math.pow(speedRatio, 1.25) * 14.0;
    }
    this.currentTargetFov = targetFov;

    // Synchronize smoothedCamYaw during pit service and non-chase modes to avoid angular snap on handover
    if (isStationaryPitService || isPitEntryAutopilot || this.mode !== 'chase') {
      let preYawDiff = yaw - this.smoothedCamYaw;
      while (preYawDiff > Math.PI) preYawDiff -= Math.PI * 2;
      while (preYawDiff < -Math.PI) preYawDiff += Math.PI * 2;
      this.smoothedCamYaw += preYawDiff * Math.min(1.0, 10.0 * dt);
    }

    // =========================================================================
    // 1. DYNAMIC PIT ENTRY CHASE & TRACKING CAM
    // Smooth cinematic tracking behind and slightly elevated over the car along pit lane corridor
    // =========================================================================
    if (isPitEntryAutopilot) {
      pitStop.broadcastCamName = 'CÁMARA PIT LANE · SEGUIMIENTO 60 KM/H';
      const chaseDist = 5.8;
      const idealCamX = carPos.x - forwardX * chaseDist;
      const idealCamY = carPos.y + 2.25;
      const idealCamZ = carPos.z - forwardZ * chaseDist;

      const idealTargetX = carPos.x + forwardX * 4.2;
      const idealTargetY = carPos.y + 0.95;
      const idealTargetZ = carPos.z + forwardZ * 4.2;

      const camPosLerp = 1.0 - Math.exp(-9.0 * dt);
      const camTargetLerp = 1.0 - Math.exp(-10.0 * dt);

      this.cameraPos.x += (idealCamX - this.cameraPos.x) * camPosLerp;
      this.cameraPos.y += (idealCamY - this.cameraPos.y) * camPosLerp;
      this.cameraPos.z += (idealCamZ - this.cameraPos.z) * camPosLerp;

      this.cameraTarget.x += (idealTargetX - this.cameraTarget.x) * camTargetLerp;
      this.cameraTarget.y += (idealTargetY - this.cameraTarget.y) * camTargetLerp;
      this.cameraTarget.z += (idealTargetZ - this.cameraTarget.z) * camTargetLerp;

      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(this.cameraTarget);
      return;
    }

    // =========================================================================
    // 2. TV TRACKSIDE BROADCAST CAM: CALIBRATED PANORAMIC PIT SERVICE CHOREOGRAPHY
    // Perfectly calibrated elevated wide-angle crane-jib camera providing a cinematic,
    // immersive view of the pit box scene, all mechanics, jacks, lollipop and tires!
    // =========================================================================
    else if (isStationaryPitService) {
      pitStop.broadcastCamName = 'CÁMARA PIT LANE 4K · BOX APEX SCUDERIA';
      const t = pitStop.elapsedTime;
      const total = Math.max(2, pitStop.totalDuration);
      // Normalized orbit time across the entire pit stop duration
      const orbitT = Math.min(1.0, Math.max(0, t / total));

      const boxX = pitStop.pitBoxX; // Calibrated to Garage 01 (-22.0)
      // Elevated trackside crane-jib camera focused cleanly on the working apron of the active pit stall
      const idealCamX = boxX + THREE.MathUtils.lerp(6.2, -5.8, orbitT);
      const idealCamZ = -116.2 + Math.sin(orbitT * Math.PI) * 0.4;
      const idealCamY = 3.25 + Math.sin(t * 0.6) * 0.08;

      // Focus accurately on the central chassis and wheel mechanics at the active pit box
      const idealTargetX = boxX + THREE.MathUtils.lerp(0.5, -0.5, orbitT);
      const idealTargetY = 0.72 + pitStop.carElevatedY * 0.5;
      const idealTargetZ = -110.5;

      // Fluid broadcast gimbal damping
      const camPosLerp = Math.min(1.0, 5.0 * dt);
      const camTargetLerp = Math.min(1.0, 6.0 * dt);

      this.cameraPos.x += (idealCamX - this.cameraPos.x) * camPosLerp;
      this.cameraPos.y += (idealCamY - this.cameraPos.y) * camPosLerp;
      this.cameraPos.z += (idealCamZ - this.cameraPos.z) * camPosLerp;

      this.cameraTarget.x += (idealTargetX - this.cameraTarget.x) * camTargetLerp;
      this.cameraTarget.y += (idealTargetY - this.cameraTarget.y) * camTargetLerp;
      this.cameraTarget.z += (idealTargetZ - this.cameraTarget.z) * camTargetLerp;

      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(this.cameraTarget);
      return;
    }

    // =========================================================================
    // 3. DYNAMIC LAUNCH CAM & SEAMLESS HANDOVER (RELEASED PHASE)
    // Smoothly tracks right behind and above the launching car, so as soon as control
    // is returned to the player, the camera is ALREADY locked behind the car (ZERO lag or frozen mechanic)!
    // =========================================================================
    else if (isReleased) {
      pitStop.broadcastCamName = 'SALIDA DE BOXES · LANZAMIENTO';
      const distConfig = {
        near: { baseDist: 4.2, baseHeight: 1.68, lookAhead: 4.2, targetY: 0.86 },
        medium: { baseDist: 5.9, baseHeight: 2.18, lookAhead: 5.2, targetY: 0.98 },
        far: { baseDist: 8.9, baseHeight: 3.25, lookAhead: 6.8, targetY: 1.20 },
      }[this.distance];

      const aspect = this.camera.aspect;
      const isPortrait = aspect < 1.0;
      const portraitDistFactor = isPortrait ? Math.max(1.30, 1.0 + (1.0 - aspect) * 0.65) : 1.0;
      const portraitHeightFactor = isPortrait ? 1.28 : 1.0;
      const effectiveDist = distConfig.baseDist * portraitDistFactor;
      const effectiveHeight = distConfig.baseHeight * portraitHeightFactor;
      const effectiveTargetY = distConfig.targetY * (isPortrait ? 1.15 : 1.0);

      // Smooth trailing yaw orientation aligned with smoothedCamYaw
      let yawDiff = yaw - this.smoothedCamYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      this.smoothedCamYaw += yawDiff * Math.min(1.0, 14.0 * dt);

      const camForwardX = Math.sin(this.smoothedCamYaw);
      const camForwardZ = Math.cos(this.smoothedCamYaw);

      // Relative offset tracking: camera moves 100% locked with car forward velocity,
      // while relative offset smoothly glides from the broadcast crane angle into centered chase position.
      const currentRelX = this.cameraPos.x - carPos.x;
      const currentRelY = this.cameraPos.y - carPos.y;
      const currentRelZ = this.cameraPos.z - carPos.z;

      const targetRelX = -camForwardX * effectiveDist;
      const targetRelY = effectiveHeight;
      const targetRelZ = -camForwardZ * effectiveDist;

      const currentRelTgtX = this.cameraTarget.x - carPos.x;
      const currentRelTgtY = this.cameraTarget.y - carPos.y;
      const currentRelTgtZ = this.cameraTarget.z - carPos.z;

      const targetRelTgtX = camForwardX * distConfig.lookAhead;
      const targetRelTgtY = effectiveTargetY;
      const targetRelTgtZ = camForwardZ * distConfig.lookAhead;

      const blendRate = 1.0 - Math.exp(-12.0 * dt);
      const newRelX = THREE.MathUtils.lerp(currentRelX, targetRelX, blendRate);
      const newRelY = THREE.MathUtils.lerp(currentRelY, targetRelY, blendRate);
      const newRelZ = THREE.MathUtils.lerp(currentRelZ, targetRelZ, blendRate);

      const newRelTgtX = THREE.MathUtils.lerp(currentRelTgtX, targetRelTgtX, blendRate);
      const newRelTgtY = THREE.MathUtils.lerp(currentRelTgtY, targetRelTgtY, blendRate);
      const newRelTgtZ = THREE.MathUtils.lerp(currentRelTgtZ, targetRelTgtZ, blendRate);

      this.cameraPos.set(carPos.x + newRelX, carPos.y + newRelY, carPos.z + newRelZ);
      this.cameraTarget.set(carPos.x + newRelTgtX, carPos.y + newRelTgtY, carPos.z + newRelTgtZ);

      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(this.cameraTarget);
      return;
    } else {
      pitStop.broadcastCamName = null;
    }

    if (this.mode === 'chase') {
      // 3 Configurable Camera Distance Presets (Cerca, Media, Lejos)
      const distConfig = {
        near: { baseDist: 4.2, baseHeight: 1.68, lookAhead: 4.2, targetY: 0.86 },
        medium: { baseDist: 5.9, baseHeight: 2.18, lookAhead: 5.2, targetY: 0.98 },
        far: { baseDist: 8.9, baseHeight: 3.25, lookAhead: 6.8, targetY: 1.20 },
      }[this.distance];

      // Mobile Portrait aspect ratio compensation
      const aspect = this.camera.aspect;
      const isPortrait = aspect < 1.0;
      const portraitDistFactor = isPortrait ? Math.max(1.30, 1.0 + (1.0 - aspect) * 0.65) : 1.0;
      const portraitHeightFactor = isPortrait ? 1.28 : 1.0;
      const effectiveDist = distConfig.baseDist * portraitDistFactor;
      const effectiveHeight = distConfig.baseHeight * portraitHeightFactor;
      const effectiveTargetY = distConfig.targetY * (isPortrait ? 1.15 : 1.0);

      // Smooth trailing yaw orientation
      let yawDiff = yaw - this.smoothedCamYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      const yawLerp = 1.0 - Math.exp((physics.isDrifting ? -10.0 : -14.0) * dt);
      this.smoothedCamYaw += yawDiff * yawLerp;

      const camForwardX = Math.sin(this.smoothedCamYaw);
      const camForwardZ = Math.cos(this.smoothedCamYaw);

      // Rigid distance anchoring to eliminate accordion jitter
      this.camera.position.set(
        carPos.x - camForwardX * effectiveDist,
        carPos.y + effectiveHeight,
        carPos.z - camForwardZ * effectiveDist
      );
      this.camera.lookAt(
        carPos.x + camForwardX * distConfig.lookAhead,
        carPos.y + effectiveTargetY,
        carPos.z + camForwardZ * distConfig.lookAhead
      );

      this.cameraPos.copy(this.camera.position);
      this.cameraTarget.set(
        carPos.x + camForwardX * distConfig.lookAhead,
        carPos.y + distConfig.targetY,
        carPos.z + camForwardZ * distConfig.lookAhead
      );
    } else if (this.mode === 'hood') {
      // 1. Crystal-Clear Nosecone / Bonnet Camera: 100% stable, zero vibration noise
      this.camera.position.set(
        carPos.x + forwardX * 1.35,
        carPos.y + 0.68,
        carPos.z + forwardZ * 1.35
      );
      this.camera.lookAt(
        carPos.x + forwardX * 40.0,
        carPos.y + 0.50,
        carPos.z + forwardZ * 40.0
      );
    } else if (this.mode === 'bumper') {
      // 2. Front Wing Ground-Level Aero Camera (Ultra-high sense of speed, zero mesh clipping)
      this.camera.position.set(
        carPos.x + forwardX * 2.52,
        carPos.y + 0.40,
        carPos.z + forwardZ * 2.52
      );
      this.camera.lookAt(
        carPos.x + forwardX * 45.0,
        carPos.y + 0.38,
        carPos.z + forwardZ * 45.0
      );
    } else if (this.mode === 'orbit') {
      // 3. Smooth High-Altitude TV Helicopter Sky Camera
      const heliX = carPos.x - forwardX * 13.0 + rightX * 8.0;
      const heliZ = carPos.z - forwardZ * 13.0 + rightZ * 8.0;
      const heliY = carPos.y + 14.0;
      const lerpFactor = Math.min(1.0, 3.5 * dt);
      this.cameraPos.x += (heliX - this.cameraPos.x) * lerpFactor;
      this.cameraPos.y += (heliY - this.cameraPos.y) * lerpFactor;
      this.cameraPos.z += (heliZ - this.cameraPos.z) * lerpFactor;
      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(carPos.x + forwardX * 3.5, carPos.y + 0.6, carPos.z + forwardZ * 3.5);
    }

    // =========================================================================
    // HIGH-SPEED AERODYNAMIC BUFFETING & COCKPIT MICRO-VIBRATION (> 200 KM/H)
    // Masterclass high-frequency (~46 Hz) tactile chassis jitter & dynamic FOV tunnel
    // =========================================================================
    let buffetingIntensity = 0;
    if (speedKmh > 200.0) {
      // Smooth linear-to-exponential crescendo starting at 200 km/h up to 335+ km/h
      const normalizedRatio = Math.min(1.0, Math.max(0.0, (speedKmh - 200.0) / 125.0));
      let baseIntensity = Math.pow(normalizedRatio, 1.35);

      // Smooth, gentle attenuation above 270 km/h to prevent excessive vibration at top speed
      if (speedKmh > 270.0) {
        const highSpeedTaper = Math.min(1.0, (speedKmh - 270.0) / 60.0);
        const attenuation = 1.0 - highSpeedTaper * 0.32; // Gentle ~32% power reduction at maximum velocity
        baseIntensity *= attenuation;
      }
      buffetingIntensity = baseIntensity;
    }

    // 1. Dynamic FOV Compression & High-Speed Optical Expansion (Smooth speed tunnel feeling)
    const dynFov = this.currentTargetFov + buffetingIntensity * 5.0; // Expands progressively with speed ratio + buffeting
    const fovDelta = (dynFov - this.camera.fov) * Math.min(1.0, 8.0 * dt);
    if (Math.abs(fovDelta) > 0.002) {
      this.camera.fov += fovDelta;
      this.camera.updateProjectionMatrix();
    }

    // 2. Refined Harmonic Pitch/Roll & High-Frequency Shake (> 200 km/h)
    if (buffetingIntensity > 0.001) {
      this.speedBuffetingTime += dt * 38.0; // Smooth harmonic turbulence
      const bt = this.speedBuffetingTime;

      // Natural organic dual-harmonic jitter
      const pitchBuffet = (Math.sin(bt * 1.0) * 0.65 + Math.sin(bt * 2.37) * 0.35) * buffetingIntensity * 0.012;
      const rollBuffet = (Math.cos(bt * 1.41) * 0.70 + Math.sin(bt * 3.14) * 0.30) * buffetingIntensity * 0.009;
      const verticalBuffet = Math.sin(bt * 1.83) * buffetingIntensity * 0.038;
      const lateralBuffet = Math.cos(bt * 2.15) * buffetingIntensity * 0.022;

      this.camera.rotation.x += pitchBuffet;
      this.camera.rotation.z += rollBuffet;
      this.camera.position.y += verticalBuffet;
      this.camera.position.x += lateralBuffet;
    }

    // Visceral Impact Camera Trauma (Only triggers on hard collisions, decays rapidly in ~120ms)
    if (this.cameraTrauma > 0.005) {
      const shake = this.cameraTrauma * this.cameraTrauma; // quadratic falloff
      this.camera.rotation.z += (Math.random() - 0.5) * shake * 0.025;
      this.camera.rotation.x += (Math.random() - 0.5) * shake * 0.035;
      this.camera.rotation.y += (Math.random() - 0.5) * shake * 0.035;
      this.cameraTrauma *= Math.exp(-dt * 14.0);
    }
  }
}
