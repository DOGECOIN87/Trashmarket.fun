export interface GameConfig {
  debugEmptyPool: boolean;
  debugAutoplay: boolean;
  debugMaxSpeed: boolean;
  debugColliders: boolean;
  debugHideCabinet: boolean;
  debugPolygons: boolean;
  debugControls: boolean;
  debugFps: boolean;
}

export interface GameState {
  score: number;
  balance: number;
  netProfit: number;
  fps: number;
  isPaused: boolean;
}

export type GameEventCallback = (state: Partial<GameState>) => void;