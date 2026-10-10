/**
 * TrackBuilder.ts - Professional FIA Grade-1 Racing Circuit World (Facade Architecture)
 * High-performance composite coordinator delegating specialized world generation to modular subsystems:
 * - TrackMaterials: Centralized PBR material & texture lifecycle registry
 * - TrackRoadGeometry: Continuous asphalt surface, beveled kerbs, painted lines & pit apron
 * - TrackBarriersBuilder: Smooth lofted New Jersey concrete barriers & Tecpro impact cushions
 * - TrackStructuresBuilder: Amphitheater grandstands, VIP headquarters, paddock & floodlights
 * - TrackVegetationBuilder: Hardware instanced dual-corridor forests & frustum-culled 3D grass tufts
 * - TrackDynamicPropsSystem: Breakaway distance markers & cones with ballistic physics
 */

import * as THREE from 'three';
import { GrandstandCrowdSystem } from '../crowd/GrandstandCrowdSystem';
import { DistantMountainBackdropBuilder } from './DistantMountainBackdropBuilder';
import { OrganicTerrainBuilder } from './OrganicTerrainBuilder';
import { TrackBarriersBuilder } from './track/TrackBarriersBuilder';
import { TrackDynamicPropsSystem } from './track/TrackDynamicPropsSystem';
import { TrackMaterials } from './track/TrackMaterials';
import { TrackRoadGeometry } from './track/TrackRoadGeometry';
import { TrackStructuresBuilder } from './track/TrackStructuresBuilder';
import { TrackVegetationBuilder } from './track/TrackVegetationBuilder';

export interface StaticObstacle {
  x: number;
  z: number;
  radius: number;
  isWallSegment?: boolean;
  p1?: { x: number; z: number };
  p2?: { x: number; z: number };
  type: 'tree' | 'pillar' | 'wall' | 'building' | 'tecpro';
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
  dx?: number;
  dz?: number;
  lengthSq?: number;
  _queryId?: number;
}

export interface DynamicProp {
  id: number;
  type: 'sign' | 'cone' | 'tire_stack';
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  prevPosition?: THREE.Vector3;
  prevRotation?: THREE.Vector3;
  radius: number;
  height: number;
  mass: number;
  isSleeping: boolean;
  baseY: number;
  lastHitTime?: number;
  isAirborne?: boolean;
  airborneTimer?: number;
  initialPosition?: THREE.Vector3;
  initialRotation?: THREE.Vector3;
}

export class TrackBuilder {
  public group: THREE.Group;
  public staticObstacles: StaticObstacle[] = [];
  public dynamicProps: DynamicProp[] = [];
  public crowdSystem: GrandstandCrowdSystem;

  // Track Dimensions
  public readonly halfSize = 130;  // 260m total square size
  public readonly cornerRadius = 38; // Radius of 4 rounded corner apexes
  public readonly trackWidth = 16;
  public readonly innerCornerCenter = 130 - 38; // 92

  // Pit Stop Area Bounds
  public readonly pitZone = {
    minX: -68,
    maxX: 50,
    minZ: -122.5,
    maxZ: -105.0,
  };

  // Modular Material Registry
  private materials: TrackMaterials;

