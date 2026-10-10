/**
 * CarMaterials.ts - Centralized High-Performance PBR Material Registry for F1 Hyper-Proto
 * Manages GPU material compilation, shared texture samplers in VRAM,
 * and calibrated roughness, metallic, clearcoat, and emissive parameters.
 */

import * as THREE from 'three';
import { TeamLiveryConfig } from '../../career/CareerTypes';
import { CarLiveryFactory } from './CarLiveryFactory';

export class CarMaterials {
  public liveryConfig: TeamLiveryConfig;
  public isAi: boolean;

  // Procedural Canvas Decal Textures
  public liveryTexture!: THREE.CanvasTexture;
  public rearWingTexture!: THREE.CanvasTexture;
  public sharkFinTexture!: THREE.CanvasTexture;
  public haloDecalTexture!: THREE.CanvasTexture;
  public endplateDecalTexture!: THREE.CanvasTexture;
  public frontWingFlapTexture!: THREE.CanvasTexture;

  // Primary Exterior Aerodynamic Panels
  public bodyMaterial!: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  public rearWingMaterial!: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  public sharkFinMaterial!: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  public haloDecalMaterial!: THREE.MeshStandardMaterial;
  public endplateDecalMaterial!: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  public frontWingFlapMaterial!: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;

  // Shared Structural & Mechanical PBR Materials
  public carbonMaterial!: THREE.MeshStandardMaterial;
  public carbonGlossMaterial!: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  public haloMaterial!: THREE.MeshStandardMaterial;
  public mechanicalMetalMat!: THREE.MeshStandardMaterial;
  public goldMetalMat!: THREE.MeshStandardMaterial;
  public brakeDiscMaterial!: THREE.MeshStandardMaterial;

  // Active Optical & Telemetry Materials
  public headlightGlowMat!: THREE.MeshStandardMaterial;
  public taillightMaterial!: THREE.MeshStandardMaterial;
  public fiaRainLight!: THREE.MeshStandardMaterial;
  public exhaustGlowMat!: THREE.MeshStandardMaterial;
  public drsLedMaterial!: THREE.MeshStandardMaterial;

  // Driver Cockpit Helmet Materials
  public helmetShellMat!: THREE.MeshPhysicalMaterial;
  public helmetVisorMat!: THREE.MeshPhysicalMaterial;

  constructor(livery: TeamLiveryConfig, isAi: boolean = false) {
    this.liveryConfig = livery;
    this.isAi = isAi;
    this.initTexturesAndMaterials();
  }

