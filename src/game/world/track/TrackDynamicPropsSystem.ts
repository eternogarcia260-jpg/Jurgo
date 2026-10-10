/**
 * TrackDynamicPropsSystem.ts - Dynamic Trackside Props & Breakaway Collision Physics
 * Manages breakaway brake distance markers (50m, 100m, 150m, 200m) and corner slalom cones.
 * Features 3-axis ballistic trajectory, ground restitution bounce, aerodynamic angular damping,
 * sub-frame temporal interpolation (syncDynamicPropsVisuals), and zero-allocation scratch math.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DynamicProp } from '../TrackBuilder';

export class TrackDynamicPropsSystem {
  /**
   * Builds corner apex slalom cones and asynchronous GLTF breakaway brake distance markers
   */
  public static buildDynamicProps(
    group: THREE.Group,
    dynamicProps: DynamicProp[]
  ): void {
    let propId = 0;
    const signageGroup = new THREE.Group();
    signageGroup.name = 'PhotorealisticCircuitSignage';
    group.add(signageGroup);

    // 1. Corner Apex Slalom Cones (Fluorescent Orange)
    const conePositions = [
      { x: 92, z: -84 },
      { x: 84, z: 92 },
      { x: -92, z: 84 },
      { x: -84, z: -92 },
    ];

    conePositions.forEach((pos) => {
      const coneGeo = new THREE.ConeGeometry(0.24, 0.65, 10);
      const coneMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        roughness: 0.35,
        metalness: 0.1,
      });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.set(pos.x, 0.325, pos.z);
      coneMesh.castShadow = false;
      signageGroup.add(coneMesh);

      const propObj: DynamicProp = {
        id: propId++,
        type: 'cone',
        mesh: coneMesh,
        position: new THREE.Vector3(pos.x, 0, pos.z),
        velocity: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Vector3(0, 0, 0),
        angularVelocity: new THREE.Vector3(0, 0, 0),
        radius: 0.35,
        height: 0.65,
        mass: 3.5,
        isSleeping: true,
        baseY: 0.325,
        isAirborne: false,
        airborneTimer: 0,
        initialPosition: new THREE.Vector3(pos.x, 0, pos.z),
        initialRotation: new THREE.Vector3(0, 0, 0),
      };
      dynamicProps.push(propObj);
    });

    // 2. Photorealistic FIA Breakaway Brake Distance Markers (200m, 150m, 100m, 50m)
    const gltfLoader = new GLTFLoader();
    const dists = ['200', '150', '100', '50'];
    const loadedMarkerModels: Record<string, THREE.Group> = {};

    let loadedCount = 0;
    dists.forEach((d) => {
      gltfLoader.load(
        `/models/photorealistic_brake_marker_${d}.glb`,
        (gltf) => {
          const model = gltf.scene;
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const m = child as THREE.Mesh;
              m.castShadow = true;
              m.receiveShadow = true;
              if (m.material) {
                (m.material as THREE.Material).side = THREE.DoubleSide;
              }
            }
          });
          loadedMarkerModels[d] = model;
          loadedCount++;
          if (loadedCount === dists.length) {
            setupStraightMarkers();
          }
        },
        undefined,
        (err) => console.error(`Failed to load brake marker ${d}:`, err)
      );
    });

    const setupStraightMarkers = () => {
      const straightApproaches = [
        {
          positions: [
            { x: 10, z: -138.8 },
            { x: 32, z: -138.8 },
            { x: 54, z: -138.8 },
            { x: 76, z: -138.8 },
          ],
          rotY: Math.PI / 2 + 0.22,
        },
        {
          positions: [
            { x: 138.8, z: 10 },
            { x: 138.8, z: 32 },
            { x: 138.8, z: 54 },
            { x: 138.8, z: 76 },
          ],
          rotY: 0 + 0.22,
        },
        {
          positions: [
            { x: -10, z: 138.8 },
            { x: -32, z: 138.8 },
            { x: -54, z: 138.8 },
            { x: -76, z: 138.8 },
          ],
          rotY: -Math.PI / 2 + 0.22,
        },
        {
          positions: [
            { x: -138.8, z: -10 },
            { x: -138.8, z: -32 },
            { x: -138.8, z: -54 },
            { x: -138.8, z: -76 },
          ],
          rotY: Math.PI + 0.22,
        },
      ];

      straightApproaches.forEach((straight) => {
        straight.positions.forEach((pos, idx) => {
          const distLabel = dists[idx];
          const template = loadedMarkerModels[distLabel];
          if (!template) return;

          const markerHolder = new THREE.Group();
          markerHolder.position.set(pos.x, 0, pos.z);
          markerHolder.rotation.y = straight.rotY;
          markerHolder.add(template.clone(true));
          signageGroup.add(markerHolder);

          const propItem: DynamicProp = {
            id: propId++,
            type: 'sign',
            mesh: markerHolder,
            position: new THREE.Vector3(pos.x, 0, pos.z),
            velocity: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Vector3(0, straight.rotY, 0),
            angularVelocity: new THREE.Vector3(0, 0, 0),
            radius: 0.8,
            height: 1.4,
            mass: 14,
            isSleeping: true,
            baseY: 0,
            isAirborne: false,
            airborneTimer: 0,
            initialPosition: new THREE.Vector3(pos.x, 0, pos.z),
            initialRotation: new THREE.Vector3(0, straight.rotY, 0),
          };
          dynamicProps.push(propItem);
        });
      });
    };
  }

  /**
   * Dynamic Prop Physics Simulation with 2.0s - 2.8s smooth scale disappearance lifecycle
   */
  public static updateDynamicProps(dynamicProps: DynamicProp[], dt: number): void {
    const gravity = 22.0;
    const airDrag = 0.982;
    const groundFriction = 0.82;
    const groundAngularFriction = 0.72;
    const airAngularDrag = 0.95;

    for (let i = 0; i < dynamicProps.length; i++) {
      const prop = dynamicProps[i];
      if (!prop.prevPosition) prop.prevPosition = prop.position.clone();
      if (!prop.prevRotation) prop.prevRotation = prop.rotation.clone();
      if (prop.isSleeping) continue;

      prop.prevPosition.copy(prop.position);
      prop.prevRotation.copy(prop.rotation);

      if (prop.isAirborne) {
        prop.airborneTimer = (prop.airborneTimer || 0) + dt;
        if (prop.airborneTimer > 2.0) {
          const fadeProgress = (prop.airborneTimer - 2.0) / 0.8;
          const scale = Math.max(0, 1 - fadeProgress);
          prop.mesh.scale.set(scale, scale, scale);
        }
        if (prop.airborneTimer >= 2.8) {
          prop.mesh.visible = false;
          prop.mesh.scale.set(0.001, 0.001, 0.001);
          prop.isSleeping = true;
          prop.velocity.set(0, 0, 0);
          prop.angularVelocity.set(0, 0, 0);
          continue;
        }
      }

      prop.position.x += prop.velocity.x * dt;
      prop.position.z += prop.velocity.z * dt;
      prop.position.y += prop.velocity.y * dt;

      if (prop.position.y > prop.baseY) {
        prop.velocity.y -= gravity * dt;
        prop.angularVelocity.x *= airAngularDrag;
        prop.angularVelocity.y *= airAngularDrag;
        prop.angularVelocity.z *= airAngularDrag;
      } else {
        prop.position.y = prop.baseY;
        if (prop.velocity.y < -1.0) {
          prop.velocity.y = -prop.velocity.y * 0.32;
        } else {
          prop.velocity.y = 0;
        }
        prop.velocity.x *= groundFriction;
        prop.velocity.z *= groundFriction;

        prop.angularVelocity.x *= groundAngularFriction;
        prop.angularVelocity.y *= groundAngularFriction;
        prop.angularVelocity.z *= groundAngularFriction;
      }

      prop.velocity.x *= airDrag;
      prop.velocity.z *= airDrag;

      prop.rotation.x += prop.angularVelocity.x * dt;
      prop.rotation.y += prop.angularVelocity.y * dt;
      prop.rotation.z += prop.angularVelocity.z * dt;

      const speedSq = prop.velocity.lengthSq();
      const angSpeedSq = prop.angularVelocity.lengthSq();
      if (speedSq < 0.02 && angSpeedSq < 0.02 && prop.position.y <= prop.baseY + 0.05 && !prop.isAirborne) {
        prop.isSleeping = true;
        prop.velocity.set(0, 0, 0);
        prop.angularVelocity.set(0, 0, 0);
      }
    }
  }

  /**
   * Sub-frame temporal interpolation for dynamic props visual meshes (smooth 60/120/144+ FPS)
   */
  public static syncDynamicPropsVisuals(dynamicProps: DynamicProp[], alpha: number = 1.0): void {
    const clampedAlpha = THREE.MathUtils.clamp(alpha, 0, 1);
    for (let i = 0; i < dynamicProps.length; i++) {
      const prop = dynamicProps[i];
      if (prop.isSleeping || !prop.mesh.visible) continue;
      if (prop.prevPosition) {
        prop.mesh.position.lerpVectors(prop.prevPosition, prop.position, clampedAlpha);
      } else {
        prop.mesh.position.copy(prop.position);
      }
      if (prop.prevRotation) {
        prop.mesh.rotation.set(
          THREE.MathUtils.lerp(prop.prevRotation.x, prop.rotation.x, clampedAlpha),
          THREE.MathUtils.lerp(prop.prevRotation.y, prop.rotation.y, clampedAlpha),
          THREE.MathUtils.lerp(prop.prevRotation.z, prop.rotation.z, clampedAlpha)
        );
      } else {
        prop.mesh.rotation.set(prop.rotation.x, prop.rotation.y, prop.rotation.z);
      }
    }
  }

  /**
   * Imparts crash momentum to a breakaway prop and marks as airborne
   */
  public static impartImpulseToProp(
    prop: DynamicProp,
    carVelocity: THREE.Vector3,
    contactNormal: THREE.Vector3
  ): void {
    prop.isSleeping = false;
    prop.isAirborne = true;
    prop.airborneTimer = 0;
    const impactSpeed = carVelocity.length();

    const carDirX = impactSpeed > 0.1 ? carVelocity.x / impactSpeed : contactNormal.x;
    const carDirZ = impactSpeed > 0.1 ? carVelocity.z / impactSpeed : contactNormal.z;

    const deflectX = contactNormal.x;
    const deflectZ = contactNormal.z;

    const forwardImpulse = Math.max(12, impactSpeed * 0.95);
    const deflectImpulse = Math.max(4, impactSpeed * 0.35);

    prop.velocity.x = carDirX * forwardImpulse + deflectX * deflectImpulse;
    prop.velocity.z = carDirZ * forwardImpulse + deflectZ * deflectImpulse;
    prop.velocity.y = Math.min(16, 4.5 + impactSpeed * 0.22);

    const tumblePower = Math.min(14, 4.0 + impactSpeed * 0.2);
    prop.angularVelocity.x = (Math.random() - 0.5) * tumblePower * 2.0;
    prop.angularVelocity.y = (Math.random() - 0.5) * tumblePower * 0.8;
    prop.angularVelocity.z = (Math.random() - 0.5) * tumblePower * 2.0;
  }

  /**
   * Restores all breakaway props to their pristine original positions upon new lap
   */
  public static resetDynamicProps(dynamicProps: DynamicProp[]): void {
    for (let i = 0; i < dynamicProps.length; i++) {
      const prop = dynamicProps[i];
      if (prop.initialPosition) {
        prop.position.copy(prop.initialPosition);
        if (prop.prevPosition) prop.prevPosition.copy(prop.initialPosition);
      }
      if (prop.initialRotation) {
        prop.rotation.copy(prop.initialRotation);
        if (prop.prevRotation) prop.prevRotation.copy(prop.initialRotation);
      }
      prop.velocity.set(0, 0, 0);
      prop.angularVelocity.set(0, 0, 0);
      prop.isSleeping = true;
      prop.isAirborne = false;
      prop.airborneTimer = 0;
      prop.mesh.visible = true;
      prop.mesh.scale.set(1, 1, 1);
      prop.mesh.position.copy(prop.position);
      prop.mesh.rotation.set(prop.rotation.x, prop.rotation.y, prop.rotation.z);
    }
  }
}
