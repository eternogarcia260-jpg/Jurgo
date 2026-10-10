/**
 * RacingGameEngine.ts - Master 3D Game Coordinator & Composite Facade
 * 
 * Orchestrates Scene, PBR Lighting, Soft Shadows, Physics Loop,
 * Collision Detection & Resolution, Multi-Camera Choreography, Audio and Particle Systems.
 * 
 * Modular Subsystems:
 * - CameraController: Chase (Near/Medium/Far), Bonnet, Bumper, Orbit, Pit Broadcast Jib, G-Buffeting.
 * - CollisionSystem: O(1) SpatialHashGrid static barriers, dynamic props, car-to-car dual-sphere solver.
 * - GraphicsPipeline: WebGLRenderer lifecycle, PCFSoft shadows, dynamic sky, sun vector, PBR envmap.
 * - RaceSessionCoordinator: Timing, lap sectors, DRS manual boost, leaderboard, 20Hz zero-GC telemetry.
 */

import * as THREE from 'three';
import { EngineSound } from './audio/EngineSound';
import { CarModel } from './models/CarModel';
import { ParticleSystem } from './particles/ParticleSystem';
import { HeatHazeEffect } from './effects/HeatHazeEffect';
import { SpeedPostEffect } from './effects/SpeedPostEffect';
import { CinematicPostEffect } from './effects/CinematicPostEffect';
import { PitStopManager } from './pit/PitStopManager';
import { CarInputs, VehiclePhysics } from './physics/VehiclePhysics';
import { RivalTelemetryData } from './multiplayer/MultiplayerClient';
import { RivalCarInterpolator } from './multiplayer/RivalCarInterpolator';
import { TireCompoundType } from './physics/TireCompound';
import { CareerRaceManager } from './career/CareerRaceManager';
import { RaceDifficulty, RaceLapOption } from './career/CareerTypes';
import { AICarController } from './ai/AICarController';
import { CircuitId, ICircuitDefinition, ITrackWorld } from './circuits/ICircuit';
import { getCircuit, DEFAULT_CIRCUIT_ID } from './circuits/CircuitRegistry';

import { CameraDistanceMode, CameraViewMode, GameTelemetry } from './engine/EngineTypes';
import { CameraController } from './engine/CameraController';
import { CollisionCarEntity, CollisionSystem } from './engine/CollisionSystem';
import { GraphicsPipeline } from './engine/GraphicsPipeline';
import { RaceSessionCoordinator } from './engine/RaceSessionCoordinator';
import { DynamicSkySystem } from './environment/DynamicSkySystem';

export type { CameraDistanceMode, CameraViewMode, GameTelemetry };

export class RacingGameEngine {
  public static readonly UP_VEC = new THREE.Vector3(0, 1, 0);

  public isFreePractice: boolean = false;
  private container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  // Subsystems
  public graphicsPipeline: GraphicsPipeline;
  public cameraController: CameraController;
  public collisionSystem: CollisionSystem;
  public sessionCoordinator: RaceSessionCoordinator;

  public audio: EngineSound;
  public physics: VehiclePhysics;
  public carModel: CarModel;
  public activeCircuit: ICircuitDefinition;
  public track: ITrackWorld;
  public particles: ParticleSystem;
  public heatHaze: HeatHazeEffect;
  public speedEffect: SpeedPostEffect;
  public cinematicOptics: CinematicPostEffect;
  public pitStop: PitStopManager;
  public careerRaceManager: CareerRaceManager;

  private isDisposed = false;
  public isPaused = false;

  // Timing & Laps
  private clock = new THREE.Clock();
  private lastFrameTimestamp = 0;
  private animFrameId: number | null = null;
  private isRunning = false;

  // Fixed Timestep Loop (60 Hz deterministic physics)
  private readonly FIXED_DT = 1 / 60;
  private physicsAccumulator = 0;

  // Player Controls
  public inputs: CarInputs = {
    throttle: 0,
    brake: 0,
    steering: 0,
    handbrake: false,
    drs: false,
  };

  // Launch procedure & safety
  public isControlsLocked = false;

  // Multiplayer 1v1 State
  public isMultiplayer = false;
  public myPlayerId: 'p1' | 'p2' = 'p1';
  public rivalCarModel: CarModel | null = null;
  public rivalPhysics: VehiclePhysics = new VehiclePhysics(0, 0, 0);
  public rivalInterpolator = new RivalCarInterpolator();
  public rivalTelemetry: RivalTelemetryData | null = null;
  public rivalLapCount = 1;
  public rivalCurrentSector = 0;
  public rivalSpeedKmh = 0;
  public rivalLastUpdateTime = 0;

