import type { GameMode, GameSettings, SettingsErrors } from '../types'

export const TIME_LIMITS = { min: 5, max: 60 }
export const ROUND_LIMITS = { min: 1, max: 30 }
export const GAME_MODES = ['countries', 'lakes', 'seas', 'oceans', 'rivers', 'mountains', 'deserts', 'islands'] as const satisfies readonly GameMode[]
export const DEFAULT_SETTINGS: GameSettings = { secondsPerRound: 10, roundLimit: 10, gameMode: 'countries' }

export function isGameMode(value: unknown): value is GameMode {
  return typeof value === 'string' && GAME_MODES.includes(value as GameMode)
}

export function validateGameSettings(settings: GameSettings): SettingsErrors {
  const errors: SettingsErrors = {}
  if (!Number.isFinite(settings.secondsPerRound) || !Number.isInteger(settings.secondsPerRound)) {
    errors.secondsPerRound = { type: 'number' }
  } else if (settings.secondsPerRound < TIME_LIMITS.min || settings.secondsPerRound > TIME_LIMITS.max) {
    errors.secondsPerRound = { type: 'range', ...TIME_LIMITS }
  }
  if (!Number.isFinite(settings.roundLimit) || !Number.isInteger(settings.roundLimit)) {
    errors.roundLimit = { type: 'number' }
  } else if (settings.roundLimit < ROUND_LIMITS.min || settings.roundLimit > ROUND_LIMITS.max) {
    errors.roundLimit = { type: 'range', ...ROUND_LIMITS }
  }
  if (!GAME_MODES.includes(settings.gameMode)) {
    errors.gameMode = { type: 'mode' }
  }
  return errors
}
