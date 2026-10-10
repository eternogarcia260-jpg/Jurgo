/**
 * CarDamageSystem.ts - Hardware Morph Deformation, Aeroelastic Flutter & Crash Physics
 * Manages GPU morph-target crumple zones (Zero GC), 2nd-order spring-damper wing flutter,
 * multi-stage aerodynamic damage cascades, and asphalt scraping clatter.
 */

import * as THREE from 'three';
import { DamageState } from '../../physics/VehiclePhysics';
import { CarBodyBuilder } from './CarBodyBuilder';

export class CarDamageSystem {
  // Scratch vectors for zero-allocation scraping detection
  private _scratchWingL = new THREE.Vector3();
  private _scratchWingR = new THREE.Vector3();

  // High-Fidelity Multi-Octave Aeroelastic Physical Oscillator States (Zero GC)
  public wingFlutterTime: number = 0;
  public rearWingOscAngle = { roll: 0, pitch: 0, yaw: 0, y: 0, z: 0 };
  public rearWingOscVel = { roll: 0, pitch: 0, yaw: 0, y: 0, z: 0 };
  public frontWingLeftOsc = { roll: 0, pitch: 0, y: 0 };
  public frontWingLeftVel = { roll: 0, pitch: 0, y: 0 };
  public frontWingRightOsc = { roll: 0, pitch: 0, y: 0 };
  public frontWingRightVel = { roll: 0, pitch: 0, y: 0 };
  public drsOscAngle = { roll: 0, pitch: 0 };
  public drsOscVel = { roll: 0, pitch: 0 };
  public gustTurbulence: number = 0;
  public gustTarget: number = 0;
  public gustTimer: number = 0;

  public repairWingVisuals(body: CarBodyBuilder): void {
    this.frontWingLeftOsc = { roll: 0, pitch: 0, y: 0 };
    this.frontWingLeftVel = { roll: 0, pitch: 0, y: 0 };
    this.frontWingRightOsc = { roll: 0, pitch: 0, y: 0 };
    this.frontWingRightVel = { roll: 0, pitch: 0, y: 0 };

    if (body.frontWingLeftGroup) {
      body.frontWingLeftGroup.visible = true;
      body.frontWingLeftGroup.rotation.set(0, 0, 0);
      body.frontWingLeftGroup.position.set(0, 0, 0);
    }
    if (body.frontWingRightGroup) {
      body.frontWingRightGroup.visible = true;
      body.frontWingRightGroup.rotation.set(0, 0, 0);
      body.frontWingRightGroup.position.set(0, 0, 0);
    }
    if (body.frontWingLeftMainGroup) body.frontWingLeftMainGroup.visible = true;
    if (body.frontWingLeftUpperFlapGroup) body.frontWingLeftUpperFlapGroup.visible = true;
    if (body.endplateLeftGroup) body.endplateLeftGroup.visible = true;
    if (body.frontWingLeftStubMesh) body.frontWingLeftStubMesh.visible = false;
    if (body.frontWingRightMainGroup) body.frontWingRightMainGroup.visible = true;
    if (body.frontWingRightUpperFlapGroup) body.frontWingRightUpperFlapGroup.visible = true;
    if (body.endplateRightGroup) body.endplateRightGroup.visible = true;
    if (body.frontWingRightStubMesh) body.frontWingRightStubMesh.visible = false;
    if (body.wingGroup) body.wingGroup.visible = true;
  }

  public getWingtipWorldPositions(
    groupPos: THREE.Vector3,
    groupYaw: number,
    leftTip: THREE.Vector3,
    rightTip: THREE.Vector3,
    rearDir: THREE.Vector3
  ): void {
    const cosY = Math.cos(groupYaw);
    const sinY = Math.sin(groupYaw);

    const wingLocalZ = -1.82;
    const wingLocalY = 0.92;
    const wingHalfW = 0.74;

    leftTip.set(
      groupPos.x - cosY * wingHalfW + sinY * wingLocalZ,
      groupPos.y + wingLocalY,
      groupPos.z + sinY * wingHalfW + cosY * wingLocalZ
    );

    rightTip.set(
      groupPos.x + cosY * wingHalfW + sinY * wingLocalZ,
      groupPos.y + wingLocalY,
      groupPos.z - sinY * wingHalfW + cosY * wingLocalZ
    );

    rearDir.set(-sinY, 0, -cosY);
  }

