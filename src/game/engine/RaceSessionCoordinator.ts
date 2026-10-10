/**
 * RaceSessionCoordinator.ts - Timing, Lap Sectors, DRS and Telemetry Coordinator
 * Tracks lap timings, sector splits, best lap records in localStorage,
 * driver DRS deployment status, and dispatches zero-allocation telemetry packets.
 */

import { ICircuitDefinition } from '../circuits/ICircuit';
import { GameTelemetry } from './EngineTypes';
import { VehiclePhysics } from '../physics/VehiclePhysics';
import { PitStopManager } from '../pit/PitStopManager';
import { EngineSound } from '../audio/EngineSound';
import { CareerRaceManager } from '../career/CareerRaceManager';
import { CarModel } from '../models/CarModel';
import { CameraController } from './CameraController';

export class RaceSessionCoordinator {
  public currentSector = 0;
  public currentLapTime = 0;
  public bestLapTime: number | null = null;
  public lapCount = 1;
  public totalRaceLaps = 5;

  public playerDrsEligible = true;
  public playerInDrsZone = true;
  public lastPlayerDrsDetectionId: string | null = null;

  private telemetryTimer = 0;
  public onTelemetryUpdate: ((t: GameTelemetry) => void) | null = null;
  private _telemetrySubscribers: Array<(t: GameTelemetry) => void> = [];

  private _telemetryPayload: GameTelemetry = {
    speedKmh: 0,
    rpm: 0,
    engineTemp: 90,
    gear: 1,
    health: 100,
    engineHealth: 100,
    suspLeft: 100,
    suspRight: 100,
    lapTime: 0,
    bestLap: null,
    lapCount: 1,
    isDrifting: false,
    isInPit: false,
    pitProgress: 0,
    pitPhase: 'none',
    pitTimeRemaining: 0,
    pitTotalTime: 0,
    radioMessage: null,
    isGreenLightExit: false,
    broadcastCamName: null,
    isMuted: false,
    cameraMode: 'chase',
    cameraDistance: 'medium',
    carName: 'APEX Valkyrie AMR-26',
    isCustomCar: false,
    crewName: 'Scuderia APEX F1 Crew',
    isCustomCrew: false,
    carX: 0,
    carZ: 0,
    carYaw: 0,
    tireCompound: 'medium',
    nextPitTireCompound: 'medium',
    tireWear: [0, 0, 0, 0],
    isPunctured: [false, false, false, false],
    wheelEffectiveGrip: [1, 1, 1, 1],
    wheelGripIndex: [1, 1, 1, 1],
    tireFlatSpot: [0, 0, 0, 0],
    isTireCliffActive: false,
    tireWheelspinActive: false,
    hasAnyPuncture: false,
    isDrsAvailable: false,
    isDrsOpen: false,
    dynamicMaxSpeedKmh: 350,
    isDamageLimiterActive: false,
    structuralIntegrity: 100,
    careerLeaderboard: [],
  };

  constructor(activeCircuit: ICircuitDefinition) {
    this.loadBestLap(activeCircuit.id);
  }

  public loadBestLap(circuitId: string): void {
    try {
      const stored = localStorage.getItem(`apex_best_lap_${circuitId}`);
      this.bestLapTime = stored ? parseFloat(stored) : null;
    } catch {
      this.bestLapTime = null;
    }
  }

  public getTelemetry(): GameTelemetry {
    return this._telemetryPayload;
  }

  public subscribeTelemetry(fn: (t: GameTelemetry) => void): () => void {
    this._telemetrySubscribers.push(fn);
    return () => {
      const idx = this._telemetrySubscribers.indexOf(fn);
      if (idx !== -1) this._telemetrySubscribers.splice(idx, 1);
    };
  }

  public updateLapSector(
    physics: VehiclePhysics,
    activeCircuit: ICircuitDefinition,
    resetDynamicProps?: () => void
  ): void {
    const { x, z } = physics.position;

    if (activeCircuit?.checkSectorProgress) {
      const res = activeCircuit.checkSectorProgress(x, z, this.currentSector);
      if (res.lapCompleted) {
        if (!this.bestLapTime || this.currentLapTime < this.bestLapTime) {
          this.bestLapTime = this.currentLapTime;
          try {
            localStorage.setItem(`apex_best_lap_${activeCircuit.id}`, this.bestLapTime.toString());
          } catch {}
        }
        this.lapCount++;
        this.currentLapTime = 0;
        this.currentSector = 0;
        if (resetDynamicProps) resetDynamicProps();
      } else {
        this.currentSector = res.newSector;
      }
    } else {
      if (this.currentSector === 0 && x > 40 && z < -50) {
        this.currentSector = 1;
      } else if (this.currentSector === 1 && x > 50 && z > 40) {
        this.currentSector = 2;
      } else if (this.currentSector === 2 && x < -40 && z > 50) {
        this.currentSector = 3;
      } else if (this.currentSector === 3 && x < -50 && z < -40) {
        this.currentSector = 4;
      } else if (this.currentSector === 4 && z < -115 && x >= -15 && x <= 20) {
        if (!this.bestLapTime || this.currentLapTime < this.bestLapTime) {
          this.bestLapTime = this.currentLapTime;
        }
        this.lapCount++;
        this.currentLapTime = 0;
        this.currentSector = 0;
        if (resetDynamicProps) resetDynamicProps();
      }
    }
  }

