import { readJson, writeJson } from './storage'
import type { GameResult, RoundDetail, User } from '../types'

const RESULTS_KEY = 'capital-rush-results'
const GUEST_KEY = 'capital-rush-guest-id'

export function getGuestId(): string {
  const guestId = `guest-${crypto.randomUUID()}`
  try {
    const existing = window.localStorage.getItem(GUEST_KEY)
    if (existing) return existing
    window.localStorage.setItem(GUEST_KEY, guestId)
  } catch {
    // ponytail: storage may be unavailable in private/locked-down browsers.
  }
  return guestId
}

export function getResults(): GameResult[] {
  return readJson<GameResult[]>(RESULTS_KEY, [])
}

export function getResultsForOwner(ownerId: string): GameResult[] {
  return getResults()
    .filter((result) => result.userId === ownerId)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
}

export function saveGameResult(result: GameResult): GameResult {
  const results = getResults()
  writeJson(RESULTS_KEY, [result, ...results])
  return result
}

type BuildGameResultInput = {
  user: User | null
  guestId: string
  rounds: number
  secondsPerRound: number
  correctAnswers: number
  incorrectAnswers: number
  bestStreak: number
  roundDetails: RoundDetail[]
  startedAt: string
  completedAt?: string
}

export function buildGameResult({
  user,
  guestId,
  rounds,
  secondsPerRound,
  correctAnswers,
  incorrectAnswers,
  bestStreak,
  roundDetails,
  startedAt,
  completedAt = new Date().toISOString(),
}: BuildGameResultInput): GameResult {
  const accuracy = rounds > 0 ? Math.round((correctAnswers / rounds) * 100) : 0
  const durationMs = Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime())

  return {
    id: `game-${crypto.randomUUID()}`,
    userId: user?.id ?? guestId,
    ownerType: user ? 'user' : 'guest',
    userEmail: user?.email ?? null,
    completedAt,
    rounds,
    secondsPerRound,
    correctAnswers,
    incorrectAnswers,
    score: correctAnswers,
    accuracy,
    durationMs,
    bestStreak,
    roundDetails,
  }
}