  public getFrontWingScrapeWorldPositions(
    body: CarBodyBuilder,
    leftOut: THREE.Vector3,
    rightOut: THREE.Vector3
  ): { leftScraping: boolean; rightScraping: boolean } {
    let leftScraping = false;
    let rightScraping = false;

    if (body.frontWingLeftGroup && body.frontWingLeftGroup.visible && body.frontWingLeftMainGroup?.visible) {
      this._scratchWingL.set(-0.95, 0.04, 2.24);
      body.frontWingLeftGroup.localToWorld(this._scratchWingL);
      leftOut.copy(this._scratchWingL);
      if (leftOut.y <= 0.045) {
        leftScraping = true;
        leftOut.y = Math.max(0.015, leftOut.y);
      }
    } else {
      leftOut.set(0, -999, 0);
    }

    if (body.frontWingRightGroup && body.frontWingRightGroup.visible && body.frontWingRightMainGroup?.visible) {
      this._scratchWingR.set(0.95, 0.04, 2.24);
      body.frontWingRightGroup.localToWorld(this._scratchWingR);
      rightOut.copy(this._scratchWingR);
      if (rightOut.y <= 0.045) {
        rightScraping = true;
        rightOut.y = Math.max(0.015, rightOut.y);
      }
    } else {
      rightOut.set(0, -999, 0);
    }

    return { leftScraping, rightScraping };
  }

  public applyVertexDeformation(body: CarBodyBuilder, damage: DamageState, isAi: boolean): void {
    if (isAi || !body.noseMesh || !body.noseMesh.morphTargetInfluences) return;

    const safeCrumple = Number.isFinite(damage.frontCrumple) ? Math.max(0, Math.min(1.0, damage.frontCrumple)) : 0;
    const lDmg = Math.min(1.0, damage.frontWingLeftDamage || 0);
    const rDmg = Math.min(1.0, damage.frontWingRightDamage || 0);

    body.noseMesh.morphTargetInfluences[0] = safeCrumple;
    body.noseMesh.morphTargetInfluences[1] = lDmg;
    body.noseMesh.morphTargetInfluences[2] = rDmg;
  }