  public updateDRSSystem(
    physics: VehiclePhysics,
    isControlsLocked: boolean,
    pitStopPhase: string,
    brakeInput: number
  ): void {
    if (isControlsLocked || physics.isInPitStop || pitStopPhase !== 'none') {
      physics.isDrsAvailable = false;
      physics.isDrsOpen = false;
      return;
    }

    this.playerDrsEligible = true;
    this.playerInDrsZone = true;
    physics.isDrsAvailable =
      !physics.damage.drsFlapBroken &&
      !physics.damage.rearWingLeftDetached &&
      !physics.damage.rearWingRightDetached;

    // Auto close upon heavy braking or wing damage
    if (brakeInput > 0.05 || !physics.isDrsAvailable) {
      physics.isDrsOpen = false;
    }
  }

  public toggleDRS(
    physics: VehiclePhysics,
    isControlsLocked: boolean,
    brakeInput: number,
    pitStopPhase: string
  ): boolean {
    if (physics.isDrsOpen) {
      physics.isDrsOpen = false;
      return false;
    }

    if (
      !isControlsLocked &&
      brakeInput < 0.05 &&
      !physics.damage.drsFlapBroken &&
      !physics.isInPitStop &&
      pitStopPhase === 'none'
    ) {
      physics.isDrsOpen = true;
      return true;
    }
    return false;
  }

  public dispatchTelemetry(
    rawDt: number,
    physics: VehiclePhysics,
    pitStop: PitStopManager,
    audio: EngineSound,
    carModel: CarModel,
    cameraController: CameraController,
    careerRaceManager: CareerRaceManager,
    activeCircuit: ICircuitDefinition,
    isFreePractice: boolean
  ): void {
    this.telemetryTimer += rawDt;
    if (this.telemetryTimer < 0.050) return;
    this.telemetryTimer = 0;

    const t = this._telemetryPayload;
    const speedMs = Math.abs(physics.speed);

    t.circuitId = activeCircuit.id;
    t.speedKmh = Math.round(speedMs * 3.6);
    t.rpm = Math.round(physics.rpm);
    t.engineTemp = Math.round(physics.engineTemp);
    t.gear = physics.gear;
    t.health = Math.round(physics.damage.overallHealth);
    t.engineHealth = Math.round(physics.damage.engineHealth);
    t.suspLeft = Math.round(physics.damage.suspensionLeft);
    t.suspRight = Math.round(physics.damage.suspensionRight);
    t.lapTime = this.currentLapTime;
    t.bestLap = this.bestLapTime;
    t.lapCount = this.lapCount;
    t.isDrifting = physics.isDrifting;
    t.isInPit = pitStop.phase !== 'none' || physics.isInPitStop;
    t.pitProgress = pitStop.phase !== 'none' ? pitStop.repairProgress : physics.pitRepairProgress;
    t.pitPhase = pitStop.phase;
    t.pitTimeRemaining = Math.max(0, pitStop.totalDuration - pitStop.elapsedTime);
    t.pitTotalTime = pitStop.totalDuration;
    t.radioMessage = pitStop.radioMessage;
    t.isGreenLightExit = pitStop.greenLightAlertTimer > 0;
    t.broadcastCamName = pitStop.broadcastCamName;
    t.isMuted = audio.getMuted();
    t.cameraMode = cameraController.mode;
    t.cameraDistance = cameraController.distance;
    t.carName = carModel.currentModelName;
    t.isCustomCar = carModel.isCustomModel;
    t.crewName = pitStop.currentCrewName;
    t.isCustomCrew = pitStop.isCustomCrew;
    t.carX = physics.position.x;
    t.carZ = physics.position.z;
    t.carYaw = physics.yaw;
    t.tireCompound = physics.tireCompound;
    t.nextPitTireCompound = pitStop.nextTireCompound;

    for (let i = 0; i < 4; i++) {
      t.tireWear[i] = physics.tireWear[i];
      t.isPunctured[i] = physics.isPunctured[i];
      t.wheelEffectiveGrip[i] = physics.wheelEffectiveGrip[i];
      t.wheelGripIndex[i] = physics.wheelGripIndex[i];
      t.tireFlatSpot[i] = physics.tireFlatSpot[i];
    }

    t.isTireCliffActive = physics.isTireCliffActive;
    t.tireWheelspinActive = physics.tireWheelspinActive;
    t.hasAnyPuncture = physics.hasAnyPuncture;
    t.isDrsAvailable = physics.isDrsAvailable;
    t.isDrsOpen = physics.isDrsOpen;
    t.dynamicMaxSpeedKmh = Math.round(physics.dynamicMaxSpeedKmh);
    t.isDamageLimiterActive = physics.isDamageLimiterActive;
    t.structuralIntegrity = physics.structuralIntegrity;
    t.isFreePractice = isFreePractice;
    t.careerLeaderboard = isFreePractice ? [] : careerRaceManager.leaderboard;
    t.careerConfig = isFreePractice ? undefined : careerRaceManager.config;

    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate(t);
    }
    for (let i = 0; i < this._telemetrySubscribers.length; i++) {
      this._telemetrySubscribers[i](t);
    }
  }
}
