import type { Feature, Geometry } from 'geojson'

export type Language = 'sk' | 'en'

export type GameMode =
  | 'countries'
  | 'lakes'
  | 'seas'
  | 'oceans'
  | 'rivers'
  | 'mountains'
  | 'deserts'
  | 'islands'

export type TranslationKey = string

export type LocalizedName = Record<Language, string>

export type GeoPoint = [number, number]

export type GeoRegion = {
  center: GeoPoint
  radiusLon: number
  radiusLat: number
}

export type WaterFeature = {
  id: string
  name: LocalizedName
  lineWidth?: number
  regions?: GeoRegion[]
  paths?: GeoPoint[][]
}

export type CountryFeature = Feature<Geometry, { name?: string }> & {
  id?: string | number
  mapId?: string
}

export type PlayableCountry = {
  id: string
  iso: string
  name: string
  capital: string
  geo: CountryFeature
}

export type CountryGameItem = PlayableCountry & {
  mode: 'countries'
}

export type FeatureGameItem = WaterFeature & {
  mode: Exclude<GameMode, 'countries'>
}

export type GameItem = CountryGameItem | FeatureGameItem

export type AnswerOption = {
  id: string
  name: string
}

export type User = {
  id: string
  email: string
  createdAt: string
  salt: string
  passwordHash: string
}

export type RoundDetail = {
  id: string
  round: number
  mode: GameMode
  question: string
  correctAnswer: string
  correctAnswerId: string
  userAnswer: string | null
  userAnswerId: string | null
  correct: boolean
  responseTimeMs: number
  timeLimitSeconds: number
  failureReason: string | null
}

export type GameResult = {
  id: string
  userId: string
  ownerType: 'user' | 'guest'
  userEmail: string | null
  completedAt: string
  rounds: number
  secondsPerRound: number
  correctAnswers: number
  incorrectAnswers: number
  score: number
  accuracy: number
  durationMs: number
  bestStreak: number
  roundDetails: RoundDetail[]
}

export type AchievementDefinition = {
  id: string
  name: string
  description: string
}

export type Achievement = AchievementDefinition & {
  earned: boolean
  earnedAt: string | null
}

export type EarnedAchievement = AchievementDefinition & {
  earnedAt: string
}

export type GameSettings = {
  secondsPerRound: number
  roundLimit: number
  gameMode: GameMode
}

export type ValidationError =
  | { type: 'number' }
  | { type: 'range'; min: number; max: number }
  | { type: 'mode' }

export type SettingsErrors = Partial<Record<keyof GameSettings, ValidationError>>

export type AuthErrors = Partial<Record<'email' | 'password' | 'form', string>>