  private initTexturesAndMaterials(): void {
    const carbonWeave = CarLiveryFactory.getCarbonFiberWeaveTexture();
    const flakeNormal = CarLiveryFactory.getMetallicFlakeTexture();

    // 1. Procedural Canvas Decals
    this.liveryTexture = CarLiveryFactory.createLiveryTexture(this.liveryConfig);
    this.rearWingTexture = CarLiveryFactory.createRearWingDecalTexture(this.liveryConfig);
    this.sharkFinTexture = CarLiveryFactory.createSharkFinDecalTexture(this.liveryConfig);
    this.haloDecalTexture = CarLiveryFactory.createHaloDecalTexture(this.liveryConfig);
    this.endplateDecalTexture = CarLiveryFactory.createEndplateDecalTexture(this.liveryConfig);
    this.frontWingFlapTexture = CarLiveryFactory.createFrontWingFlapTexture(this.liveryConfig);

    // 2. Rear Wing Aerofoil Material
    this.rearWingMaterial = this.isAi
      ? new THREE.MeshStandardMaterial({
          map: this.rearWingTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.26,
          envMapIntensity: 1.25,
        })
      : new THREE.MeshPhysicalMaterial({
          map: this.rearWingTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.25,
          clearcoat: 0.95,
          clearcoatRoughness: 0.03,
          ior: 1.50,
          reflectivity: 0.55,
          envMapIntensity: 1.40,
        });

    // 3. Shark Fin Material
    this.sharkFinMaterial = this.isAi
      ? new THREE.MeshStandardMaterial({
          map: this.sharkFinTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.26,
        })
      : new THREE.MeshPhysicalMaterial({
          map: this.sharkFinTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.25,
          clearcoat: 0.95,
          clearcoatRoughness: 0.03,
          ior: 1.50,
          reflectivity: 0.55,
          envMapIntensity: 1.40,
        });

    // 4. Halo Decal
    this.haloDecalMaterial = new THREE.MeshStandardMaterial({
      map: this.haloDecalTexture,
      color: 0xffffff,
      roughness: 0.24,
      metalness: 0.22,
      envMapIntensity: 1.35,
    });

    // 5. Endplate Decals
    this.endplateDecalMaterial = this.isAi
      ? new THREE.MeshStandardMaterial({
          map: this.endplateDecalTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.24,
        })
      : new THREE.MeshPhysicalMaterial({
          map: this.endplateDecalTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.22,
          clearcoat: 0.95,
          clearcoatRoughness: 0.03,
          ior: 1.52,
          reflectivity: 0.6,
          envMapIntensity: 1.75,
        });

    // 6. Front Wing Flap Decal
    this.frontWingFlapMaterial = this.isAi
      ? new THREE.MeshStandardMaterial({
          map: this.frontWingFlapTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.24,
        })
      : new THREE.MeshPhysicalMaterial({
          map: this.frontWingFlapTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.22,
          clearcoat: 0.95,
          clearcoatRoughness: 0.03,
          ior: 1.52,
          reflectivity: 0.6,
          envMapIntensity: 1.75,
        });

    // 7. DRS Status Indicator LED Lens
    this.drsLedMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x0f172a,
      emissiveIntensity: 0.2,
      roughness: 0.2,
      metalness: 0.5,
    });

    // 8. Monocoque Fuselage & Sidepods Clearcoat Metallic Paint
    this.bodyMaterial = this.isAi
      ? new THREE.MeshStandardMaterial({
          map: this.liveryTexture,
          normalMap: flakeNormal,
          normalScale: new THREE.Vector2(0.040, 0.040),
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.28,
          envMapIntensity: 1.25,
        })
      : new THREE.MeshPhysicalMaterial({
          map: this.liveryTexture,
          normalMap: flakeNormal,
          normalScale: new THREE.Vector2(0.042, 0.042),
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.26,
          clearcoat: 0.95,
          clearcoatRoughness: 0.03,
          ior: 1.50,
          reflectivity: 0.55,
          envMapIntensity: 1.35,
        });

    // 9. Satin Pre-Preg Carbon Fiber (Floor, Diffuser, Wishbones)
    this.carbonMaterial = new THREE.MeshStandardMaterial({
      color: 0x101317,
      normalMap: carbonWeave,
      normalScale: new THREE.Vector2(0.65, 0.65),
      metalness: 0.08,
      roughness: 0.50,
      envMapIntensity: 0.90,
    });

    // 10. High-Gloss Carbon Fiber (Halo Fairing, Aero Fins, Mirrors)
    this.carbonGlossMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0c0e12,
      normalMap: carbonWeave,
      normalScale: new THREE.Vector2(0.35, 0.35),
      metalness: 0.10,
      roughness: 0.18,
      clearcoat: 0.95,
      clearcoatRoughness: 0.03,
      ior: 1.52,
      envMapIntensity: 1.45,
    });

    // 11. Titanium Aerospace Alloy (Halo core arch & Wishbone pivots)
    this.haloMaterial = new THREE.MeshStandardMaterial({
      color: 0x242830,
      metalness: 0.94,
      roughness: 0.22,
      envMapIntensity: 1.35,
    });

    // 12. Mechanical Machined Steel (Calipers, bolts, spindles)
    this.mechanicalMetalMat = new THREE.MeshStandardMaterial({
      color: 0x8a94a6,
      metalness: 0.92,
      roughness: 0.22,
      envMapIntensity: 1.20,
    });

    // 13. Inconel Gold Heat Shielding
    this.goldMetalMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.96,
      roughness: 0.18,
      envMapIntensity: 1.35,
    });

    // 14. Carbon-Ceramic Brake Disc with Thermal Incandescent Glow
    this.brakeDiscMaterial = new THREE.MeshStandardMaterial({
      color: 0x202228,
      metalness: 0.22,
      roughness: 0.44,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
    });

    // 15. Dynamic Lights & FIA Clusters
    this.headlightGlowMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: new THREE.Color(0x38bdf8),
      emissiveIntensity: 3.5,
      roughness: 0.1,
    });

    this.taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0020,
      emissive: new THREE.Color(0xef4444),
      emissiveIntensity: 1.2,
      roughness: 0.15,
    });

    this.fiaRainLight = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: new THREE.Color(0xdc2626),
      emissiveIntensity: 2.8,
      roughness: 0.1,
    });

    this.exhaustGlowMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.95,
      roughness: 0.22,
      emissive: new THREE.Color(0xff4500),
      emissiveIntensity: 0.4,
    });

    // 16. Driver Helmet Pearlescent Shell & Chromatic Visor
    const helmetColor = this.liveryConfig.accentColor
      ? new THREE.Color(this.liveryConfig.accentColor)
      : new THREE.Color(0xf1f5f9);

    this.helmetShellMat = new THREE.MeshPhysicalMaterial({
      color: helmetColor,
      roughness: 0.16,
      metalness: 0.35,
      clearcoat: 1.0,
      clearcoatRoughness: 0.025,
      ior: 1.52,
      envMapIntensity: 1.4,
    });

    this.helmetVisorMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      roughness: 0.025,
      metalness: 0.94,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      ior: 1.65,
      reflectivity: 0.96,
      envMapIntensity: 2.2,
    });
  }

  public setLivery(livery: TeamLiveryConfig): void {
    this.liveryConfig = livery;

    // Dispose old procedural textures to prevent memory buildup
    if (this.liveryTexture) this.liveryTexture.dispose();
    if (this.rearWingTexture) this.rearWingTexture.dispose();
    if (this.sharkFinTexture) this.sharkFinTexture.dispose();
    if (this.haloDecalTexture) this.haloDecalTexture.dispose();
    if (this.endplateDecalTexture) this.endplateDecalTexture.dispose();
    if (this.frontWingFlapTexture) this.frontWingFlapTexture.dispose();

    this.liveryTexture = CarLiveryFactory.createLiveryTexture(this.liveryConfig);
    this.rearWingTexture = CarLiveryFactory.createRearWingDecalTexture(this.liveryConfig);
    this.sharkFinTexture = CarLiveryFactory.createSharkFinDecalTexture(this.liveryConfig);
    this.haloDecalTexture = CarLiveryFactory.createHaloDecalTexture(this.liveryConfig);
    this.endplateDecalTexture = CarLiveryFactory.createEndplateDecalTexture(this.liveryConfig);
    this.frontWingFlapTexture = CarLiveryFactory.createFrontWingFlapTexture(this.liveryConfig);

    if (this.bodyMaterial) {
      this.bodyMaterial.map = this.liveryTexture;
      this.bodyMaterial.needsUpdate = true;
    }
    if (this.rearWingMaterial) {
      this.rearWingMaterial.map = this.rearWingTexture;
      this.rearWingMaterial.needsUpdate = true;
    }
    if (this.sharkFinMaterial) {
      this.sharkFinMaterial.map = this.sharkFinTexture;
      this.sharkFinMaterial.needsUpdate = true;
    }
    if (this.haloDecalMaterial) {
      this.haloDecalMaterial.map = this.haloDecalTexture;
      this.haloDecalMaterial.needsUpdate = true;
    }
    if (this.endplateDecalMaterial) {
      this.endplateDecalMaterial.map = this.endplateDecalTexture;
      this.endplateDecalMaterial.needsUpdate = true;
    }
    if (this.frontWingFlapMaterial) {
      this.frontWingFlapMaterial.map = this.frontWingFlapTexture;
      this.frontWingFlapMaterial.needsUpdate = true;
    }
    if (this.helmetShellMat) {
      const hColor = this.liveryConfig.accentColor || this.liveryConfig.secondaryColor || '#f1f5f9';
      this.helmetShellMat.color.set(hColor);
      this.helmetShellMat.needsUpdate = true;
    }
  }

  public dispose(): void {
    if (this.liveryTexture) this.liveryTexture.dispose();
    if (this.rearWingTexture) this.rearWingTexture.dispose();
    if (this.sharkFinTexture) this.sharkFinTexture.dispose();
    if (this.haloDecalTexture) this.haloDecalTexture.dispose();
    if (this.endplateDecalTexture) this.endplateDecalTexture.dispose();
    if (this.frontWingFlapTexture) this.frontWingFlapTexture.dispose();

    const mats = [
      this.bodyMaterial,
      this.rearWingMaterial,
      this.sharkFinMaterial,
      this.haloDecalMaterial,
      this.endplateDecalMaterial,
      this.frontWingFlapMaterial,
      this.carbonMaterial,
      this.carbonGlossMaterial,
      this.haloMaterial,
      this.mechanicalMetalMat,
      this.goldMetalMat,
      this.brakeDiscMaterial,
      this.headlightGlowMat,
      this.taillightMaterial,
      this.fiaRainLight,
      this.exhaustGlowMat,
      this.drsLedMaterial,
      this.helmetShellMat,
      this.helmetVisorMat,
    ];

    mats.forEach((m) => {
      if (m && typeof m.dispose === 'function') {
        m.dispose();
      }
    });
  }
}
