import { readJson, writeJson } from './storage'
import type { Achievement, AchievementDefinition, EarnedAchievement, GameResult } from '../types'

const ACHIEVEMENTS_KEY = 'capital-rush-achievements'

type StoredAchievements = Record<string, Record<string, { earnedAt: string }>>

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'first-game',
    name: 'First Game',
    description: 'Finish your first game.',
  },
  {
    id: 'perfect-game',
    name: 'Perfect Game',
    description: 'Answer every round correctly in one game.',
  },
  {
    id: 'fast-thinker',
    name: 'Fast Thinker',
    description: 'Answer a correct round in three seconds or less.',
  },
  {
    id: 'comeback',
    name: 'Comeback',
    description: 'Improve your score compared with the previous game.',
  },
  {
    id: 'streak-master',
    name: 'Streak Master',
    description: 'Reach a streak of five correct answers.',
  },
  {
    id: 'persistent-player',
    name: 'Persistent Player',
    description: 'Finish five games.',
  },
]

export function getAchievements(): StoredAchievements {
  return readJson<StoredAchievements>(ACHIEVEMENTS_KEY, {})
}

export function getAchievementsForOwner(ownerId: string): Achievement[] {
  const stored = getAchievements()[ownerId] ?? {}
  return ACHIEVEMENT_DEFINITIONS.map((achievement) => ({
    ...achievement,
    earned: Boolean(stored[achievement.id]),
    earnedAt: stored[achievement.id]?.earnedAt ?? null,
  }))
}

type EvaluateAchievementsInput = {
  result: GameResult
  ownerResults: GameResult[]
  existingAchievements: Record<string, { earnedAt: string }>
}

export function evaluateAchievements({ result, ownerResults, existingAchievements }: EvaluateAchievementsInput): EarnedAchievement[] {
  const earnedIds = new Set(Object.keys(existingAchievements))
  const newlyEarned: EarnedAchievement[] = []
  const completedResults = [result, ...ownerResults]
  const previousResult = ownerResults[0]

  const checks: Record<string, boolean> = {
    'first-game': completedResults.length >= 1,
    'perfect-game': result.rounds > 0 && result.correctAnswers === result.rounds,
    'fast-thinker': result.roundDetails.some((round) => round.correct && round.responseTimeMs <= 3000),
    comeback: previousResult ? result.score > previousResult.score : false,
    'streak-master': result.bestStreak >= 5,
    'persistent-player': completedResults.length >= 5,
  }

  for (const definition of ACHIEVEMENT_DEFINITIONS) {
    if (checks[definition.id] && !earnedIds.has(definition.id)) {
      newlyEarned.push({
        ...definition,
        earnedAt: result.completedAt,
      })
    }
  }

  return newlyEarned
}

export function saveNewAchievements(ownerId: string, achievements: EarnedAchievement[]): void {
  if (!achievements.length) return

  const stored = getAchievements()
  const ownerAchievements = stored[ownerId] ?? {}
  for (const achievement of achievements) {
    ownerAchievements[achievement.id] = {
      earnedAt: achievement.earnedAt,
    }
  }
  writeJson(ACHIEVEMENTS_KEY, {
    ...stored,
    [ownerId]: ownerAchievements,
  })
}
