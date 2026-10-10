/**
 * EngineTypes.ts - Shared Engine Types, Contracts and Telemetry Interfaces
 */

import { CircuitId } from '../circuits/ICircuit';
import { TireCompoundType } from '../physics/TireCompound';
import { CareerRaceConfig, DriverLeaderboardEntry } from '../career/CareerTypes';

export type CameraViewMode = 'chase' | 'hood' | 'bumper' | 'orbit';
export type CameraDistanceMode = 'near' | 'medium' | 'far';

export interface GameTelemetry {
  circuitId?: CircuitId;
  speedKmh: number;
  rpm: number;
  engineTemp: number; // Engine core temperature in °C
  gear: number;
  health: number;
  engineHealth: number;
  suspLeft: number;
  suspRight: number;
  lapTime: number;
  bestLap: number | null;
  lapCount: number;
  isDrifting: boolean;
  isInPit: boolean;
  pitProgress: number;
  pitPhase: string;
  pitTimeRemaining: number;
  pitTotalTime: number;
  radioMessage: string | null;
  isGreenLightExit?: boolean;
  broadcastCamName: string | null;
  isMuted: boolean;
  cameraMode: CameraViewMode;
  cameraDistance: CameraDistanceMode;
  carName: string;
  isCustomCar: boolean;
  crewName: string;
  isCustomCrew: boolean;
  carX: number;
  carZ: number;
  carYaw: number;
  tireCompound: TireCompoundType;
  nextPitTireCompound: TireCompoundType;
  tireWear: [number, number, number, number]; // [FL, FR, RL, RR] (0-100%)
  isPunctured: [boolean, boolean, boolean, boolean];
  wheelEffectiveGrip: [number, number, number, number];
  wheelGripIndex: [number, number, number, number]; // 0.0 to 1.0 normalized
  tireFlatSpot: [number, number, number, number]; // 0.0 to 1.0
  isTireCliffActive: boolean;
  tireWheelspinActive: boolean;
  hasAnyPuncture: boolean;
  isDrsAvailable: boolean;
  isDrsOpen: boolean;
  dynamicMaxSpeedKmh: number;
  isDamageLimiterActive: boolean;
  structuralIntegrity: number;
  careerLeaderboard?: DriverLeaderboardEntry[];
  careerConfig?: CareerRaceConfig;
  isFreePractice?: boolean;
}
