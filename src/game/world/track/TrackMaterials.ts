/**
 * TrackMaterials.ts - Centralized High-Performance PBR Material Registry
 * Manages GPU material compilation, shared texture samplers in VRAM,
 * and calibrated roughness/metalness parameters for FIA Grade-1 circuit rendering.
 */

import * as THREE from 'three';
import asphaltImg from '../../../assets/images/track_asphalt_detail_1790904767865.jpg';
import { getAsphaltPBRTextures, getConcretePBRTextures } from '../../utils/TrackPBRTextures';
import { OrganicTerrainBuilder } from '../OrganicTerrainBuilder';
import { TrackTextureFactory } from './TrackTextureFactory';

export class TrackMaterials {
  public asphaltMat!: THREE.MeshStandardMaterial;
  public kerbRedMat!: THREE.MeshStandardMaterial;
  public kerbWhiteMat!: THREE.MeshStandardMaterial;
  public concreteBarrierMat!: THREE.MeshStandardMaterial;
  public metalFenceMat!: THREE.MeshStandardMaterial;
  public tecproRedMat!: THREE.MeshStandardMaterial;
  public tecproWhiteMat!: THREE.MeshStandardMaterial;
  public grassMat!: THREE.MeshStandardMaterial;
  public gravelMat!: THREE.MeshStandardMaterial;
  public dirtShoulderMat!: THREE.MeshStandardMaterial;
  public treeBarkMat!: THREE.MeshStandardMaterial;
  public pineFoliageMat!: THREE.MeshStandardMaterial;
  public oakFoliageMat!: THREE.MeshStandardMaterial;
  public cypressFoliageMat!: THREE.MeshStandardMaterial;
  public bushFoliageMat!: THREE.MeshStandardMaterial;
  public grassTuftMat!: THREE.MeshLambertMaterial;
  public glassMat!: THREE.MeshStandardMaterial;
  public metalDarkMat!: THREE.MeshStandardMaterial;
  public metalSilverMat!: THREE.MeshStandardMaterial;
  public overheadTrussMat!: THREE.MeshStandardMaterial;
  public startLightMat!: THREE.MeshBasicMaterial;
  public floodlightMat!: THREE.MeshStandardMaterial;

  constructor() {
    this.init();
  }