  public update(
    body: CarBodyBuilder,
    damage: DamageState,
    steerAngle: number,
    brake: number,
    speedKmh: number,
    dt: number,
    isAi: boolean
  ): void {
    this.wingFlutterTime += dt;
    const speedRatio = Math.max(0, speedKmh / 100.0);
    const dynPressure = speedRatio * speedRatio;
    const aeroLoadScale = Math.min(3.5, Math.max(0.04, speedRatio));

    // Turbulent wind gust generator
    this.gustTimer -= dt;
    if (this.gustTimer <= 0) {
      this.gustTimer = 0.08 + Math.random() * 0.16;
      this.gustTarget = (Math.random() - 0.5) * 2.0;
    }
    this.gustTurbulence += (this.gustTarget - this.gustTurbulence) * Math.min(1.0, dt * 12.0);

    const springK = 260.0;
    const dampC = 20.0;

    // 1. REAR WING STRUCTURAL AEROELASTIC FLUTTER & 2ND-ORDER SPRING OSCILLATOR
    if (body.wingGroup) {
      const isDamaged = Boolean(
        damage.wingLoose ||
        damage.rearWingLeftDetached ||
        damage.rearWingRightDetached ||
        (damage.wingDamageAmount && damage.wingDamageAmount > 0)
      );

      if (isDamaged) {
        const leftBroken = Boolean(damage.rearWingLeftDetached);
        const rightBroken = Boolean(damage.rearWingRightDetached);
        const totalSevered = leftBroken && rightBroken;
        const damageSeverity = Math.min(1.0, (damage.wingDamageAmount || 0) + (leftBroken || rightBroken ? 0.45 : 0.2));

        if (body.rwEndplateLeft) body.rwEndplateLeft.visible = !leftBroken;
        if (body.rwPylonLeft) body.rwPylonLeft.visible = !leftBroken;
        if (body.rwEndplateRight) body.rwEndplateRight.visible = !rightBroken;
        if (body.rwPylonRight) body.rwPylonRight.visible = !rightBroken;

        const t = this.wingFlutterTime;
        const freqMode1 = 15.2 * Math.sqrt(aeroLoadScale);
        const mode1 = (Math.sin(t * freqMode1) * 0.65 + Math.sin(t * freqMode1 * 1.618) * 0.35) * 0.048 * damageSeverity;
        const mode2 = Math.cos(t * 27.4 + this.gustTurbulence * 1.4) * (0.030 + Math.abs(this.gustTurbulence) * 0.018) * aeroLoadScale * damageSeverity;
        const mode3 = Math.sin(t * 62.0) * 0.012 * Math.min(2.0, dynPressure) * damageSeverity;

        const latInertiaRoll = -steerAngle * dynPressure * 0.08;
        const latInertiaYaw = steerAngle * dynPressure * 0.06;
        const brakePitch = brake * dynPressure * 0.035;

        let baseRoll = 0;
        let baseYaw = 0;
        let basePitch = -dynPressure * 0.025 * damageSeverity + brakePitch;
        let basePosY = -dynPressure * 0.018 * damageSeverity;
        let basePosZ = 0;

        if (totalSevered || (damage.wingDamageAmount || 0) > 0.70) {
          basePosY = -0.22;
          basePosZ = -0.06;
          basePitch = -0.28;
          baseRoll = this.gustTurbulence * 0.03;
        } else if (leftBroken) {
          baseRoll = 0.26 + dynPressure * 0.06;
          baseYaw = 0.14;
          basePitch = 0.10 - dynPressure * 0.03;
          basePosY = -0.10;
          basePosZ = -0.02;
        } else if (rightBroken) {
          baseRoll = -0.26 - dynPressure * 0.06;
          baseYaw = -0.14;
          basePitch = 0.10 - dynPressure * 0.03;
          basePosY = -0.10;
          basePosZ = -0.02;
        } else {
          baseRoll = (damage.wingDamageAmount || 0) * 0.12;
          baseYaw = (damage.wingDamageAmount || 0) * 0.06;
          basePosY = -0.02 * damageSeverity;
        }

        const targetRoll = baseRoll + (mode1 + mode2 + mode3) * aeroLoadScale + latInertiaRoll;
        const targetPitch = basePitch + (mode1 * 0.55 + mode2 * 0.75 + mode3 * 0.4) * aeroLoadScale;
        const targetYaw = baseYaw + (mode1 * 0.4 + mode2 * 0.3) * aeroLoadScale + latInertiaYaw;
        const targetPosY = basePosY + (mode1 + mode2 * 0.6) * 0.018 * aeroLoadScale;
        const targetPosZ = basePosZ;

        const accelRoll = (targetRoll - this.rearWingOscAngle.roll) * springK - this.rearWingOscVel.roll * dampC;
        this.rearWingOscVel.roll += accelRoll * dt;
        this.rearWingOscAngle.roll += this.rearWingOscVel.roll * dt;

        const accelPitch = (targetPitch - this.rearWingOscAngle.pitch) * springK - this.rearWingOscVel.pitch * dampC;
        this.rearWingOscVel.pitch += accelPitch * dt;
        this.rearWingOscAngle.pitch += this.rearWingOscVel.pitch * dt;

        const accelYaw = (targetYaw - this.rearWingOscAngle.yaw) * springK - this.rearWingOscVel.yaw * dampC;
        this.rearWingOscVel.yaw += accelYaw * dt;
        this.rearWingOscAngle.yaw += this.rearWingOscVel.yaw * dt;

        const accelPosY = (targetPosY - this.rearWingOscAngle.y) * springK - this.rearWingOscVel.y * dampC;
        this.rearWingOscVel.y += accelPosY * dt;
        this.rearWingOscAngle.y += this.rearWingOscVel.y * dt;

        body.wingGroup.rotation.set(this.rearWingOscAngle.pitch, this.rearWingOscAngle.yaw, this.rearWingOscAngle.roll);
        body.wingGroup.position.set(0, this.rearWingOscAngle.y, targetPosZ);

        // Broken DRS Flap High-Frequency Flutter
        if (body.drsPivotGroup) {
          if (damage.drsFlapBroken || totalSevered) {
            const drsFreq = 42.0 * Math.sqrt(aeroLoadScale);
            const drsFlutter = (Math.sin(t * drsFreq) * 0.6 + Math.sin(t * drsFreq * 1.414) * 0.4) * 0.075 * aeroLoadScale;
            const drsTargetZ = 0.30 + drsFlutter + this.gustTurbulence * 0.05;
            const drsTargetX = 0.42 + Math.cos(t * 26.0) * 0.04 * aeroLoadScale;

            const accelDrsZ = (drsTargetZ - this.drsOscAngle.roll) * 320.0 - this.drsOscVel.roll * 24.0;
            this.drsOscVel.roll += accelDrsZ * dt;
            this.drsOscAngle.roll += this.drsOscVel.roll * dt;

            const accelDrsX = (drsTargetX - this.drsOscAngle.pitch) * 320.0 - this.drsOscVel.pitch * 24.0;
            this.drsOscVel.pitch += accelDrsX * dt;
            this.drsOscAngle.pitch += this.drsOscVel.pitch * dt;

            body.drsPivotGroup.rotation.z = this.drsOscAngle.roll;
            body.drsPivotGroup.rotation.x = this.drsOscAngle.pitch;
          }
        }
      } else {
        if (body.rwEndplateLeft) body.rwEndplateLeft.visible = true;
        if (body.rwPylonLeft) body.rwPylonLeft.visible = true;
        if (body.rwEndplateRight) body.rwEndplateRight.visible = true;
        if (body.rwPylonRight) body.rwPylonRight.visible = true;

        this.rearWingOscAngle.roll += (0 - this.rearWingOscAngle.roll) * Math.min(1.0, dt * 18.0);
        this.rearWingOscAngle.pitch += (0 - this.rearWingOscAngle.pitch) * Math.min(1.0, dt * 18.0);
        this.rearWingOscAngle.yaw += (0 - this.rearWingOscAngle.yaw) * Math.min(1.0, dt * 18.0);
        this.rearWingOscAngle.y += (0 - this.rearWingOscAngle.y) * Math.min(1.0, dt * 18.0);
        this.rearWingOscVel.roll = 0;
        this.rearWingOscVel.pitch = 0;
        this.rearWingOscVel.yaw = 0;
        this.rearWingOscVel.y = 0;

        body.wingGroup.rotation.set(this.rearWingOscAngle.pitch, this.rearWingOscAngle.yaw, this.rearWingOscAngle.roll);
        body.wingGroup.position.set(0, this.rearWingOscAngle.y, 0);
      }
    }

    // 2. FRONT WING GROUND-EFFECT VENTURI BUFFETING & ASPHALT CLATTER PHYSICS
    if (body.frontWingGroup) {
      body.frontWingGroup.rotation.x = -damage.frontCrumple * 0.20;
      const t = this.wingFlutterTime;

      // Left Cascade
      if (body.frontWingLeftGroup) {
        const lDmg = damage.frontWingLeftDamage || 0;
        const lMainDetached = Boolean(damage.frontWingLeftDetached || lDmg > 0.88);
        const lUpperDetached = Boolean(damage.frontWingLeftUpperFlapDetached || lDmg > 0.55 || lMainDetached);
        const lEndplateDetached = Boolean(damage.endplateLeftDetached || lDmg > 0.35 || lMainDetached);

        if (body.frontWingLeftMainGroup) body.frontWingLeftMainGroup.visible = !lMainDetached;
        if (body.frontWingLeftUpperFlapGroup) body.frontWingLeftUpperFlapGroup.visible = !lUpperDetached && !lMainDetached;
        if (body.endplateLeftGroup) body.endplateLeftGroup.visible = !lEndplateDetached && !lMainDetached;
        if (body.frontWingLeftStubMesh) body.frontWingLeftStubMesh.visible = lMainDetached;

        if (!lMainDetached && lDmg > 0.05) {
          const fwFreq = 24.0 * Math.sqrt(aeroLoadScale);
          const geBuffet = (Math.sin(t * fwFreq) * 0.70 + Math.sin(t * fwFreq * 1.618) * 0.30) * 0.048 * lDmg * aeroLoadScale;
          const geChatter = Math.sin(t * 72.0) * 0.012 * Math.min(2.5, dynPressure) * lDmg;

          let targetRoll = -lDmg * 0.32 - dynPressure * 0.024 * lDmg + geBuffet + geChatter;
          let targetPitch = -lDmg * 0.18 - dynPressure * 0.018 * lDmg + geBuffet * 0.5;
          let targetY = -lDmg * 0.092 - dynPressure * 0.015 * lDmg;

          const currentOuterTipY = 0.12 + targetY + Math.sin(targetRoll) * 0.95;
          if (currentOuterTipY < 0.015) {
            const penetration = 0.015 - currentOuterTipY;
            targetY += penetration * 0.65;
            targetRoll += penetration * 0.85;
            this.frontWingLeftVel.y += (penetration * 260.0 + Math.random() * 4.0) * dt;
          }

          const accelRoll = (targetRoll - this.frontWingLeftOsc.roll) * 320.0 - this.frontWingLeftVel.roll * 24.0;
          this.frontWingLeftVel.roll += accelRoll * dt;
          this.frontWingLeftOsc.roll += this.frontWingLeftVel.roll * dt;

          const accelPitch = (targetPitch - this.frontWingLeftOsc.pitch) * 320.0 - this.frontWingLeftVel.pitch * 24.0;
          this.frontWingLeftVel.pitch += accelPitch * dt;
          this.frontWingLeftOsc.pitch += this.frontWingLeftVel.pitch * dt;

          const accelY = (targetY - this.frontWingLeftOsc.y) * 320.0 - this.frontWingLeftVel.y * 24.0;
          this.frontWingLeftVel.y += accelY * dt;
          this.frontWingLeftOsc.y += this.frontWingLeftVel.y * dt;

          body.frontWingLeftGroup.rotation.z = this.frontWingLeftOsc.roll;
          body.frontWingLeftGroup.rotation.x = this.frontWingLeftOsc.pitch;
          body.frontWingLeftGroup.position.y = this.frontWingLeftOsc.y;
        } else if (!lMainDetached) {
          body.frontWingLeftGroup.rotation.set(0, 0, 0);
          body.frontWingLeftGroup.position.set(0, 0, 0);
        }
      }

      // Right Cascade
      if (body.frontWingRightGroup) {
        const rDmg = damage.frontWingRightDamage || 0;
        const rMainDetached = Boolean(damage.frontWingRightDetached || rDmg > 0.88);
        const rUpperDetached = Boolean(damage.frontWingRightUpperFlapDetached || rDmg > 0.55 || rMainDetached);
        const rEndplateDetached = Boolean(damage.endplateRightDetached || rDmg > 0.35 || rMainDetached);

        if (body.frontWingRightMainGroup) body.frontWingRightMainGroup.visible = !rMainDetached;
        if (body.frontWingRightUpperFlapGroup) body.frontWingRightUpperFlapGroup.visible = !rUpperDetached && !rMainDetached;
        if (body.endplateRightGroup) body.endplateRightGroup.visible = !rEndplateDetached && !rMainDetached;
        if (body.frontWingRightStubMesh) body.frontWingRightStubMesh.visible = rMainDetached;

        if (!rMainDetached && rDmg > 0.05) {
          const fwFreq = 24.0 * Math.sqrt(aeroLoadScale);
          const geBuffet = (Math.sin(t * fwFreq + 1.1) * 0.70 + Math.sin(t * fwFreq * 1.618 + 2.2) * 0.30) * 0.048 * rDmg * aeroLoadScale;
          const geChatter = Math.sin(t * 72.0 + 1.6) * 0.012 * Math.min(2.5, dynPressure) * rDmg;

          let targetRoll = rDmg * 0.32 + dynPressure * 0.024 * rDmg - geBuffet - geChatter;
          let targetPitch = -rDmg * 0.18 - dynPressure * 0.018 * rDmg + geBuffet * 0.5;
          let targetY = -rDmg * 0.092 - dynPressure * 0.015 * rDmg;

          const currentOuterTipY = 0.12 + targetY - Math.sin(targetRoll) * 0.95;
          if (currentOuterTipY < 0.015) {
            const penetration = 0.015 - currentOuterTipY;
            targetY += penetration * 0.65;
            targetRoll -= penetration * 0.85;
            this.frontWingRightVel.y += (penetration * 260.0 + Math.random() * 4.0) * dt;
          }

          const accelRoll = (targetRoll - this.frontWingRightOsc.roll) * 320.0 - this.frontWingRightVel.roll * 24.0;
          this.frontWingRightVel.roll += accelRoll * dt;
          this.frontWingRightOsc.roll += this.frontWingRightVel.roll * dt;

          const accelPitch = (targetPitch - this.frontWingRightOsc.pitch) * 320.0 - this.frontWingRightVel.pitch * 24.0;
          this.frontWingRightVel.pitch += accelPitch * dt;
          this.frontWingRightOsc.pitch += this.frontWingRightVel.pitch * dt;

          const accelY = (targetY - this.frontWingRightOsc.y) * 320.0 - this.frontWingRightVel.y * 24.0;
          this.frontWingRightVel.y += accelY * dt;
          this.frontWingRightOsc.y += this.frontWingRightVel.y * dt;

          body.frontWingRightGroup.rotation.z = this.frontWingRightOsc.roll;
          body.frontWingRightGroup.rotation.x = this.frontWingRightOsc.pitch;
          body.frontWingRightGroup.position.y = this.frontWingRightOsc.y;
        } else if (!rMainDetached) {
          body.frontWingRightGroup.rotation.set(0, 0, 0);
          body.frontWingRightGroup.position.set(0, 0, 0);
        }
      }
    }

    // Apply morph targets to nose
    this.applyVertexDeformation(body, damage, isAi);
  }
}
