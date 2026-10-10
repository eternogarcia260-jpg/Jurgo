/**
 * CarModel.ts - State-Of-The-Art Contemporary Competition Single-Seater (F1 Hybrid Hyper-Proto)
 * 
 * Composite Facade Architecture:
 * - Subsystems:
 *   - CarLiveryFactory: Procedural 2K/4K Canvas decals, team liveries & tire sidewalls.
 *   - CarMaterials: Centralized PBR material registry & GPU lifecycle.
 *   - CarBodyBuilder: Continuous aerodynamic fuselage, wings, halo, cockpit & suspension.
 *   - CarWheelAssembly: Competition 18" wheels, PBR slicks, BBS rims, motion blur & brakes.
 *   - CarDamageSystem: GPU morph targets (Zero GC), 2nd-order aeroelastic spring flutter.
 *   - CarEffectsSystem: DRS kinematics, GLSL exhaust backfire flame, and contact shadow.
 * 
 * Guarantees:
 * - 100% preservation of visual fidelity and all aesthetic elements.
 * - 100% backward compatibility of the public API (zero breaking changes).
 * - Zero Garbage Collection spikes during high-speed racing and collisions.
 */

import * as THREE from 'three';
import { DamageState } from '../physics/VehiclePhysics';
import { CarModelImporter } from '../loaders/CarModelImporter';
import { TireCompoundType } from '../physics/TireCompound';
import { TeamLiveryConfig, RACE_TEAMS } from '../career/CareerTypes';

import { CarLiveryFactory } from './car/CarLiveryFactory';
import { CarMaterials } from './car/CarMaterials';
import { CarBodyBuilder } from './car/CarBodyBuilder';
import { CarWheelAssembly } from './car/CarWheelAssembly';
import { CarDamageSystem } from './car/CarDamageSystem';
import { CarEffectsSystem } from './car/CarEffectsSystem';

export class CarModel {
  public group: THREE.Group;
  public liveryConfig: TeamLiveryConfig;
  public isAi: boolean = false;

  // Custom User-Uploaded 3D Model State
  public currentModelName: string = 'Apex F1 Turbo GP';
  public isCustomModel: boolean = false;
  private customModelGroup: THREE.Group = new THREE.Group();
  private proceduralBodyGroup: THREE.Group = new THREE.Group();
  private customWheelMeshes: THREE.Object3D[] = [];
  private customWheelPivotsFront: THREE.Object3D[] = [];
  private modelLoadGeneration: number = 0;

  // Modular Subsystems
  public materials: CarMaterials;
  public bodyBuilder: CarBodyBuilder;
  public wheels: CarWheelAssembly;
  public damageSystem: CarDamageSystem;
  public effectsSystem: CarEffectsSystem;

  public contactShadowMesh?: THREE.Mesh;

  /**
   * Static tire texture cache flush delegating to CarLiveryFactory
   */
  public static clearTireTextureCache(): void {
    CarLiveryFactory.clearTireTextureCache();
  }

  constructor(livery?: TeamLiveryConfig, isAi: boolean = false) {
    this.isAi = isAi;
    this.liveryConfig = livery || RACE_TEAMS[0];
    this.group = new THREE.Group();

    // 1. Initialize PBR Materials & Shaders
    this.materials = new CarMaterials(this.liveryConfig, this.isAi);

    // 2. Instantiate Subsystems
    this.bodyBuilder = new CarBodyBuilder();
    this.wheels = new CarWheelAssembly();
    this.damageSystem = new CarDamageSystem();
    this.effectsSystem = new CarEffectsSystem();

    // 3. Assemble Procedural Chassis & Aerodynamics
    this.bodyBuilder.buildCarBody(this.proceduralBodyGroup, this.materials, this.isAi);

    // 4. Build Competition Wheels & Suspension Hubs
    this.wheels.buildWheels(this.proceduralBodyGroup, this.materials);

    // 5. Build Dynamic Lights & Exhaust System
    this.effectsSystem.buildLights(this.proceduralBodyGroup, this.materials);
    this.effectsSystem.buildExhausts(this.proceduralBodyGroup, this.materials, this.isAi);

    // 6. Build Underbody Contact Shadow
    this.effectsSystem.buildUnderbodyContactShadow(this.group);
    this.contactShadowMesh = this.effectsSystem.contactShadowMesh;

    // 7. Mount Hierarchy
    this.group.add(this.proceduralBodyGroup);
    this.group.add(this.customModelGroup);

    this.ensureCastShadows();
  }