  private init(): void {
    const textureLoader = new THREE.TextureLoader();

    // High-Grip Racing Asphalt Texture with Balanced Anisotropy
    const asphaltTex = textureLoader.load(asphaltImg);
    asphaltTex.wrapS = THREE.RepeatWrapping;
    asphaltTex.wrapT = THREE.RepeatWrapping;
    asphaltTex.anisotropy = 8;
    asphaltTex.generateMipmaps = true;
    asphaltTex.minFilter = THREE.LinearMipmapLinearFilter;
    asphaltTex.magFilter = THREE.LinearFilter;
    asphaltTex.repeat.set(16, 16);

    // Procedural PBR Physical Micro-Aggregate Normal, Roughness & Albedo Maps
    const asphaltPBR = getAsphaltPBRTextures();
    const asphaltAlbedo = asphaltPBR.albedo ? asphaltPBR.albedo.clone() : asphaltTex;
    asphaltAlbedo.repeat.set(16, 16);
    asphaltAlbedo.anisotropy = 8;
    asphaltAlbedo.needsUpdate = true;

    const asphaltNormal = asphaltPBR.normal.clone();
    asphaltNormal.repeat.set(16, 16);
    asphaltNormal.anisotropy = 4;
    asphaltNormal.needsUpdate = true;

    const asphaltRough = asphaltPBR.roughness.clone();
    asphaltRough.repeat.set(16, 16);
    asphaltRough.anisotropy = 4;
    asphaltRough.needsUpdate = true;

    this.asphaltMat = new THREE.MeshStandardMaterial({
      map: asphaltAlbedo,
      normalMap: asphaltNormal,
      normalScale: new THREE.Vector2(1.9, 1.9),
      roughnessMap: asphaltRough,
      roughness: 0.72,
      metalness: 0.04,
      envMapIntensity: 0.60,
    });

    // Photorealistic PBR Racing Turf
    const grassTextures = OrganicTerrainBuilder.createOrganicGrassPBRTextures();
    this.grassMat = new THREE.MeshStandardMaterial({
      map: grassTextures.albedo,
      normalMap: grassTextures.normal,
      normalScale: new THREE.Vector2(1.8, 1.8),
      roughnessMap: grassTextures.roughness,
      roughness: 0.88,
      metalness: 0.0,
      envMapIntensity: 0.16,
      color: new THREE.Color(0x3e5234),
    });

    // Runoff Gravel Trap Material with Micro-Pebble Normal Relief
    const gravelNormal = asphaltPBR.normal.clone();
    gravelNormal.repeat.set(24, 24);
    gravelNormal.needsUpdate = true;

    this.gravelMat = new THREE.MeshStandardMaterial({
      color: 0xaa9266,
      normalMap: gravelNormal,
      normalScale: new THREE.Vector2(2.0, 2.0),
      roughness: 0.90,
      metalness: 0.02,
      envMapIntensity: 0.35,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0,
    });

    // Compacted Dirt/Gravel Shoulder Transition
    this.dirtShoulderMat = new THREE.MeshStandardMaterial({
      color: 0x281c12,
      normalMap: gravelNormal,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughness: 0.92,
      metalness: 0.02,
      envMapIntensity: 0.25,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0,
    });

    // Cast Concrete & Kerb PBR Normal Map
    const concretePBR = getConcretePBRTextures();
    const kerbNormal = concretePBR.normal.clone();
    kerbNormal.repeat.set(20, 2);
    kerbNormal.anisotropy = 4;
    kerbNormal.needsUpdate = true;

    // Curbs - FIA Crimson and High-Contrast White
    this.kerbRedMat = new THREE.MeshStandardMaterial({
      color: 0xc52026,
      normalMap: kerbNormal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.40,
      metalness: 0.06,
      envMapIntensity: 0.75,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
    });

    this.kerbWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xe2e4ea,
      normalMap: kerbNormal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.40,
      metalness: 0.06,
      envMapIntensity: 0.75,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
    });

    // FIA Precast Concrete Barriers
    this.concreteBarrierMat = new THREE.MeshStandardMaterial({
      map: concretePBR.albedo,
      normalMap: concretePBR.normal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughnessMap: concretePBR.roughness,
      roughness: 0.72,
      metalness: 0.04,
      envMapIntensity: 0.45,
    });

    // Debris Catch Fence Steel
    this.metalFenceMat = new THREE.MeshStandardMaterial({
      color: 0x1e2229,
      metalness: 0.40,
      roughness: 0.65,
      wireframe: false,
    });

    // Tecpro Impact Cushions
    this.tecproRedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.35,
      metalness: 0.05,
    });

    this.tecproWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.05,
    });

    // Architectural Metals
    this.metalDarkMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.85,
      roughness: 0.22,
    });

    this.metalSilverMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.75,
      roughness: 0.35,
    });

    // Specialized Low-Overhead Structural Truss Material
    this.overheadTrussMat = new THREE.MeshStandardMaterial({
      color: 0x1a202c,
      metalness: 0.20,
      roughness: 0.82,
    });

    // Shared starting light emissive material
    this.startLightMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
    });

    // Architectural VIP Glass
    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.35,
      roughness: 0.08,
      transparent: true,
      opacity: 0.55,
    });

    // High-Fidelity Botanical & Foliage Materials
    const barkNormal = TrackTextureFactory.createProceduralBarkNormalTexture();
    const foliageNormal = TrackTextureFactory.createProceduralFoliageNormalTexture();

    this.treeBarkMat = new THREE.MeshStandardMaterial({
      map: TrackTextureFactory.createProceduralBarkTexture(),
      normalMap: barkNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      color: 0x332014,
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.04,
    });

    this.pineFoliageMat = new THREE.MeshStandardMaterial({
      map: TrackTextureFactory.createProceduralPineNeedleTexture(),
      normalMap: foliageNormal,
      normalScale: new THREE.Vector2(0.60, 0.60),
      roughness: 0.90,
      metalness: 0.0,
      vertexColors: true,
      envMapIntensity: 0.06,
      side: THREE.FrontSide,
    });

    this.oakFoliageMat = new THREE.MeshStandardMaterial({
      map: TrackTextureFactory.createProceduralDeciduousFoliageTexture('#041206', '#0e2910'),
      normalMap: foliageNormal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.90,
      metalness: 0.0,
      vertexColors: true,
      envMapIntensity: 0.06,
      side: THREE.FrontSide,
    });

    this.cypressFoliageMat = new THREE.MeshStandardMaterial({
      map: TrackTextureFactory.createProceduralCypressFoliageTexture(),
      normalMap: foliageNormal,
      normalScale: new THREE.Vector2(0.50, 0.50),
      roughness: 0.92,
      metalness: 0.0,
      vertexColors: true,
      envMapIntensity: 0.05,
      side: THREE.FrontSide,
    });

    this.bushFoliageMat = new THREE.MeshStandardMaterial({
      map: TrackTextureFactory.createProceduralDeciduousFoliageTexture('#051508', '#103012'),
      normalMap: foliageNormal,
      normalScale: new THREE.Vector2(0.50, 0.50),
      roughness: 0.90,
      metalness: 0.0,
      vertexColors: true,
      envMapIntensity: 0.05,
      side: THREE.FrontSide,
    });

    this.grassTuftMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.FrontSide,
    });

    // Stadium Floodlight Emissive Lens Material
    this.floodlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffbeb,
      emissiveIntensity: 3.5,
      roughness: 0.1,
    });
  }

  private disposeMaterial(mat: THREE.Material): void {
    const anyMat = mat as any;
    const texProps = [
      'map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap',
      'normalMap', 'displacementMap', 'roughnessMap', 'metalnessMap',
      'alphaMap', 'envMap'
    ];
    for (let i = 0; i < texProps.length; i++) {
      const tex = anyMat[texProps[i]];
      if (tex && typeof tex.dispose === 'function') {
        tex.dispose();
      }
    }
    mat.dispose();
  }

  public dispose(): void {
    const allMats: THREE.Material[] = [
      this.asphaltMat,
      this.kerbRedMat,
      this.kerbWhiteMat,
      this.concreteBarrierMat,
      this.metalFenceMat,
      this.tecproRedMat,
      this.tecproWhiteMat,
      this.grassMat,
      this.gravelMat,
      this.dirtShoulderMat,
      this.treeBarkMat,
      this.pineFoliageMat,
      this.oakFoliageMat,
      this.cypressFoliageMat,
      this.bushFoliageMat,
      this.grassTuftMat,
      this.glassMat,
      this.metalDarkMat,
      this.metalSilverMat,
      this.overheadTrussMat,
      this.startLightMat,
      this.floodlightMat,
    ];
    allMats.forEach((mat) => {
      if (mat) this.disposeMaterial(mat);
    });
  }
}