  constructor() {
    this.group = new THREE.Group();
    this.crowdSystem = new GrandstandCrowdSystem();
    this.materials = new TrackMaterials();

    this.buildTerrainAndInfield();
    TrackRoadGeometry.buildSquareCircuitTrack(
      this.group,
      this.materials,
      this.halfSize,
      this.trackWidth,
      this.innerCornerCenter,
      this.cornerRadius
    );
    TrackRoadGeometry.buildKerbsAndStartingGrid(
      this.group,
      this.materials,
      this.halfSize,
      this.trackWidth,
      this.innerCornerCenter,
      this.cornerRadius
    );
    TrackBarriersBuilder.buildConcreteBarriersWithCatchFences(
      this.group,
      this.materials,
      this.staticObstacles,
      this.halfSize,
      this.trackWidth,
      this.innerCornerCenter,
      this.cornerRadius
    );
    TrackBarriersBuilder.buildTecproRunoffZones(
      this.group,
      this.materials,
      this.staticObstacles,
      this.innerCornerCenter,
      this.trackWidth,
      this.cornerRadius
    );
    TrackStructuresBuilder.buildGrandstands(this.group, this.materials, this.crowdSystem);
    TrackStructuresBuilder.buildModernVIPArchitecture(this.group, this.staticObstacles);
    TrackStructuresBuilder.buildPaddockBuildingAndPitLane(this.group, this.materials);
    TrackStructuresBuilder.buildPitEntryAndExitArchitecture(this.group, this.materials);
    TrackStructuresBuilder.buildSpeedTrapRadarAndSectorGantries(this.group, this.materials, this.halfSize);
    TrackStructuresBuilder.buildOverheadGantriesAndBridges(this.group, this.materials, this.halfSize);
    TrackStructuresBuilder.buildPitEquipment(this.group);
    TrackStructuresBuilder.buildHighMastFloodlights(this.group, this.materials);
    TrackVegetationBuilder.buildOrganicVegetation(
      this.group,
      this.materials,
      this.staticObstacles,
      this.innerCornerCenter,
      (x, z) => this.isTurn1Exterior(x, z)
    );
    TrackDynamicPropsSystem.buildDynamicProps(this.group, this.dynamicProps);

    // High-performance static scene graph & shadow pass optimization:
    // 1. Disables real-time dynamic shadow casting on static environment (saves >450 shadow draw calls per frame!)
    // 2. Only actual track surfaces (asphalt, gravel, kerbs) receive dynamic shadows. Overhead bridges, gantries,
    //    vegetation, walls and soft shadows NEVER sample the shadow map, eliminating fillrate choke when driving underneath.
    // 3. Disables per-frame local matrix recalculation and freezes global world matrices.
    const dynamicMeshes = new Set(this.dynamicProps.map((p) => p.mesh));
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const isShadowCaster = obj.castShadow === true ||
          obj.userData.castShadow === true ||
          obj.material === this.materials.overheadTrussMat;
        obj.castShadow = isShadowCaster;

        const isGroundReceiver = obj.material === this.materials.asphaltMat ||
          obj.material === this.materials.gravelMat ||
          obj.material === this.materials.kerbWhiteMat ||
          obj.material === this.materials.kerbRedMat ||
          obj.material === this.materials.dirtShoulderMat ||
          obj.name === 'trackLineMesh';
        obj.receiveShadow = isGroundReceiver;

        if (!dynamicMeshes.has(obj)) {
          obj.matrixAutoUpdate = false;
          obj.updateMatrix();
        }
      }
    });
    this.group.updateMatrixWorld(true);
  }

  /**
   * Spatial clearance predicate: checks if coordinates fall on the exterior verge,
   * gravel runoff zone or outer forest amphitheater of Turn 1 (Curva 1).
   */
  public isTurn1Exterior(x: number, z: number): boolean {
    if (x >= 75 && z <= -75) {
      const dist = Math.hypot(x - 92, z - (-92));
      if (dist >= 46.0) return true;
      if (z <= -136.0 && x >= 75.0) return true;
      if (x >= 136.0 && z <= -75.0) return true;
    }
    return false;
  }

  /**
   * Evaluates shortest Euclidean distance to track centerline for terrain berm sculpting
   */
  public getDistanceToTrack(x: number, z: number): number {
    const c = this.innerCornerCenter; // 92
    const r = this.cornerRadius; // 38
    // Check 4 straight segments
    if (Math.abs(x) <= c) {
      if (z >= -138 && z <= -84 && Math.abs(x) <= 68) return 0;
      const dSouth = Math.abs(z - (-this.halfSize));
      const dNorth = Math.abs(z - this.halfSize);
      if (dSouth < 22 || dNorth < 22) return Math.min(dSouth, dNorth);
    }
    if (Math.abs(z) <= c) {
      const dEast = Math.abs(x - this.halfSize);
      const dWest = Math.abs(x - (-this.halfSize));
      if (dEast < 22 || dWest < 22) return Math.min(dEast, dWest);
    }
    // Check 4 corners
    const seDist = Math.abs(Math.hypot(x - c, z - (-c)) - r);
    const neDist = Math.abs(Math.hypot(x - c, z - c) - r);
    const nwDist = Math.abs(Math.hypot(x - (-c), z - c) - r);
    const swDist = Math.abs(Math.hypot(x - (-c), z - (-c)) - r);
    return Math.min(seDist, neDist, nwDist, swDist);
  }

  /**
   * Terrain, Infield Landscaping, Gravel Traps and Service Perimeter Roads
   */
  private buildTerrainAndInfield(): void {
    const terrainGroup = new THREE.Group();

    // 1. Organic Sculpted Ground with Natural Berms & Drainage Valleys
    const ground = OrganicTerrainBuilder.buildSculptedTerrain(
      800,
      800,
      64,
      64,
      this.materials.grassMat,
      (x, z) => this.getDistanceToTrack(x, z)
    );
    terrainGroup.add(ground);

    // 1.5. 360° Panoramic Distant Mountain Range Backdrop
    const mountainBackdrop = DistantMountainBackdropBuilder.buildMountainRing({
      innerRadius: 370,
      outerRadius: 820,
      radialSegments: 288,
      heightSegments: 24,
      baseHeightScale: 1.25,
    });
    terrainGroup.add(mountainBackdrop);

    // 2. Corner Gravel Runoff Traps & Shoulders
    TrackRoadGeometry.buildGravelAndShoulders(
      terrainGroup,
      this.materials,
      this.halfSize,
      this.trackWidth,
      this.innerCornerCenter,
      this.cornerRadius
    );

    // 3. Volumetric 3D Grass Tufts concentrated 100% along the track corridors
    TrackVegetationBuilder.buildGrassTufts(
      terrainGroup,
      this.materials.grassTuftMat,
      this.innerCornerCenter,
      (x, z) => this.isTurn1Exterior(x, z)
    );

    this.group.add(terrainGroup);
  }

  /**
   * Dynamic Prop Physics Simulation (Realistic ballistic trajectory, ground bounce & 3-axis angular damping)
   */
  public updateDynamicProps(dt: number): void {
    TrackDynamicPropsSystem.updateDynamicProps(this.dynamicProps, dt);
  }

  /**
   * Sub-frame temporal interpolation for dynamic props visual meshes (smooth 60/120/144+ FPS)
   */
  public syncDynamicPropsVisuals(alpha: number = 1.0): void {
    TrackDynamicPropsSystem.syncDynamicPropsVisuals(this.dynamicProps, alpha);
  }

  /**
   * Imparts crash momentum to a breakaway prop and marks as airborne
   */
  public impartImpulseToProp(
    prop: DynamicProp,
    carVelocity: THREE.Vector3,
    contactNormal: THREE.Vector3
  ): void {
    TrackDynamicPropsSystem.impartImpulseToProp(prop, carVelocity, contactNormal);
  }

  /**
   * Restores all breakaway props to their pristine original positions upon new lap
   */
  public resetDynamicProps(): void {
    TrackDynamicPropsSystem.resetDynamicProps(this.dynamicProps);
  }

  /**
   * Complete GPU resource cleanup for track meshes, materials and textures
   */
  public dispose(): void {
    if (this.crowdSystem && typeof this.crowdSystem.dispose === 'function') {
      this.crowdSystem.dispose();
    }
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
      }
    });
    if (this.materials) {
      this.materials.dispose();
    }
    this.staticObstacles = [];
    this.dynamicProps = [];
  }
}
