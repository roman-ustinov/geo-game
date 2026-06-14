import { beforeEach, describe, expect, it } from 'vitest'
import { getUsers, loginUser, logoutUser, registerUser, validateCredentials } from './authService'
import { evaluateAchievements } from './achievementService'
import { buildGameResult, getResultsForOwner, saveGameResult } from './resultsService'
import { validateGameSettings } from './settingsService'
import { PLAYABLE_COUNTRIES, WORLD_FEATURES } from './countryDataset'
import { WATER_FEATURES_BY_MODE, getWaterFeatureDisplayName, getWaterFeatures } from './waterFeatures'
import type { GameResult, GameSettings, RoundDetail, User } from '../types'

const testUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'a@example.com',
  createdAt: '2026-06-13T09:59:00.000Z',
  salt: 'salt',
  passwordHash: 'hash',
  ...overrides,
})

const roundDetail = (overrides: Partial<RoundDetail> = {}): RoundDetail => ({
  id: 'round-1',
  round: 1,
  mode: 'countries',
  question: 'Paris',
  correctAnswer: 'France',
  correctAnswerId: '250',
  userAnswer: 'France',
  userAnswerId: '250',
  correct: true,
  responseTimeMs: 2000,
  timeLimitSeconds: 10,
  failureReason: null,
  ...overrides,
})

const gameResult = (overrides: Partial<GameResult> = {}): GameResult => ({
  id: 'game-1',
  userId: 'user-1',
  ownerType: 'user',
  userEmail: 'a@example.com',
  completedAt: '2026-06-13T10:00:00.000Z',
  rounds: 5,
  secondsPerRound: 10,
  correctAnswers: 5,
  incorrectAnswers: 0,
  score: 5,
  accuracy: 100,
  durationMs: 20000,
  bestStreak: 5,
  roundDetails: [roundDetail()],
  ...overrides,
})

beforeEach(() => {
  window.localStorage.clear()
})

describe('settings validation', () => {
  it('accepts settings inside allowed ranges', () => {
    expect(validateGameSettings({ secondsPerRound: 10, roundLimit: 10, gameMode: 'countries' })).toEqual({})
  })

  it('rejects time and round edge cases outside allowed ranges', () => {
    expect(validateGameSettings({ secondsPerRound: 0, roundLimit: 0, gameMode: 'countries' })).toEqual({
      secondsPerRound: { type: 'range', min: 5, max: 60 },
      roundLimit: { type: 'range', min: 1, max: 30 },
    })
  })

  it('rejects non-numeric settings values', () => {
    expect(validateGameSettings({ secondsPerRound: Number.NaN, roundLimit: Number.NaN, gameMode: 'countries' })).toEqual({
      secondsPerRound: { type: 'number' },
      roundLimit: { type: 'number' },
    })
  })

  it('rejects decimal settings values', () => {
    expect(validateGameSettings({ secondsPerRound: 10.5, roundLimit: 4.2, gameMode: 'countries' })).toEqual({
      secondsPerRound: { type: 'number' },
      roundLimit: { type: 'number' },
    })
  })

  it('rejects unknown game modes', () => {
    expect(validateGameSettings({ secondsPerRound: 10, roundLimit: 10, gameMode: 'canyons' } as unknown as GameSettings)).toEqual({
      gameMode: { type: 'mode' },
    })
  })
})

describe('country dataset', () => {
  it('uses a full world-scale dataset instead of the old small manual list', () => {
    expect(PLAYABLE_COUNTRIES.length).toBeGreaterThanOrEqual(176)
    expect(WORLD_FEATURES.filter((country) => country.mapId).length).toBeGreaterThanOrEqual(177)
    expect(PLAYABLE_COUNTRIES.map((country) => country.capital)).toEqual(expect.arrayContaining([
      'Pristina',
      'North Nicosia',
      'Hargeisa',
    ]))
  })
})