  /**
   * Optimizes shadow casting: Only primary exterior aerodynamic body panels, wings,
   * and outer tires cast shadows. Eliminates small internal cockpit draw calls in shadow passes.
   */
  public ensureCastShadows(): void {
    const shadowMaterials = new Set([
      this.materials.bodyMaterial,
      this.materials.haloMaterial,
      this.materials.rearWingMaterial,
      this.materials.frontWingFlapMaterial,
      this.materials.carbonMaterial,
      this.materials.carbonGlossMaterial,
    ]);

    this.proceduralBodyGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj === this.contactShadowMesh) {
          obj.castShadow = false;
        } else if (
          obj === this.bodyBuilder.noseMesh ||
          (Array.isArray(obj.material)
            ? obj.material.some((m) => shadowMaterials.has(m))
            : shadowMaterials.has(obj.material))
        ) {
          obj.castShadow = true;
        } else {
          obj.castShadow = false;
        }
      }
    });

    this.wheels.wheelMeshes.forEach((wm) => {
      wm.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = this.wheels.tireMeshList.includes(obj);
        }
      });
    });

    this.customModelGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj !== this.contactShadowMesh) {
        obj.castShadow = true;
      }
    });
  }

  // =========================================================================
  // WHEELS & PIT STOP OPERATIONS (Backward Compatible API)
  // =========================================================================

  public setWheelOffset(wheelIdx: number, offset: number): void {
    this.wheels.setWheelOffset(wheelIdx, offset);
  }

  public setWheelVisible(wheelIdx: number, visible: boolean): void {
    this.wheels.setWheelVisible(wheelIdx, visible);
  }

  public setAllWheelsVisible(visible: boolean = true): void {
    this.wheels.setAllWheelsVisible(visible);
  }

  public resetWheelOffsets(): void {
    this.wheels.resetWheelOffsets();
  }

  public setTireCompoundVisuals(compound: TireCompoundType): void {
    this.wheels.setTireCompoundVisuals(compound);
  }

  public setBrakeDiscThermalGlow(glowFactor: number): void {
    this.wheels.setBrakeDiscThermalGlow(glowFactor);
  }

  public setCenterlockNutSpin(wheelIdx: number, angle: number): void {
    this.wheels.setCenterlockNutSpin(wheelIdx, angle);
  }

  public getWheelHubWorldPos(wheelIdx: number, target: THREE.Vector3): THREE.Vector3 {
    return this.wheels.getWheelHubWorldPos(wheelIdx, target);
  }

  public getFourWheelWorldPositions(
    wFL: THREE.Vector3,
    wFR: THREE.Vector3,
    wRL: THREE.Vector3,
    wRR: THREE.Vector3
  ): void {
    this.wheels.getFourWheelWorldPositions(wFL, wFR, wRL, wRR, this.group.position);
  }

  public getSingleWheelWorldPosition(wheelIdx: number, out: THREE.Vector3): void {
    this.wheels.getSingleWheelWorldPosition(wheelIdx, out, this.group.position);
  }

  public getSpindleWorldTransform(
    wheelIdx: number,
    outPos: THREE.Vector3,
    outAxleDir: THREE.Vector3,
    outQuat: THREE.Quaternion
  ): void {
    this.wheels.getSpindleWorldTransform(wheelIdx, outPos, outAxleDir, outQuat);
  }

  // =========================================================================
  // AERODYNAMICS, SCRAPING & EFFECTS (Backward Compatible API)
  // =========================================================================

  public getWingtipWorldPositions(
    leftTip: THREE.Vector3,
    rightTip: THREE.Vector3,
    rearDir: THREE.Vector3
  ): void {
    this.damageSystem.getWingtipWorldPositions(
      this.group.position,
      this.group.rotation.y,
      leftTip,
      rightTip,
      rearDir
    );
  }

  public getFrontWingScrapeWorldPositions(
    leftOut: THREE.Vector3,
    rightOut: THREE.Vector3
  ): { leftScraping: boolean; rightScraping: boolean } {
    return this.damageSystem.getFrontWingScrapeWorldPositions(this.bodyBuilder, leftOut, rightOut);
  }

  public getUnderbodyPlankWorldPosition(outPos: THREE.Vector3, rearDir: THREE.Vector3): void {
    this.effectsSystem.getUnderbodyPlankWorldPosition(
      this.group.position,
      this.group.rotation.y,
      outPos,
      rearDir
    );
  }

  public getExhaustWorldPositions(
    leftPipe: THREE.Vector3,
    rightPipe: THREE.Vector3,
    rearDir: THREE.Vector3
  ): void {
    this.effectsSystem.getExhaustWorldPositions(
      this.group.position,
      this.group.rotation.y,
      leftPipe,
      rightPipe,
      rearDir
    );
  }

  public repairWingVisuals(): void {
    this.damageSystem.repairWingVisuals(this.bodyBuilder);
  }

  public repairVisualDamage(): void {
    this.repairWingVisuals();
  }

  public triggerBackfire(isHighRpm: boolean = false): void {
    this.effectsSystem.triggerBackfire(isHighRpm);
  }

  public setDRS(isOpen: boolean, dt: number = 0.016, speedKmh: number = 0): void {
    this.effectsSystem.setDRS(this.bodyBuilder, isOpen, dt, speedKmh);
  }

  public setLivery(livery: TeamLiveryConfig): void {
    this.liveryConfig = livery;
    this.materials.setLivery(livery);
  }

  // =========================================================================
  // MAIN PER-FRAME DYNAMIC UPDATE (Backward Compatible API)
  // =========================================================================

  public update(
    steerAngle: number,
    wheelRotations: number[],
    brake: number,
    speedKmh: number,
    damage: DamageState,
    isBackfiring: boolean,
    rpm: number = 1000,
    suspensionCompression?: number[],
    isPunctured?: boolean[],
    tireWear?: number[],
    dt: number = 0.016,
    throttle: number = 0
  ): void {
    // 1. Update Wheels, Tires, Brakes & Ackermann Steering
    this.wheels.update(
      steerAngle,
      wheelRotations,
      brake,
      speedKmh,
      damage,
      suspensionCompression,
      isPunctured,
      tireWear,
      dt
    );

    // 2. Update Lights, Backfire Flame Shader, Cockpit, and Shift LEDs
    this.effectsSystem.update(
      this.bodyBuilder,
      this.materials,
      steerAngle,
      brake,
      speedKmh,
      throttle,
      rpm,
      isBackfiring,
      dt
    );

    // 3. Update Aeroelastic Flutter, Wing Drops, Scraping Rebound, and Morph Targets
    this.damageSystem.update(
      this.bodyBuilder,
      damage,
      steerAngle,
      brake,
      speedKmh,
      dt,
      this.isAi
    );
  }

  // =========================================================================
  // CUSTOM 3D MODEL LOADER INTEGRATION (GLB, OBJ, ZIP)
  // =========================================================================

  private disposeCustomModel(): void {
    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();
    const disposedTextures = new Set<THREE.Texture>();

    this.customModelGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry && !disposedGeos.has(obj.geometry)) {
          disposedGeos.add(obj.geometry);
          obj.geometry.dispose();
        }
        if (obj.material) {
          const mats = (Array.isArray(obj.material) ? obj.material : [obj.material]) as THREE.Material[];
          mats.forEach((m: THREE.Material) => {
            if (disposedMats.has(m)) return;
            disposedMats.add(m);
            const anyMat = m as any;
            const texProps = [
              'map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap',
              'normalMap', 'displacementMap', 'roughnessMap', 'metalnessMap',
              'alphaMap', 'envMap'
            ];
            for (let i = 0; i < texProps.length; i++) {
              const tex = anyMat[texProps[i]];
              if (tex && typeof tex.dispose === 'function' && !disposedTextures.has(tex)) {
                disposedTextures.add(tex);
                tex.dispose();
              }
            }
            m.dispose();
          });
        }
      }
    });
    this.customModelGroup.clear();
    this.customWheelMeshes = [];
    this.customWheelPivotsFront = [];
  }

  public async loadCustomModel(file: File): Promise<{ success: boolean; name: string; error?: string }> {
    const gen = ++this.modelLoadGeneration;
    try {
      const imported = await CarModelImporter.loadFromFile(file);
      if (gen !== this.modelLoadGeneration) {
        imported.rootGroup.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              mats.forEach((m) => m.dispose());
            }
          }
        });
        return { success: false, name: file.name, error: 'Carga cancelada.' };
      }

      this.disposeCustomModel();
      this.customModelGroup.add(imported.rootGroup);
      this.customModelGroup.visible = true;
      this.proceduralBodyGroup.visible = false;
      this.isCustomModel = true;
      this.currentModelName = imported.name;
      this.customWheelMeshes = imported.wheelMeshes;
      this.customWheelPivotsFront = imported.wheelPivotsFront;

      this.wheels.wheelMeshes.forEach((w) => {
        w.visible = false;
      });
      this.ensureCastShadows();

      return { success: true, name: imported.name };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, name: file.name, error: msg };
    }
  }

  public restoreDefaultModel(): void {
    this.modelLoadGeneration++;
    this.disposeCustomModel();
    this.customModelGroup.visible = false;
    this.proceduralBodyGroup.visible = true;
    this.wheels.wheelMeshes.forEach((w) => {
      w.visible = true;
    });
    this.ensureCastShadows();
    this.isCustomModel = false;
    this.currentModelName = 'Apex F1 Turbo GP';
  }

  // =========================================================================
  // RESOURCE CLEANUP & MEMORY MANAGEMENT
  // =========================================================================

  public dispose(): void {
    this.modelLoadGeneration++;
    this.disposeCustomModel();

    this.effectsSystem.dispose();
    this.materials.dispose();
    this.wheels.dispose();

    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();
    const disposedTextures = new Set<THREE.Texture>();

    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry && !disposedGeos.has(obj.geometry)) {
          disposedGeos.add(obj.geometry);
          obj.geometry.dispose();
        }
        if (obj.material) {
          const mats = (Array.isArray(obj.material) ? obj.material : [obj.material]) as THREE.Material[];
          mats.forEach((m: THREE.Material) => {
            if (disposedMats.has(m)) return;
            disposedMats.add(m);
            const anyMat = m as any;
            const texProps = [
              'map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap',
              'normalMap', 'displacementMap', 'roughnessMap', 'metalnessMap',
              'alphaMap', 'envMap'
            ];
            for (let i = 0; i < texProps.length; i++) {
              const tex = anyMat[texProps[i]];
              if (tex && typeof tex.dispose === 'function' && !disposedTextures.has(tex)) {
                disposedTextures.add(tex);
                tex.dispose();
              }
            }
            m.dispose();
          });
        }
      }
    });
  }
}