  // Cached scratch structures for zero memory allocation
  private _scratchPos1 = new THREE.Vector3();
  private _scratchNormal = new THREE.Vector3();
  private _scratchForward = new THREE.Vector3();
  private _scratchCarVel = new THREE.Vector3();
  private _scratchPipeL = new THREE.Vector3();
  private _scratchPipeR = new THREE.Vector3();
  private _scratchRearDir = new THREE.Vector3();
  private _scratchWheelFL = new THREE.Vector3();
  private _scratchWheelFR = new THREE.Vector3();
  private _scratchWheelRL = new THREE.Vector3();
  private _scratchWheelRR = new THREE.Vector3();
  private _fourWheelsArray: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
    this._scratchWheelFL,
    this._scratchWheelFR,
    this._scratchWheelRL,
    this._scratchWheelRR,
  ];
  private _scratchRivalWheelL = new THREE.Vector3();
  private _scratchRivalWheelR = new THREE.Vector3();
  private _scratchLeftWheel = new THREE.Vector3();
  private _scratchRightWheel = new THREE.Vector3();
  private _scratchHoodPos = new THREE.Vector3();

  constructor(container: HTMLElement, circuitId: CircuitId = DEFAULT_CIRCUIT_ID) {
    this.container = container;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    this.activeCircuit = getCircuit(circuitId);

    // 1. Scene setup
    this.scene = new THREE.Scene();

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(58, w / h, 0.1, 2400);

    // 3. Modular Subsystems
    this.graphicsPipeline = new GraphicsPipeline(container, w, h);
    this.cameraController = new CameraController(this.camera);
    this.collisionSystem = new CollisionSystem();
    this.sessionCoordinator = new RaceSessionCoordinator(this.activeCircuit);

    this.audio = new EngineSound();
    const pPose = this.activeCircuit.gridSlots.player;
    this.physics = new VehiclePhysics(pPose.x, pPose.z, pPose.yaw);
    this.carModel = new CarModel();
    this.track = this.activeCircuit.createTrackBuilder();
    this.collisionSystem.buildObstacleSpatialGrid(this.track.staticObstacles);

    this.particles = new ParticleSystem();
    this.heatHaze = new HeatHazeEffect();
    this.speedEffect = new SpeedPostEffect(this.camera);
    this.cinematicOptics = new CinematicPostEffect(this.camera);
    this.pitStop = new PitStopManager();
    this.careerRaceManager = new CareerRaceManager(this.scene);
    this.careerRaceManager.setCircuit(this.activeCircuit);

    this.scene.add(this.track.group);
    this.scene.add(this.carModel.group);
    this.scene.add(this.particles.group);
    this.scene.add(this.heatHaze.group);
    this.scene.add(this.speedEffect.group);
    this.scene.add(this.cinematicOptics.group);
    this.scene.add(this.pitStop.group);
    this.scene.add(this.camera);

    // 4. Lighting & Skybox
    this.graphicsPipeline.setupLighting(this.scene, this.particles, this.cinematicOptics, pPose.x, pPose.z);
    this.graphicsPipeline.setupSkybox(this.scene);

    // 5. Connect physics sound callbacks
    this.physics.onBackfire = (isHighRpm) => {
      this.audio.triggerBackfire(isHighRpm);
      this.carModel.triggerBackfire(isHighRpm);
      const leftPipe = this._scratchPipeL;
      const rightPipe = this._scratchPipeR;
      const rearDir = this._scratchRearDir;
      this.carModel.getExhaustWorldPositions(leftPipe, rightPipe, rearDir);
      this.particles.emitRealisticExhaust(leftPipe, rearDir, 'backfire');
      this.particles.emitRealisticExhaust(rightPipe, rearDir, 'backfire');
    };

    this.physics.onCrash = (force) => {
      this.audio.triggerCrash(force);
    };

    this.physics.onPitFinish = () => {
      this.audio.triggerPitChime();
    };

    this.physics.onTireBlowout = (wheelIdx) => {
      this.audio.triggerTireBlowout();
      this.audio.triggerPitRadio('puncture');
      this.cameraController.addTrauma(0.65);
      this.carModel.getSingleWheelWorldPosition(wheelIdx, this._scratchPos1);
      this.particles.emitSparks(this._scratchPos1, RacingGameEngine.UP_VEC, 30);
      this.particles.emitImpactDust(this._scratchPos1, RacingGameEngine.UP_VEC);
      this.particles.emitTireSmoke(this._scratchPos1, 8, 1.0);
    };

    // 6. Viewport resize listener
    window.addEventListener('resize', this.onResize);

    // Initialize camera position behind car
    this.cameraController.resetPosition(pPose.x, 0.35, pPose.z, pPose.yaw);

    // Pre-warm GPU shaders
    try {
      this.graphicsPipeline.renderer.compile(this.scene, this.camera);
    } catch {}

    // Start render loop
    this.isRunning = true;
    this.clock.start();
    this.loop();
  }

  // --- Dynamic Facade Property Getters/Setters ---
  public get dynamicSky(): DynamicSkySystem {
    return this.graphicsPipeline.dynamicSky;
  }

  public get cameraMode(): CameraViewMode {
    return this.cameraController.mode;
  }
  public set cameraMode(mode: CameraViewMode) {
    this.cameraController.mode = mode;
  }

  public get cameraDistance(): CameraDistanceMode {
    return this.cameraController.distance;
  }
  public set cameraDistance(dist: CameraDistanceMode) {
    this.cameraController.distance = dist;
  }

  public get currentSector(): number {
    return this.sessionCoordinator.currentSector;
  }
  public set currentSector(val: number) {
    this.sessionCoordinator.currentSector = val;
  }

  public get currentLapTime(): number {
    return this.sessionCoordinator.currentLapTime;
  }
  public set currentLapTime(val: number) {
    this.sessionCoordinator.currentLapTime = val;
  }

  public get bestLapTime(): number | null {
    return this.sessionCoordinator.bestLapTime;
  }
  public set bestLapTime(val: number | null) {
    this.sessionCoordinator.bestLapTime = val;
  }

  public get lapCount(): number {
    return this.sessionCoordinator.lapCount;
  }
  public set lapCount(val: number) {
    this.sessionCoordinator.lapCount = val;
  }

  public get totalRaceLaps(): number {
    return this.sessionCoordinator.totalRaceLaps;
  }
  public set totalRaceLaps(val: number) {
    this.sessionCoordinator.totalRaceLaps = val;
  }

  public get playerDrsEligible(): boolean {
    return this.sessionCoordinator.playerDrsEligible;
  }
  public set playerDrsEligible(val: boolean) {
    this.sessionCoordinator.playerDrsEligible = val;
  }

  public get playerInDrsZone(): boolean {
    return this.sessionCoordinator.playerInDrsZone;
  }
  public set playerInDrsZone(val: boolean) {
    this.sessionCoordinator.playerInDrsZone = val;
  }

  public get lastPlayerDrsDetectionId(): string | null {
    return this.sessionCoordinator.lastPlayerDrsDetectionId;
  }
  public set lastPlayerDrsDetectionId(val: string | null) {
    this.sessionCoordinator.lastPlayerDrsDetectionId = val;
  }

  public get onTelemetryUpdate(): ((t: GameTelemetry) => void) | null {
    return this.sessionCoordinator.onTelemetryUpdate;
  }
  public set onTelemetryUpdate(fn: ((t: GameTelemetry) => void) | null) {
    this.sessionCoordinator.onTelemetryUpdate = fn;
  }

  public subscribeTelemetry(fn: (t: GameTelemetry) => void): () => void {
    return this.sessionCoordinator.subscribeTelemetry(fn);
  }

  private onResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.graphicsPipeline.handleResize(w, h, this.camera);
  };

  public setInputs(inputs: Partial<CarInputs>): void {
    Object.assign(this.inputs, inputs);
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.physicsAccumulator = 0;
    if (paused) {
      this.inputs.throttle = 0;
      this.inputs.brake = 0;
      this.inputs.steering = 0;
      this.inputs.handbrake = false;
      this.inputs.drs = false;
    }
  }

  public setCameraMode(mode: CameraViewMode): void {
    this.cameraController.setMode(mode);
  }

  public setCameraDistance(distance: CameraDistanceMode): void {
    this.cameraController.setDistance(distance);
  }

  public nextCameraDistance(): CameraDistanceMode {
    return this.cameraController.nextDistance();
  }

  public nextCameraMode(): CameraViewMode {
    return this.cameraController.nextMode();
  }

  public repairCar(): void {
    this.physics.repairFull();
    this.carModel.repairVisualDamage();
  }

  public getTelemetry(): GameTelemetry {
    return this.sessionCoordinator.getTelemetry();
  }

  public resetCarToTrack(): void {
    const pPose = this.activeCircuit.gridSlots.player;
    this.physics.reset(pPose.x, pPose.z, pPose.yaw);
    this.cameraController.resetPosition(pPose.x, 0.35, pPose.z, pPose.yaw);
  }

  public setCircuit(circuitId: CircuitId): void {
    this.switchCircuit(circuitId);
  }

  public setTireCompound(compound: TireCompoundType): void {
    this.physics.setTireCompound(compound);
    this.pitStop.setNextTireCompound(compound);
    this.carModel.setTireCompoundVisuals(compound);
  }

  public requestPitStop(): void {
    this.triggerPitEntrySequence();
  }

  public setNextPitTireCompound(compound: TireCompoundType): void {
    this.pitStop.setNextTireCompound(compound);
  }

  public toggleAudio(): boolean {
    return this.audio.toggleMute();
  }

  public resumeAudio(): void {
    this.audio.resume();
  }

  public pauseAudio(): void {
    this.audio.pause();
  }

  public toggleDRS(): boolean {
    return this.sessionCoordinator.toggleDRS(
      this.physics,
      this.isControlsLocked,
      this.inputs.brake,
      this.pitStop.phase
    );
  }

  public async loadCustomCar(file: File): Promise<{ success: boolean; name: string; error?: string }> {
    return this.carModel.loadCustomModel(file);
  }

  public async loadCustomRivalCar(file: File): Promise<{ success: boolean; name: string; error?: string }> {
    if (!this.rivalCarModel) {
      this.rivalCarModel = new CarModel();
      this.scene.add(this.rivalCarModel.group);
    }
    return this.rivalCarModel.loadCustomModel(file);
  }

  public restoreDefaultCar(): void {
    this.carModel.restoreDefaultModel();
  }

  public async loadCustomCrew(file: File): Promise<{ success: boolean; name: string; error?: string }> {
    return this.pitStop.loadCustomCrewModel(file);
  }

  public restoreDefaultCrew(): void {
    this.pitStop.restoreDefaultCrew();
  }

  public initMultiplayer(playerId: 'p1' | 'p2', laps: number = 3): void {
    this.isMultiplayer = true;
    this.isFreePractice = false;
    this.myPlayerId = playerId;
    this.totalRaceLaps = laps;
    this.currentLapTime = 0;
    this.lapCount = 1;
    this.currentSector = 0;

    this.careerRaceManager.clearAiGrid();
    this.careerRaceManager.leaderboard = [];

    if (!this.rivalCarModel) {
      this.rivalCarModel = new CarModel();
      this.scene.add(this.rivalCarModel.group);
    }

    const p1Grid = this.activeCircuit.gridSlots.player;
    const p2Grid = this.activeCircuit.gridSlots.ai(1);

    if (playerId === 'p1') {
      this.physics.reset(p1Grid.x, p1Grid.z, p1Grid.yaw);
      this.rivalPhysics.reset(p2Grid.x, p2Grid.z, p2Grid.yaw);
      this.rivalCarModel.group.position.set(p2Grid.x, 0.35, p2Grid.z);
      this.rivalCarModel.group.rotation.set(0, p2Grid.yaw, 0);
      this.rivalInterpolator.reset(p2Grid.x, 0.35, p2Grid.z, p2Grid.yaw);
    } else {
      this.physics.reset(p2Grid.x, p2Grid.z, p2Grid.yaw);
      this.rivalPhysics.reset(p1Grid.x, p1Grid.z, p1Grid.yaw);
      this.rivalCarModel.group.position.set(p1Grid.x, 0.35, p1Grid.z);
      this.rivalCarModel.group.rotation.set(0, p1Grid.yaw, 0);
      this.rivalInterpolator.reset(p1Grid.x, 0.35, p1Grid.z, p1Grid.yaw);
    }

    this.isControlsLocked = true;
    const p = this.physics.position;
    this.cameraController.resetPosition(p.x, 0.35, p.z, this.physics.yaw);
  }

  public updateRivalCar(telemetry: RivalTelemetryData): void {
    if (!this.rivalCarModel) {
      this.rivalCarModel = new CarModel();
      this.scene.add(this.rivalCarModel.group);
    }
    this.rivalTelemetry = telemetry;
    this.rivalLapCount = telemetry.lapCount;
    this.rivalCurrentSector = telemetry.currentSector;
    this.rivalSpeedKmh = telemetry.speedKmh;
    this.rivalLastUpdateTime = performance.now();
    this.rivalInterpolator.pushSnapshot(telemetry);
  }

  public updateRivalCarInterpolation(dt: number): void {
    if (!this.rivalCarModel) return;
    const interp = this.rivalInterpolator.sample(dt);

    this.rivalPhysics.position.x = interp.x;
    this.rivalPhysics.position.y = interp.y;
    this.rivalPhysics.position.z = interp.z;
    this.rivalPhysics.yaw = interp.yaw;
    this.rivalPhysics.pitch = 0;
    this.rivalPhysics.roll = interp.roll;
    this.rivalPhysics.speed = interp.speed;
    this.rivalPhysics.steerAngle = interp.steerAngle;
    this.rivalPhysics.slipRatio = interp.slipRatio;

    this.rivalCarModel.group.position.set(interp.x, interp.y, interp.z);
    this.rivalCarModel.group.rotation.set(0, interp.yaw, interp.roll);

    if (interp.damage) {
      this.rivalPhysics.damage.overallHealth = interp.damage.overallHealth ?? 100;
      this.rivalPhysics.damage.engineHealth = interp.damage.engineHealth ?? 100;
      this.rivalPhysics.damage.frontCrumple = interp.damage.frontCrumple ?? 0;
      this.rivalPhysics.damage.rearCrumple = interp.damage.rearCrumple ?? 0;
      this.rivalPhysics.damage.frontWingLeftDamage = interp.damage.frontWingLeftDamage ?? 0;
      this.rivalPhysics.damage.frontWingRightDamage = interp.damage.frontWingRightDamage ?? 0;
      this.rivalPhysics.damage.wingDamageAmount = interp.damage.wingDamageAmount ?? 0;
      this.rivalPhysics.damage.frontWingLeftDetached = !!interp.damage.frontWingLeftDetached;
      this.rivalPhysics.damage.frontWingRightDetached = !!interp.damage.frontWingRightDetached;
      this.rivalPhysics.damage.rearWingLeftDetached = !!interp.damage.rearWingLeftDetached;
      this.rivalPhysics.damage.rearWingRightDetached = !!interp.damage.rearWingRightDetached;
      this.rivalPhysics.damage.drsFlapBroken = !!interp.damage.drsFlapBroken;
      this.rivalPhysics.damage.wingLoose = !!interp.damage.wingLoose;
    }

    const wheelSpin = interp.speed / 0.33;
    this.rivalCarModel.update(
      interp.steerAngle,
      [wheelSpin, wheelSpin, wheelSpin, wheelSpin],
      interp.brake,
      interp.speedKmh,
      this.rivalPhysics.damage,
      interp.isShifting,
      interp.rpm,
      interp.damage?.wheelSuspensionCompression,
      interp.damage?.isPunctured,
      interp.damage?.tireWear,
      dt
    );

    if (interp.slipRatio > 0.18) {
      const p = this.rivalCarModel.group.position;
      const yaw = interp.yaw;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const rL = this._scratchRivalWheelL.set(p.x - cosY * 0.94 - sinY * 1.35, 0.024, p.z + sinY * 0.94 - cosY * 1.35);
      const rR = this._scratchRivalWheelR.set(p.x + cosY * 0.94 - sinY * 1.35, 0.024, p.z - sinY * 0.94 - cosY * 1.35);
      this.particles.emitTireSmoke(rL, 1, interp.slipRatio);
      this.particles.emitTireSmoke(rR, 1, interp.slipRatio);
      this.particles.addSkidmark(rL, rR, interp.slipRatio);
    }
  }

  public switchCircuit(circuitId: CircuitId): void {
    if (this.activeCircuit && this.activeCircuit.id === circuitId) return;
    const newCircuit = getCircuit(circuitId);
    this.activeCircuit = newCircuit;

    if (this.track) {
      this.scene.remove(this.track.group);
      if (this.track.dispose) {
        this.track.dispose();
      }
    }

    this.track = newCircuit.createTrackBuilder();
    this.collisionSystem.buildObstacleSpatialGrid(this.track.staticObstacles);
    this.scene.add(this.track.group);

    this.careerRaceManager.setCircuit(newCircuit);
    this.sessionCoordinator.currentSector = 0;
    this.sessionCoordinator.currentLapTime = 0;
    this.sessionCoordinator.lapCount = 1;
    this.sessionCoordinator.loadBestLap(newCircuit.id);

    const pPose = newCircuit.gridSlots.player;
    this.physics.reset(pPose.x, pPose.z, pPose.yaw);
    this.syncCarModel(0.016, 1.0);
    this.cameraController.resetPosition(pPose.x, 0.35, pPose.z, pPose.yaw);

    try {
      this.graphicsPipeline.renderer.compile(this.scene, this.camera);
    } catch {}
  }

  public prewarmGPU(): void {
    this.graphicsPipeline.prewarmGPU(this.scene, this.camera);
  }

  public initCareerRace(laps: RaceLapOption, difficulty: RaceDifficulty, startingCompound: TireCompoundType): void {
    this.isMultiplayer = false;
    this.isFreePractice = false;
    this.physics.setTireCompound(startingCompound);
    this.pitStop.setNextTireCompound(startingCompound);
    this.carModel.setTireCompoundVisuals(startingCompound);

    this.careerRaceManager.config.totalLaps = laps;
    this.careerRaceManager.config.difficulty = difficulty;
    this.careerRaceManager.config.startingCompound = startingCompound;
    this.careerRaceManager.config.requiresTwoCompounds = laps >= 20;
    this.careerRaceManager.setCircuit(this.activeCircuit);
    this.careerRaceManager.startRace(this.physics);

    this.lapCount = 1;
    this.currentSector = 0;
    this.currentLapTime = 0;
    this.playerDrsEligible = true;
    this.playerInDrsZone = true;
    this.lastPlayerDrsDetectionId = null;
    this.physics.isDrsAvailable = true;
    this.physics.isDrsOpen = false;
    this.inputs.drs = false;
    this.totalRaceLaps = laps;
    this.sessionCoordinator.loadBestLap(this.activeCircuit.id);

    this.isControlsLocked = true;
    const p = this.physics.position;
    this.cameraController.resetPosition(p.x, 0.35, p.z, this.physics.yaw);
  }

  public initFreePractice(startingCompound: TireCompoundType = 'soft'): void {
    this.isFreePractice = true;
    this.isMultiplayer = false;
    this.isControlsLocked = false;

    this.careerRaceManager.dispose();
    this.careerRaceManager.leaderboard = [];

    const pPose = this.activeCircuit.gridSlots.player;
    this.physics.reset(pPose.x, pPose.z, pPose.yaw);
    this.physics.setTireCompound(startingCompound);
    this.pitStop.setNextTireCompound(startingCompound);
    this.carModel.setTireCompoundVisuals(startingCompound);

    this.currentSector = 0;
    this.currentLapTime = 0;
    this.lapCount = 1;
    this.totalRaceLaps = 999;
    this.playerDrsEligible = true;
    this.playerInDrsZone = false;
    this.lastPlayerDrsDetectionId = null;
    this.physics.isDrsAvailable = false;
    this.physics.isDrsOpen = false;
    this.inputs.drs = false;
    this.sessionCoordinator.loadBestLap(this.activeCircuit.id);

    this.cameraController.resetPosition(pPose.x, 0.35, pPose.z, pPose.yaw);
  }

  public setControlsLocked(locked: boolean): void {
    this.isControlsLocked = locked;
    if (!locked) {
      this.physics.speed = 0.5;
      this.careerRaceManager.onLightsOut();
    }
  }

  public playStartingBeep(_isHighPitch: boolean = false): void {
    this.audio.triggerPitChime();
  }

  // --- Main Render & Simulation Loop ---
  private loop = (timestamp?: number): void => {
    if (!this.isRunning) return;
    this.animFrameId = requestAnimationFrame(this.loop);

    const now = typeof timestamp === 'number' ? timestamp : performance.now();
    let rawDt = this.lastFrameTimestamp > 0 ? (now - this.lastFrameTimestamp) * 0.001 : 1 / 60;
    this.lastFrameTimestamp = now;

    rawDt = Math.min(Math.max(rawDt, 0.001), 0.050);
    const dt = this.isPaused ? 0 : rawDt;

    if (!this.isPaused) {
      const isPitAutomated =
        this.pitStop.phase === 'entry_autopilot' ||
        this.pitStop.phase === 'docking' ||
        this.pitStop.phase === 'jacks_up' ||
        this.pitStop.phase === 'servicing' ||
        this.pitStop.phase === 'jacks_down' ||
        this.pitStop.phase === 'released' ||
        this.pitStop.phase === 'exit_autopilot';

      // 1. Fixed Timestep Physics Integration (60 Hz deterministic lockstep)
      this.physicsAccumulator += dt;
      let substeps = 0;
      const maxSubsteps = 3;

      while (this.physicsAccumulator >= this.FIXED_DT && substeps < maxSubsteps) {
        this.stepPhysics(this.FIXED_DT, isPitAutomated);
        this.track.updateDynamicProps(this.FIXED_DT);
        this.physicsAccumulator -= this.FIXED_DT;
        substeps++;
      }

      if (this.physicsAccumulator > this.FIXED_DT) {
        this.physicsAccumulator = this.FIXED_DT;
      }

      const alpha = Math.min(1.0, Math.max(0.0, this.physicsAccumulator / this.FIXED_DT));

      if (this.isMultiplayer && this.rivalCarModel) {
        this.updateRivalCarInterpolation(dt);
      }

      // 2. Sync 3D Car Model transforms
      this.syncCarModel(dt, alpha);

      if (!this.isFreePractice && !this.isMultiplayer) {
        this.careerRaceManager.updateVisuals(dt, alpha);
      }

      // 3. Dynamic Props sub-frame visual interpolation & Crowd Dynamics
      if (this.track.syncDynamicPropsVisuals) {
        this.track.syncDynamicPropsVisuals(alpha);
      }
      if (this.track.crowdSystem) {
        this.track.crowdSystem.update(dt, this.physics.position, Math.abs(this.physics.speed) * 3.6);
      }

      // 4. Particle System updates
      this.updateParticles(dt);
    }

    // Atmospheric Heat Haze
    this._scratchPos1.set(this.physics.position.x, this.physics.position.y, this.physics.position.z);
    const currentSpeedKmh = Math.abs(this.physics.speed) * 3.6;

    this.heatHaze.update(rawDt, {
      engineTemp: this.physics.engineTemp,
      rpm: this.physics.rpm,
      speedKmh: currentSpeedKmh,
      throttle: this.isPaused ? 0 : this.inputs.throttle,
      carPosition: this._scratchPos1,
      carYaw: this.physics.yaw,
    });

    // High-Speed Optical Motion Streaks & Cinematic Broadcast Optics
    this.speedEffect.update(rawDt, currentSpeedKmh, this.isPaused);
    this.cinematicOptics.update(rawDt, currentSpeedKmh, this.isPaused);

    // Camera Choreography
    this.cameraController.update(
      rawDt,
      this.carModel.group.position,
      this.carModel.group.rotation.y,
      this.physics,
      this.pitStop
    );

    // Audio update
    const speedMs = this.isPaused ? 0 : Math.abs(this.physics.speed);
    this.audio.update(
      this.isPaused ? 800 : this.physics.rpm,
      this.isPaused ? 0 : this.inputs.throttle,
      this.isPaused ? 0 : this.physics.slipRatio,
      speedMs,
      this.physics.damage.engineHealth / 100
    );
    this.audio.updateFlatTireSound(this.physics.hasAnyPuncture, speedMs);

    // Sky dome follow camera
    if (this.graphicsPipeline.dynamicSky) {
      this.graphicsPipeline.dynamicSky.update(rawDt, this.camera.position);
    }

    // Render Scene
    this.graphicsPipeline.render(this.scene, this.camera);

    // Dispatch Telemetry (20 Hz)
    this.sessionCoordinator.dispatchTelemetry(
      rawDt,
      this.physics,
      this.pitStop,
      this.audio,
      this.carModel,
      this.cameraController,
      this.careerRaceManager,
      this.activeCircuit,
      this.isFreePractice
    );
  };

  private stepPhysics(fixedDt: number, isPitAutomated: boolean): void {
    // Safety check: if brakes are applied or flap is damaged, ensure DRS is turned OFF
    if (this.inputs.brake > 0.05 || !this.physics.isDrsAvailable) {
      this.inputs.drs = false;
      this.physics.isDrsOpen = false;
    }

    let activeInputs: CarInputs;
    if (this.isControlsLocked) {
      activeInputs = {
        throttle: this.inputs.throttle,
        brake: 1.0,
        steering: 0,
        handbrake: true,
        drs: false,
      };
    } else if (isPitAutomated) {
      this.inputs.throttle = 0;
      this.inputs.brake = 0;
      this.inputs.steering = 0;
      this.inputs.handbrake = false;
      this.inputs.drs = false;
      activeInputs = {
        throttle: 0,
        brake: 0,
        steering: 0,
        handbrake: false,
        drs: false,
      };
    } else {
      activeInputs = {
        throttle: this.inputs.throttle,
        brake: this.inputs.brake,
        steering: this.inputs.steering,
        handbrake: this.inputs.handbrake,
        drs: this.inputs.drs,
      };
    }

    if (!isPitAutomated) {
      this.physics.update(fixedDt, activeInputs);
    } else {
      this.physics.lateralSpeed = 0;
      this.physics.angularVelocity = 0;
    }

    if (this.isControlsLocked) {
      this.physics.speed = 0;
      this.physics.lateralSpeed = 0;
      this.physics.angularVelocity = 0;
      const gridSlot = this.isMultiplayer
        ? (this.myPlayerId === 'p1' ? this.activeCircuit.gridSlots.player : this.activeCircuit.gridSlots.ai(1))
        : this.activeCircuit.gridSlots.player;
      this.physics.position.x = gridSlot.x;
      this.physics.position.y = 0.35;
      this.physics.position.z = gridSlot.z;
      this.physics.yaw = gridSlot.yaw;
      this.physics.gear = 1;
    }

    if (!isPitAutomated) {
      this.collisionSystem.checkStaticCollisions(
        this.physics,
        fixedDt,
        this.particles,
        this.audio,
        (trauma) => this.cameraController.addTrauma(trauma)
      );

      this.collisionSystem.checkDynamicPropCollisions(
        this.physics,
        this.track.dynamicProps,
        (prop, vel, norm) => this.track.impartImpulseToProp(prop, vel, norm),
        this.audio
      );
    }

    // Pit stop update & Crew animations
    this.pitStop.update(fixedDt, this.physics, this.carModel, this.particles, this.audio, this.inputs);
    this.physics.isLockedInPit = (
      this.pitStop.phase === 'jacks_up' ||
      this.pitStop.phase === 'servicing' ||
      this.pitStop.phase === 'jacks_down'
    );
    this.checkPitStopArea();

    // Lap tracking & DRS
    this.sessionCoordinator.updateLapSector(
      this.physics,
      this.activeCircuit,
      this.track?.resetDynamicProps ? () => this.track.resetDynamicProps!() : undefined
    );

    this.sessionCoordinator.updateDRSSystem(
      this.physics,
      this.isControlsLocked,
      this.pitStop.phase,
      this.inputs.brake
    );

    // Career Race Simulation
    if (!this.isControlsLocked && !this.isFreePractice && !this.isMultiplayer) {
      this.careerRaceManager.update(
        fixedDt,
        this.physics,
        this.sessionCoordinator.lapCount,
        this.sessionCoordinator.currentSector,
        this.sessionCoordinator.currentLapTime,
        this.sessionCoordinator.bestLapTime,
        this.physics.isInPitStop,
        this.particles,
        this.audio,
        this.isControlsLocked
      );
    }

    // Collision detection: AI vs Walls and Car-to-Car
    if (!this.isControlsLocked) {
      this.collisionSystem.checkAiStaticCollisions(this.careerRaceManager.aiCars);
      this.checkAllCarCollisions();
    }

    if (!this.isControlsLocked) {
      this.sessionCoordinator.currentLapTime += fixedDt;
    }
  }

  private checkAllCarCollisions(): void {
    const cars = this.collisionSystem.getCarPool();
    let carCount = 0;

    const pSlot = cars[carCount++];
    pSlot.id = 'player';
    pSlot.physics = this.physics;
    pSlot.isPlayer = true;
    pSlot.carModel = this.carModel;
    pSlot.aiRef = undefined;
    pSlot.isInPit = this.collisionSystem.isVehicleInPitLane(pSlot, this.track.pitZone, this.pitStop.phase);

    if (!this.isFreePractice && !this.isMultiplayer) {
      const aiList = this.careerRaceManager.aiCars;
      for (let i = 0; i < aiList.length; i++) {
        const ai = aiList[i];
        if (!ai.physics) continue;
        const slot = cars[carCount++];
        slot.id = `ai_${i}`;
        slot.physics = ai.physics;
        slot.isPlayer = false;
        slot.carModel = ai.carModel;
        slot.aiRef = ai;
        slot.isInPit = this.collisionSystem.isVehicleInPitLane(slot, this.track.pitZone, this.pitStop.phase);
      }
    }

    if (this.isMultiplayer && this.rivalCarModel && this.rivalTelemetry) {
      const rivalSlot = cars[carCount++];
      rivalSlot.id = 'rival';
      rivalSlot.physics = this.rivalPhysics;
      rivalSlot.isPlayer = false;
      rivalSlot.carModel = this.rivalCarModel;
      rivalSlot.aiRef = undefined;
      rivalSlot.isInPit = this.collisionSystem.isVehicleInPitLane(rivalSlot, this.track.pitZone, this.pitStop.phase);
    }

    this.collisionSystem.checkCarToCarCollisions(
      cars,
      carCount,
      this.particles,
      this.audio,
      (trauma) => this.cameraController.addTrauma(trauma)
    );
  }

  private checkPitStopArea(): void {
    const { x, z } = this.physics.position;
    const pz = this.track.pitZone;
    const inPit = (x >= pz.minX && x <= pz.maxX && z >= pz.minZ && z <= pz.maxZ) || this.pitStop.phase !== 'none';
    this.physics.isInPitStop = inPit;

    if (this.pitStop.phase === 'none' && this.pitStop.cooldownTimer <= 0) {
      const isBeforePitWall = x >= -75.0 && x < -49.0 && z >= -121.0 && z <= -106.0;
      const isInsidePitLane = x >= -49.0 && x <= (this.pitStop.pitBoxX - 1.5) && z >= -120.0 && z <= -106.0;

      if ((isBeforePitWall || isInsidePitLane) && Math.abs(this.physics.speed) < 22.0) {
        this.triggerPitEntrySequence();
      }
    }
  }

  private triggerPitEntrySequence(): void {
    const { x, z } = this.physics.position;
    const inOrNearPitCorridor = x >= -75.0 && x <= 45.0 && z >= -121.0 && z <= -106.0;

    if (inOrNearPitCorridor) {
      this.pitStop.startPitEntryAutopilot(this.physics, this.audio);
    } else {
      this.physics.position.x = -65.0;
      this.physics.position.y = 0.35;
      this.physics.position.z = -114.5;
      this.physics.prevPosition.x = this.physics.position.x;
      this.physics.prevPosition.y = this.physics.position.y;
      this.physics.prevPosition.z = this.physics.position.z;
      this.physics.prevYaw = Math.PI / 2;
      this.physics.yaw = Math.PI / 2;
      this.physics.speed = 16.67;
      this.physics.lateralSpeed = 0;
      this.physics.angularVelocity = 0;
      this.physics.pitch = 0;
      this.physics.roll = 0;
      this.pitStop.startPitEntryAutopilot(this.physics, this.audio);
      this.cameraController.resetPosition(-65.0, 0.35, -114.5, Math.PI / 2);
    }
  }

  private syncCarModel(dt: number, alpha: number = 1.0): void {
    let yawDiff = this.physics.yaw - this.physics.prevYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    const interpYaw = this.physics.prevYaw + yawDiff * alpha;

    const interpX = this.physics.prevPosition.x + (this.physics.position.x - this.physics.prevPosition.x) * alpha;
    const interpY = this.physics.prevPosition.y + (this.physics.position.y - this.physics.prevPosition.y) * alpha;
    const interpZ = this.physics.prevPosition.z + (this.physics.position.z - this.physics.prevPosition.z) * alpha;

    this.carModel.group.position.set(
      interpX,
      interpY + this.pitStop.carElevatedY,
      interpZ
    );
    this.carModel.group.rotation.set(0, interpYaw, this.physics.roll);

    if (this.carModel.contactShadowMesh) {
      this.carModel.contactShadowMesh.rotation.z = -this.physics.roll;
      if (this.pitStop.carElevatedY > 0.001) {
        this.carModel.contactShadowMesh.position.y = 0.008 - this.pitStop.carElevatedY;
        (this.carModel.contactShadowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0.30,
          0.88 - this.pitStop.carElevatedY * 2.2
        );
      } else {
        this.carModel.contactShadowMesh.position.y = 0.008;
        (this.carModel.contactShadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.88;
      }
    }

    const speedKmh = Math.abs(this.physics.speed) * 3.6;
    this.carModel.setDRS(this.physics.isDrsOpen, dt, speedKmh);
    this.carModel.update(
      this.physics.visualSteerAngle,
      this.physics.wheelRotations,
      this.inputs.brake,
      speedKmh,
      this.physics.damage,
      this.physics.isShifting,
      this.physics.rpm,
      this.physics.wheelSuspensionCompression,
      this.physics.isPunctured,
      this.physics.tireWear,
      dt,
      this.inputs.throttle
    );

    this.graphicsPipeline.updateShadowTracking(interpX, interpZ);
  }

  private updateParticles(dt: number): void {
    const carPos = this.carModel.group.position;
    const yaw = this.physics.yaw;
    const speedKmh = Math.abs(this.physics.speed) * 3.6;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    const wFL = this._scratchWheelFL;
    const wFR = this._scratchWheelFR;
    const wRL = this._scratchWheelRL;
    const wRR = this._scratchWheelRR;
    this.carModel.getFourWheelWorldPositions(wFL, wFR, wRL, wRR);

    const carForward = this._scratchForward.set(sinY, 0, cosY);
    const carVel = this._scratchCarVel.set(
      sinY * this.physics.speed + cosY * this.physics.lateralSpeed,
      0,
      cosY * this.physics.speed - sinY * this.physics.lateralSpeed
    );

    // 4-Wheel Skidmarks
    const slips = this.physics.wheelSlipRatios;
    this.particles.addFourWheelSkidmarks(this._fourWheelsArray, slips, carForward);

    // Tire Smoke
    const isDriftingAtSpeed = this.physics.isDrifting && speedKmh > 10;
    const isBurnout = (this.inputs.throttle > 0.82 && speedKmh < 12 && this.physics.gear === 1) || this.physics.tireWheelspinActive;
    const slipRL = Math.max(slips[2], isDriftingAtSpeed ? 0.75 : isBurnout ? 0.95 : 0);
    const slipRR = Math.max(slips[3], isDriftingAtSpeed ? 0.75 : isBurnout ? 0.95 : 0);

    this.particles.emitContinuousTireSmoke(2, wRL, slipRL, carVel, speedKmh, isBurnout);
    this.particles.emitContinuousTireSmoke(3, wRR, slipRR, carVel, speedKmh, isBurnout);

    if (this.physics.isDrifting && speedKmh > 18) {
      if (slips[0] > 0.22) this.particles.emitContinuousTireSmoke(0, wFL, slips[0] * 0.85, carVel, speedKmh, false);
      else this.particles.breakTireSmokeTrail(0);
      if (slips[1] > 0.22) this.particles.emitContinuousTireSmoke(1, wFR, slips[1] * 0.85, carVel, speedKmh, false);
      else this.particles.breakTireSmokeTrail(1);
    } else {
      this.particles.breakTireSmokeTrail(0);
      this.particles.breakTireSmokeTrail(1);
    }

    // Puncture scraping sparks
    if (this.physics.hasAnyPuncture && speedKmh > 2.0) {
      if (this.physics.isPunctured[0]) {
        this.particles.emitContinuousScrapeSparks(wFL, RacingGameEngine.UP_VEC, carVel, dt, 0.75);
        if (Math.random() < 0.25) this.particles.emitTireSmoke(wFL, 1, 0.45, carVel);
      }
      if (this.physics.isPunctured[1]) {
        this.particles.emitContinuousScrapeSparks(wFR, RacingGameEngine.UP_VEC, carVel, dt, 0.75);
        if (Math.random() < 0.25) this.particles.emitTireSmoke(wFR, 1, 0.45, carVel);
      }
      if (this.physics.isPunctured[2]) {
        this.particles.emitContinuousScrapeSparks(wRL, RacingGameEngine.UP_VEC, carVel, dt, 0.75);
        if (Math.random() < 0.25) this.particles.emitTireSmoke(wRL, 1, 0.45, carVel);
      }
      if (this.physics.isPunctured[3]) {
        this.particles.emitContinuousScrapeSparks(wRR, RacingGameEngine.UP_VEC, carVel, dt, 0.75);
        if (Math.random() < 0.25) this.particles.emitTireSmoke(wRR, 1, 0.45, carVel);
      }
    }

    // Engine smoke when degraded
    if (this.physics.damage.engineHealth < 45) {
      const hoodPos = this._scratchHoodPos.set(
        carPos.x + sinY * 1.45,
        carPos.y + 0.55,
        carPos.z + cosY * 1.45
      );
      this.particles.emitEngineDamageSmoke(hoodPos, this.physics.damage.engineHealth);
    }

    // Front wing scraping
    const { leftScraping, rightScraping } = this.carModel.getFrontWingScrapeWorldPositions(
      this._scratchLeftWheel,
      this._scratchRightWheel
    );

    if (speedKmh > 20) {
      this._scratchNormal.set(0, 1, 0);
      let maxWingScrape = 0;
      if (leftScraping) {
        const lIntensity = Math.min(1.0, (this.physics.damage.frontWingLeftDamage || 0.4) * 1.3 * (speedKmh / 90));
        this.particles.emitContinuousScrapeSparks(this._scratchLeftWheel, this._scratchNormal, carVel, dt, lIntensity);
        maxWingScrape = Math.max(maxWingScrape, lIntensity);
      }
      if (rightScraping) {
        const rIntensity = Math.min(1.0, (this.physics.damage.frontWingRightDamage || 0.4) * 1.3 * (speedKmh / 90));
        this.particles.emitContinuousScrapeSparks(this._scratchRightWheel, this._scratchNormal, carVel, dt, rIntensity);
        maxWingScrape = Math.max(maxWingScrape, rIntensity);
      }
      if (maxWingScrape > 0.05) {
        this.audio.updateScrape(Math.max(this.collisionSystem.currentScrapeIntensity, maxWingScrape), speedKmh);
      }
    }

    // Underbody Titanium Skid Block Sparks
    const avgSuspensionComp = (
      this.physics.wheelSuspensionCompression[0] +
      this.physics.wheelSuspensionCompression[1] +
      this.physics.wheelSuspensionCompression[2] +
      this.physics.wheelSuspensionCompression[3]
    ) * 0.25;

    const highSpeedBottoming = (speedKmh > 210) ? Math.pow((speedKmh - 210) / 120, 1.4) * 0.85 : 0;
    const compressionBottoming = (avgSuspensionComp > 0.45 && speedKmh > 110) ? (avgSuspensionComp - 0.45) * 1.5 : 0;
    const brakeDiveBottoming = (this.inputs.brake > 0.60 && speedKmh > 160) ? 0.45 : 0;
    const totalPlankScrape = Math.max(highSpeedBottoming, compressionBottoming, brakeDiveBottoming);

    if (totalPlankScrape > 0.08) {
      this.carModel.getUnderbodyPlankWorldPosition(this._scratchPos1, this._scratchRearDir);
      this.particles.emitUnderbodyTitaniumSparks(
        this._scratchPos1,
        this._scratchRearDir,
        carVel,
        dt,
        totalPlankScrape
      );
    }

    // Aerodynamic slipstream & vortices
    this.particles.update(dt, carPos, carForward, carVel);

    // Wingtip vortices ribbons
    const leftWingtip = this._scratchLeftWheel;
    const rightWingtip = this._scratchRightWheel;
    const rearDir = this._scratchRearDir;
    this.carModel.getWingtipWorldPositions(leftWingtip, rightWingtip, rearDir);
    this.particles.updateWingtipVortices(leftWingtip, rightWingtip, rearDir, speedKmh, dt);
  }

  public dispose(): void {
    this.isDisposed = true;
    this.isRunning = false;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    window.removeEventListener('resize', this.onResize);

    CarModel.clearTireTextureCache();

    if (this.track && typeof this.track.dispose === 'function') {
      this.track.dispose();
    }
    if (this.carModel && typeof this.carModel.dispose === 'function') {
      this.carModel.dispose();
    }
    if (this.rivalCarModel && typeof this.rivalCarModel.dispose === 'function') {
      this.rivalCarModel.dispose();
    }
    if (this.particles && typeof this.particles.dispose === 'function') {
      this.particles.dispose();
    }
    if (this.pitStop && typeof this.pitStop.dispose === 'function') {
      this.pitStop.dispose();
    }
    if (this.careerRaceManager && typeof this.careerRaceManager.dispose === 'function') {
      this.careerRaceManager.dispose();
    }
    if (this.speedEffect && typeof this.speedEffect.dispose === 'function') {
      this.speedEffect.dispose();
    }
    if (this.cinematicOptics && typeof this.cinematicOptics.dispose === 'function') {
      this.cinematicOptics.dispose();
    }
    if (this.heatHaze && typeof this.heatHaze.dispose === 'function') {
      this.heatHaze.dispose();
    }
    if (this.audio && typeof this.audio.dispose === 'function') {
      this.audio.dispose();
    }
    if (this.graphicsPipeline) {
      this.graphicsPipeline.dispose(this.scene);
    }
  }
}