describe('water feature datasets', () => {
  it('provides selectable lake, sea, and ocean features', () => {
    expect(WATER_FEATURES_BY_MODE.lakes.length).toBeGreaterThanOrEqual(12)
    expect(WATER_FEATURES_BY_MODE.seas.length).toBeGreaterThanOrEqual(12)
    expect(WATER_FEATURES_BY_MODE.oceans.map((feature) => feature.id)).toEqual(expect.arrayContaining([
      'pacific-ocean',
      'atlantic-ocean',
      'indian-ocean',
      'southern-ocean',
      'arctic-ocean',
    ]))
  })

  it('provides additional geographic game modes', () => {
    expect(WATER_FEATURES_BY_MODE.rivers.length).toBeGreaterThanOrEqual(8)
    expect(WATER_FEATURES_BY_MODE.mountains.length).toBeGreaterThanOrEqual(8)
    expect(WATER_FEATURES_BY_MODE.deserts.length).toBeGreaterThanOrEqual(8)
    expect(WATER_FEATURES_BY_MODE.islands.length).toBeGreaterThanOrEqual(8)
    expect(WATER_FEATURES_BY_MODE.rivers.some((feature) => feature.paths?.length)).toBe(true)
  })

  it('localizes water feature names', () => {
    const oceans = getWaterFeatures('oceans')
    const pacific = oceans.find((feature) => feature.id === 'pacific-ocean')
    const rivers = getWaterFeatures('rivers')
    const danube = rivers.find((feature) => feature.id === 'danube-river')

    expect(pacific).toBeDefined()
    expect(danube).toBeDefined()
    expect(getWaterFeatureDisplayName(pacific!, 'sk')).toBe('Tichý oceán')
    expect(getWaterFeatureDisplayName(pacific!, 'en')).toBe('Pacific Ocean')
    expect(getWaterFeatureDisplayName(danube!, 'sk')).toBe('Dunaj')
  })
})

describe('local auth service', () => {
  it('validates invalid emails and short passwords', () => {
    expect(validateCredentials('bad-email', 'short')).toEqual({
      email: 'Enter a valid email address.',
      password: 'Password must have at least 8 characters.',
    })
  })

  it('registers, hashes passwords, logs in, rejects duplicates, and logs out', async () => {
    const registered = await registerUser('Player@Example.com', 'safe-pass-123')
    expect(registered.ok).toBe(true)

    const users = getUsers()
    expect(users).toHaveLength(1)
    expect(users[0].email).toBe('player@example.com')
    expect(users[0].passwordHash).not.toBe('safe-pass-123')
    expect(users[0].salt).toBeTruthy()

    const duplicate = await registerUser('player@example.com', 'safe-pass-123')
    expect(duplicate.ok).toBe(false)
    if (!duplicate.ok) expect(duplicate.errors.email).toContain('already exists')

    logoutUser()
    const login = await loginUser('player@example.com', 'safe-pass-123')
    expect(login.ok).toBe(true)

    const failedLogin = await loginUser('player@example.com', 'wrong-pass')
    expect(failedLogin.ok).toBe(false)
  })
})

describe('game results', () => {
  it('builds and stores a complete result with round details', () => {
    const result = buildGameResult({
      user: testUser(),
      guestId: 'guest-1',
      rounds: 2,
      secondsPerRound: 10,
      correctAnswers: 1,
      incorrectAnswers: 1,
      bestStreak: 1,
      startedAt: '2026-06-13T10:00:00.000Z',
      completedAt: '2026-06-13T10:00:20.000Z',
      roundDetails: [
        roundDetail(),
        roundDetail({
          id: 'round-2',
          round: 2,
          question: 'Rome',
          correctAnswer: 'Italy',
          correctAnswerId: '380',
          userAnswer: null,
          userAnswerId: null,
          correct: false,
          responseTimeMs: 10000,
          failureReason: 'timeout',
        }),
      ],
    })

    expect(result.accuracy).toBe(50)
    expect(result.durationMs).toBe(20000)
    expect(result.roundDetails[1].failureReason).toBe('timeout')

    saveGameResult(result)
    expect(getResultsForOwner('user-1')).toHaveLength(1)
  })
})

describe('achievement logic', () => {
  it('unlocks first, perfect, fast, streak, and persistent achievements', () => {
    const result = gameResult({
      rounds: 5,
      correctAnswers: 5,
      score: 5,
      bestStreak: 5,
      roundDetails: [
        roundDetail({ responseTimeMs: 2500 }),
        roundDetail({ id: 'round-2', round: 2, responseTimeMs: 4000 }),
      ],
    })
    const previous = Array.from({ length: 4 }, (_, index) => gameResult({ id: `old-${index}`, score: 1 }))

    const unlocked = evaluateAchievements({
      result,
      ownerResults: previous,
      existingAchievements: {},
    }).map((achievement) => achievement.id)

    expect(unlocked).toEqual(expect.arrayContaining([
      'first-game',
      'perfect-game',
      'fast-thinker',
      'streak-master',
      'persistent-player',
    ]))
  })

  it('unlocks comeback only when score improves from previous game', () => {
    const unlocked = evaluateAchievements({
      result: gameResult({
        rounds: 5,
        correctAnswers: 3,
        score: 3,
        bestStreak: 2,
        roundDetails: [],
      }),
      ownerResults: [gameResult({ score: 2 })],
      existingAchievements: { 'first-game': { earnedAt: 'old' } },
    }).map((achievement) => achievement.id)

    expect(unlocked).toContain('comeback')
  })
})
