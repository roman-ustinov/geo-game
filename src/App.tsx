import { type CSSProperties, type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { geoEqualEarth, geoPath } from 'd3-geo'
import {
  Crosshair,
  LogOut,
  MapPinned,
  Monitor,
  Moon,
  Mountain,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Settings2,
  Sun,
  TimerReset,
  Trophy,
  User,
  Volume2,
  VolumeX,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import './App.css'
import { LANGUAGES, interpolate, loadTranslations, type TranslationDictionary } from './translations'
import { AppDialog } from './components/AppDialog'
import { usePersistentState } from './hooks/usePersistentState'
import { getCurrentUser, loginUser, logoutUser, registerUser } from './services/authService'
import { getAchievementsForOwner, getAchievements, evaluateAchievements, saveNewAchievements } from './services/achievementService'
import { getCapitalDisplayName } from './services/capitalNames'
import { BORDERS_GEO, PLAYABLE_COUNTRIES, WORLD_FEATURES, getCountryDisplayName } from './services/countryDataset'
import { buildGameResult, getGuestId, getResultsForOwner, saveGameResult } from './services/resultsService'
import { DEFAULT_SETTINGS, GAME_MODES, isGameMode, validateGameSettings } from './services/settingsService'
import { getWaterFeatureDisplayName, getWaterFeatures } from './services/waterFeatures'
import type {
  AnswerOption,
  AuthErrors,
  CountryFeature,
  EarnedAchievement,
  FeatureGameItem,
  GameItem,
  GameMode,
  GameSettings,
  GeoPoint,
  GeoRegion,
  Language,
  RoundDetail,
  User as AppUser,
  ValidationError,
  WaterFeature,
} from './types'

const WIDTH = 1200
const HEIGHT = 620
// Equal Earth keeps country proportions recognizable while still fitting the whole world in one SVG.
const PROJECTION = geoEqualEarth().fitExtent([[18, 18], [WIDTH - 18, HEIGHT - 18]], { type: 'Sphere' })
const PATH = geoPath(PROJECTION)

type Phase = 'setup' | 'playing' | 'paused' | 'finished'
type Flash = 'start' | 'correct' | 'wrong' | 'timeout' | null
type ActiveDialog = 'settings' | 'auth' | 'profile' | null
type AuthMode = 'login' | 'register'
type ThemeMode = 'auto' | 'light' | 'dark'
type RoundResolveMode = 'answer' | 'timeout'
type AudioCue = 'start' | 'correct' | 'wrong' | 'timeout'
type AudioPlayer = (type: AudioCue) => void
type RoundResult = { type: Exclude<AudioCue, 'start'>; correctAnswer: string }
type CssVars = CSSProperties & Record<`--${string}`, string | number>

type GameModeMeta = Record<GameMode, {
  icon: LucideIcon
  labelKey: keyof TranslationDictionary
  promptKey: keyof TranslationDictionary
  targetLabelKey: keyof TranslationDictionary
  setupHintKey: keyof TranslationDictionary
  questionHintKey: keyof TranslationDictionary
  helperKey: keyof TranslationDictionary
  chooseKey: keyof TranslationDictionary
  selectTitleKey: keyof TranslationDictionary
}>

function shuffle<T>(list: readonly T[]): T[] {
  return [...list].sort(() => Math.random() - 0.5)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function createAudioPlayer(enabled: boolean): AudioPlayer {
  if (!enabled) return () => {}

  return (type) => {
    // Sounds are synthesized on demand, so the game ships without extra audio assets.
    const AudioContext = window.AudioContext || (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext
    if (!AudioContext) return

    const context = new AudioContext()
    const gain = context.createGain()
    const oscillator = context.createOscillator()
    oscillator.type = type === 'wrong' ? 'sawtooth' : 'sine'
    oscillator.frequency.value = type === 'correct' ? 740 : type === 'timeout' ? 180 : 420
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(type === 'correct' ? 0.18 : 0.12, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.26)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.28)
  }
}

const GAME_MODE_META: GameModeMeta = {
  countries: {
    icon: MapPinned,
    labelKey: 'modeCountries',
    promptKey: 'findCountry',
    targetLabelKey: 'capitalCity',
    setupHintKey: 'setupHintCountries',
    questionHintKey: 'questionHintCountries',
    helperKey: 'helperCountries',
    chooseKey: 'chooseCountry',
    selectTitleKey: 'selectCountry',
  },
  lakes: {
    icon: Waves,
    labelKey: 'modeLakes',
    promptKey: 'findLake',
    targetLabelKey: 'lakeName',
    setupHintKey: 'setupHintWater',
    questionHintKey: 'questionHintLake',
    helperKey: 'helperLake',
    chooseKey: 'chooseLake',
    selectTitleKey: 'selectLake',
  },
  seas: {
    icon: Waves,
    labelKey: 'modeSeas',
    promptKey: 'findSea',
    targetLabelKey: 'seaName',
    setupHintKey: 'setupHintWater',
    questionHintKey: 'questionHintSea',
    helperKey: 'helperSea',
    chooseKey: 'chooseSea',
    selectTitleKey: 'selectSea',
  },
  oceans: {
    icon: Waves,
    labelKey: 'modeOceans',
    promptKey: 'findOcean',
    targetLabelKey: 'oceanName',
    setupHintKey: 'setupHintWater',
    questionHintKey: 'questionHintOcean',
    helperKey: 'helperOcean',
    chooseKey: 'chooseOcean',
    selectTitleKey: 'selectOcean',
  },
  rivers: {
    icon: Waves,
    labelKey: 'modeRivers',
    promptKey: 'findRiver',
    targetLabelKey: 'riverName',
    setupHintKey: 'setupHintNatural',
    questionHintKey: 'questionHintRiver',
    helperKey: 'helperRiver',
    chooseKey: 'chooseRiver',
    selectTitleKey: 'selectRiver',
  },
  mountains: {
    icon: Mountain,
    labelKey: 'modeMountains',
    promptKey: 'findMountain',
    targetLabelKey: 'mountainName',
    setupHintKey: 'setupHintNatural',
    questionHintKey: 'questionHintMountain',
    helperKey: 'helperMountain',
    chooseKey: 'chooseMountain',
    selectTitleKey: 'selectMountain',
  },
  deserts: {
    icon: Sun,
    labelKey: 'modeDeserts',
    promptKey: 'findDesert',
    targetLabelKey: 'desertName',
    setupHintKey: 'setupHintNatural',
    questionHintKey: 'questionHintDesert',
    helperKey: 'helperDesert',
    chooseKey: 'chooseDesert',
    selectTitleKey: 'selectDesert',
  },
  islands: {
    icon: MapPinned,
    labelKey: 'modeIslands',
    promptKey: 'findIsland',
    targetLabelKey: 'islandName',
    setupHintKey: 'setupHintNatural',
    questionHintKey: 'questionHintIsland',
    helperKey: 'helperIsland',
    chooseKey: 'chooseIsland',
    selectTitleKey: 'selectIsland',
  },
}

function TargetName({ name }: { name: string }) {
  const words = name.split(/\s+/).filter(Boolean)
  const maxChars = Math.max(...words.map((word) => word.length), 1)
  const fontSize = Math.max(24, Math.min(58, Math.floor(320 / (maxChars * 0.58))))

  return (
    <strong className="capital-name" style={{ '--capital-font-size': `${fontSize}px` } as CssVars}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>{word}</span>
      ))}
    </strong>
  )
}

function buildRoundDeck<T extends { id: string }>(items: T[], limit: number): T[] {
  if (!items.length) return []

  const rounds: T[] = []
  while (rounds.length < limit) {
    const nextBatch = shuffle(items)
    const lastRound = rounds[rounds.length - 1]
    // Avoid showing the same target twice in a row when the deck wraps.
    if (lastRound && nextBatch.length > 1 && nextBatch[0]?.id === lastRound.id) {
      const repeated = nextBatch.shift()
      if (repeated) nextBatch.push(repeated)
    }
    rounds.push(...nextBatch)
  }

  return rounds.slice(0, limit)
}

function createGameItems(gameMode: GameMode): GameItem[] {
  if (gameMode === 'countries') {
    return PLAYABLE_COUNTRIES.map((country) => ({
      ...country,
      id: country.iso,
      mode: 'countries',
    }))
  }

  return getWaterFeatures(gameMode).map((feature) => ({
    ...feature,
    mode: gameMode as FeatureGameItem['mode'],
  }))
}

function getTargetDisplayName(target: GameItem | null | undefined, language: Language): string {
  if (!target) return ''
  return target.mode === 'countries'
    ? getCapitalDisplayName(target.capital, language)
    : getWaterFeatureDisplayName(target, language)
}

function getAnswerDisplayName(answerId: string | null, gameMode: GameMode, language: Language): string | null {
  if (!answerId) return null
  return gameMode === 'countries'
    ? getCountryDisplayName(answerId, language)
    : getWaterFeatureDisplayName(answerId, language, gameMode)
}

function getCorrectAnswerName(target: GameItem | null | undefined, language: Language): string {
  if (!target) return ''
  return target.mode === 'countries'
    ? getCountryDisplayName(target.iso, language)
    : getWaterFeatureDisplayName(target, language)
}

function getAnswerOptions(gameMode: GameMode, language: Language): AnswerOption[] {
  if (gameMode === 'countries') {
    return WORLD_FEATURES
      .filter((country) => country.mapId)
      .map((country) => ({
        id: country.mapId ?? '',
        name: getCountryDisplayName(country.mapId, language),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  return getWaterFeatures(gameMode)
    .map((feature) => ({
      id: feature.id,
      name: getWaterFeatureDisplayName(feature, language),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function projectWaterRegion(region: GeoRegion): { cx: number; cy: number; rx: number; ry: number } | null {
  const center = PROJECTION(region.center)
  if (!center) return null

  const horizontalEdge = PROJECTION([region.center[0] + region.radiusLon, region.center[1]])
  const verticalEdge = PROJECTION([region.center[0], clamp(region.center[1] + region.radiusLat, -84, 84)])
  if (!horizontalEdge || !verticalEdge) return null

  return {
    cx: center[0],
    cy: center[1],
    rx: clamp(Math.abs(horizontalEdge[0] - center[0]), 8, WIDTH * 0.42),
    ry: clamp(Math.abs(verticalEdge[1] - center[1]), 7, HEIGHT * 0.36),
  }
}

function projectFeaturePath(path: GeoPoint[]): string {
  return path
    .map((point) => PROJECTION(point))
    .filter((point): point is [number, number] => Boolean(point))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
}

function App() {
  const [language, setLanguage] = useState<Language>('sk')
  const [settings, setSettings] = usePersistentState<GameSettings>('capital-rush-settings', DEFAULT_SETTINGS)
  const [themeMode, setThemeMode] = usePersistentState<ThemeMode>('capital-rush-theme', 'auto')
  const [soundOn, setSoundOn] = useState(true)
  const [phase, setPhase] = useState<Phase>('setup')
  const [deck, setDeck] = useState<GameItem[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [timeLeft, setTimeLeft] = useState(settings.secondsPerRound)
  const [result, setResult] = useState<RoundResult | null>(null)
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null)
  const [flash, setFlash] = useState<Flash>(null)
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)
  const [settingsDraft, setSettingsDraft] = useState({
    secondsPerRound: String(settings.secondsPerRound),
    roundLimit: String(settings.roundLimit),
  })
  const [settingsErrors, setSettingsErrors] = useState<Partial<Record<'secondsPerRound' | 'roundLimit', string>>>({})
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getCurrentUser())
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authForm, setAuthForm] = useState({ email: '', password: '' })
  const [authErrors, setAuthErrors] = useState<AuthErrors>({})
  const [authLoading, setAuthLoading] = useState(false)
  const [profileRefresh, setProfileRefresh] = useState(0)
  const [newAchievements, setNewAchievements] = useState<EarnedAchievement[]>([])
  const [gameStartedAt, setGameStartedAt] = useState<string | null>(null)
  const roundStartedAtRef = useRef<number | null>(null)
  const roundDetailsRef = useRef<RoundDetail[]>([])
  const playerRef = useRef<AudioPlayer>(() => {})
  const { data: t = loadTranslations(language) } = useQuery<TranslationDictionary>({
    queryKey: ['translations', language],
    queryFn: () => loadTranslations(language),
    placeholderData: () => loadTranslations(language),
    staleTime: Infinity,
  })

  const normalizedSettings = useMemo(() => ({
    ...DEFAULT_SETTINGS,
    ...settings,
    gameMode: isGameMode(settings.gameMode) ? settings.gameMode : DEFAULT_SETTINGS.gameMode,
  }), [settings])
  const secondsPerRound = normalizedSettings.secondsPerRound
  const roundLimit = normalizedSettings.roundLimit
  const configuredGameMode = normalizedSettings.gameMode
  const guestId = useMemo(() => getGuestId(), [])
  const ownerId = currentUser?.id ?? guestId
  const ownerResults = useMemo(() => {
    void profileRefresh
    return getResultsForOwner(ownerId)
  }, [ownerId, profileRefresh])
  const ownerAchievements = useMemo(() => {
    void profileRefresh
    return getAchievementsForOwner(ownerId)
  }, [ownerId, profileRefresh])
  const target = deck[roundIndex]
  const activeGameMode = target?.mode ?? configuredGameMode
  const modeMeta = GAME_MODE_META[activeGameMode]
  const targetName = target ? getTargetDisplayName(target, language) : null
  const answerOptions = useMemo(() => getAnswerOptions(activeGameMode, language), [activeGameMode, language])
  const progress = target ? ((roundIndex + (result ? 1 : 0)) / roundLimit) * 100 : 0
  const timerRatio = Math.max(0, timeLeft / secondsPerRound)
  const isPlaying = phase === 'playing' && !result
  const themeIcon = themeMode === 'light' ? <Sun size={20} /> : themeMode === 'dark' ? <Moon size={20} /> : <Monitor size={20} />
  const themeLabel = themeMode === 'light' ? t.lightTheme : themeMode === 'dark' ? t.darkTheme : t.autoTheme

  const mapViewBox = useMemo(() => {
    // Keep the setup map global, then zoom only during country rounds so tiny targets stay playable.
    if (!target || target.mode !== 'countries' || phase === 'setup' || phase === 'finished') {
      return `0 0 ${WIDTH} ${HEIGHT}`
    }

    const [[minX, minY], [maxX, maxY]] = PATH.bounds(target.geo)
    const countryWidth = maxX - minX
    const countryHeight = maxY - minY
    const maxCountrySize = Math.max(countryWidth, countryHeight)
    const viewWidth = maxCountrySize < 22 ? 360 : maxCountrySize < 55 ? 520 : maxCountrySize < 120 ? 700 : 900
    const viewHeight = viewWidth / 1.8
    const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
    const x = clamp(center.x - viewWidth / 2, 0, WIDTH - viewWidth)
    const y = clamp(center.y - viewHeight / 2, 0, HEIGHT - viewHeight)

    return `${x.toFixed(1)} ${y.toFixed(1)} ${viewWidth.toFixed(1)} ${viewHeight.toFixed(1)}`
  }, [phase, target])

  const resolveRound = useCallback((answerId: string | null, mode: RoundResolveMode = 'answer') => {
    if (!target || result) return

    const correctAnswerId = target.id
    const isCorrect = answerId === correctAnswerId
    const correctAnswer = getCorrectAnswerName(target, language)
    const answered = getAnswerDisplayName(answerId, target.mode, language)
    const now = Date.now()
    const detail: RoundDetail = {
      id: `round-${roundIndex + 1}-${now}`,
      round: roundIndex + 1,
      mode: target.mode,
      question: getTargetDisplayName(target, language),
      correctAnswer,
      correctAnswerId,
      userAnswer: answered,
      userAnswerId: answerId,
      correct: isCorrect,
      responseTimeMs: Math.max(0, now - (roundStartedAtRef.current ?? now)),
      timeLimitSeconds: secondsPerRound,
      failureReason: mode === 'timeout' ? 'timeout' : isCorrect ? null : `wrong-${target.mode}`,
    }
    const nextRoundDetails = [...roundDetailsRef.current, detail]
    roundDetailsRef.current = nextRoundDetails
    setSelectedAnswerId(answerId)
    setResult({
      type: mode === 'timeout' ? 'timeout' : isCorrect ? 'correct' : 'wrong',
      correctAnswer,
    })

    if (isCorrect) {
      setScore((value) => value + 1)
      setStreak((value) => {
        const next = value + 1
        setBestStreak((best) => Math.max(best, next))
        return next
      })
      setFlash('correct')
      playerRef.current('correct')
    } else {
      setStreak(0)
      setFlash(mode === 'timeout' ? 'timeout' : 'wrong')
      playerRef.current(mode === 'timeout' ? 'timeout' : 'wrong')
    }
  }, [language, result, roundIndex, secondsPerRound, target])

  const finishGame = useCallback((details: RoundDetail[]) => {
    if (!gameStartedAt || !details.length) return

    const correctAnswers = details.filter((round) => round.correct).length
    const incorrectAnswers = details.length - correctAnswers
    const completedResult = buildGameResult({
      user: currentUser,
      guestId,
      rounds: roundLimit,
      secondsPerRound,
      correctAnswers,
      incorrectAnswers,
      bestStreak,
      roundDetails: details,
      startedAt: gameStartedAt,
    })
    saveGameResult(completedResult)
    const previousResults = getResultsForOwner(ownerId).filter((item) => item.id !== completedResult.id)
    const storedAchievements = getAchievements()[ownerId] ?? {}
    const earned = evaluateAchievements({
      result: completedResult,
      ownerResults: previousResults,
      existingAchievements: storedAchievements,
    })
    saveNewAchievements(ownerId, earned)
    setProfileRefresh((value) => value + 1)
    setNewAchievements(earned)
  }, [bestStreak, currentUser, gameStartedAt, guestId, ownerId, roundLimit, secondsPerRound])

  useEffect(() => {
    playerRef.current = createAudioPlayer(soundOn)
  }, [soundOn])

  useEffect(() => {
    function resolveTheme() {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const resolvedTheme = themeMode === 'auto' ? (isDark ? 'dark' : 'light') : themeMode
      document.documentElement.dataset.theme = resolvedTheme
      document.documentElement.dataset.themeMode = themeMode
    }

    resolveTheme()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', resolveTheme)
    return () => media.removeEventListener('change', resolveTheme)
  }, [themeMode])

  useEffect(() => {
    if (!isPlaying) return undefined

    const interval = window.setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          window.clearInterval(interval)
          resolveRound(null, 'timeout')
          return 0
        }
        return value - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isPlaying, resolveRound])

  useEffect(() => {
    if (!result || phase !== 'playing') return undefined

    const timeout = window.setTimeout(() => {
      if (roundIndex + 1 >= roundLimit) {
        finishGame(roundDetailsRef.current)
        setPhase('finished')
      } else {
        setRoundIndex((value) => value + 1)
        setTimeLeft(secondsPerRound)
        setSelectedAnswerId(null)
        setResult(null)
        setFlash(null)
        roundStartedAtRef.current = Date.now()
      }
    }, 1200)

    return () => window.clearTimeout(timeout)
  }, [finishGame, result, phase, roundIndex, roundLimit, secondsPerRound])

  function startGame() {
    // Build a fresh randomized deck for each run so every mode can reuse the same game loop.
    const newDeck = buildRoundDeck(createGameItems(configuredGameMode), roundLimit)
    setDeck(newDeck)
    setRoundIndex(0)
    setScore(0)
    setStreak(0)
    setBestStreak(0)
    setSelectedAnswerId(null)
    setResult(null)
    roundDetailsRef.current = []
    roundStartedAtRef.current = Date.now()
    setGameStartedAt(new Date().toISOString())
    setTimeLeft(secondsPerRound)
    setFlash('start')
    setPhase('playing')
    playerRef.current('start')
  }

  function resetGame() {
    setPhase('setup')
    setSelectedAnswerId(null)
    setResult(null)
    setFlash(null)
    setTimeLeft(secondsPerRound)
  }

  function clearGameState(nextSecondsPerRound = secondsPerRound) {
    setPhase('setup')
    setDeck([])
    setRoundIndex(0)
    setScore(0)
    setStreak(0)
    setBestStreak(0)
    setSelectedAnswerId(null)
    setResult(null)
    setFlash(null)
    roundDetailsRef.current = []
    roundStartedAtRef.current = null
    setTimeLeft(nextSecondsPerRound)
  }

  function changeGameMode(gameMode: GameMode) {
    if (gameMode === configuredGameMode) return
    setSettings((value) => ({
      ...DEFAULT_SETTINGS,
      ...value,
      gameMode,
    }))
    clearGameState(secondsPerRound)
  }

  function cycleTheme() {
    setThemeMode((value) => (value === 'auto' ? 'light' : value === 'light' ? 'dark' : 'auto'))
  }

  function openSettings() {
    setSettingsDraft({
      secondsPerRound: String(normalizedSettings.secondsPerRound),
      roundLimit: String(normalizedSettings.roundLimit),
    })
    setSettingsErrors({})
    setSettingsSaved(false)
    setActiveDialog('settings')
  }

  function openAuthDialog() {
    setAuthMode('login')
    setAuthErrors({})
    setAuthForm({ email: '', password: '' })
    setActiveDialog('auth')
  }

  function validateSettingsDraft(): boolean {
    const parsedSettings: GameSettings = {
      secondsPerRound: Number(settingsDraft.secondsPerRound),
      roundLimit: Number(settingsDraft.roundLimit),
      gameMode: configuredGameMode,
    }
    const validation = validateGameSettings(parsedSettings)
    const formatError = (error: ValidationError) => {
      if (error.type === 'number') return t.numberError
      if (error.type === 'mode') return t.modeError
      return interpolate(t.rangeError, error)
    }
    const errors = {
      ...(validation.secondsPerRound ? { secondsPerRound: formatError(validation.secondsPerRound) } : {}),
      ...(validation.roundLimit ? { roundLimit: formatError(validation.roundLimit) } : {}),
      ...(validation.gameMode ? { gameMode: formatError(validation.gameMode) } : {}),
    }
    setSettingsErrors(errors)
    return !Object.keys(errors).length
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validateSettingsDraft()) return
    const parsedSettings: GameSettings = {
      secondsPerRound: Number(settingsDraft.secondsPerRound),
      roundLimit: Number(settingsDraft.roundLimit),
      gameMode: configuredGameMode,
    }
    setSettings(parsedSettings)
    if (phase === 'setup') setTimeLeft(parsedSettings.secondsPerRound)
    setSettingsSaved(true)
    setActiveDialog(null)
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthLoading(true)
    setAuthErrors({})
    const action = authMode === 'login' ? loginUser : registerUser
    const response = await action(authForm.email, authForm.password)
    setAuthLoading(false)

    if (!response.ok) {
      setAuthErrors(response.errors)
      return
    }

    setCurrentUser(response.user)
    setActiveDialog('profile')
    setAuthForm({ email: '', password: '' })
  }

  function handleLogout() {
    logoutUser()
    setCurrentUser(null)
    setAuthMode('login')
    setActiveDialog(null)
  }

  function chooseAnswerFromSelect(event: ChangeEvent<HTMLSelectElement>) {
    if (!event.target.value) return
    resolveRound(event.target.value)
    event.target.value = ''
  }

  function mapCountryClass(country: CountryFeature): string {
    const classes = ['country-shape']
    if (activeGameMode !== 'countries') classes.push('is-background')
    if (target?.id === country.mapId && result) classes.push('is-target')
    if (selectedAnswerId === country.mapId) classes.push('is-selected')
    if (result?.type === 'correct' && target?.id === country.mapId) classes.push('is-correct')
    if (result?.type !== 'correct' && target?.id === country.mapId && result) classes.push('is-missed')
    if (selectedAnswerId === country.mapId && selectedAnswerId !== target?.id) classes.push('is-wrong')
    return classes.join(' ')
  }

  function mapWaterClass(feature: WaterFeature): string {
    const classes = ['water-feature', `water-feature-${activeGameMode}`]
    if (target?.id === feature.id && result) classes.push('is-target')
    if (selectedAnswerId === feature.id) classes.push('is-selected')
    if (result?.type === 'correct' && target?.id === feature.id) classes.push('is-correct')
    if (result?.type !== 'correct' && target?.id === feature.id && result) classes.push('is-missed')
    if (selectedAnswerId === feature.id && selectedAnswerId !== target?.id) classes.push('is-wrong')
    return classes.join(' ')
  }

  return (
    <main className={`game-shell ${flash ? `flash-${flash}` : ''}`}>
      <section className="topbar" aria-label="Prehľad hry">
        <div className="brand">
          <span className="brand-mark"><MapPinned size={21} /></span>
          <div>
            <p className="eyebrow">{t.blindMap}</p>
            <h1>{t.appTitle}</h1>
          </div>
        </div>

        <div className="stats-strip">
          <div>
            <span>{t.score}</span>
            <strong>{score}</strong>
          </div>
          <div>
            <span>{t.round}</span>
            <strong>{phase === 'setup' ? 0 : Math.min(roundIndex + 1, roundLimit)}/{roundLimit}</strong>
          </div>
          <div>
            <span>{t.streak}</span>
            <strong>{streak}</strong>
          </div>
        </div>

        <div className="top-actions">
          <button
            className="language-button"
            type="button"
            onClick={() => setLanguage((value) => LANGUAGES[value].next)}
            aria-label={LANGUAGES[language].label}
            title={LANGUAGES[language].label}
          >
            <span>{LANGUAGES[language].flag}</span>
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setSoundOn((value) => !value)}
            aria-label={soundOn ? t.soundOn : t.soundOff}
            aria-pressed={soundOn}
            title={soundOn ? t.soundOn : t.soundOff}
          >
            {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button className="icon-button" type="button" onClick={cycleTheme} aria-label={interpolate(t.themeButton, { theme: themeLabel })} title={interpolate(t.themeButton, { theme: themeLabel })}>
            {themeIcon}
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => (currentUser ? setActiveDialog('profile') : openAuthDialog())}
            aria-label={currentUser ? t.openProfile : t.openAuth}
            title={currentUser ? t.openProfile : t.openAuth}
          >
            <User size={20} />
          </button>
          <button className="icon-button" type="button" onClick={openSettings} aria-label={t.openSettings} title={t.openSettings}>
            <Settings size={20} />
          </button>
        </div>
      </section>

      <section className="mode-band" aria-label={t.gameMode}>
        <div className="mode-choice-grid main-mode-grid" role="radiogroup" aria-label={t.gameMode}>
          {GAME_MODES.map((mode) => {
            const ChoiceIcon = GAME_MODE_META[mode].icon
            const isActive = configuredGameMode === mode

            return (
              <button
                className={isActive ? 'mode-choice-button active' : 'mode-choice-button'}
                type="button"
                role="radio"
                aria-checked={isActive}
                key={mode}
                onClick={() => changeGameMode(mode)}
              >
                <ChoiceIcon size={18} />
                <span>{t[GAME_MODE_META[mode].labelKey]}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="control-band" aria-label={t.setup}>
        <div className="action-row">
          {phase === 'playing' ? (
            <button className="secondary-button" type="button" onClick={() => setPhase('paused')}>
              <Pause size={18} />
              {t.pause}
            </button>
          ) : phase === 'paused' ? (
            <button className="primary-button" type="button" onClick={() => setPhase('playing')}>
              <Play size={18} />
              {t.continue}
            </button>
          ) : (
            <button className="primary-button" type="button" onClick={startGame}>
              <Play size={18} />
              {t.start}
            </button>
          )}
          <button className="secondary-button" type="button" onClick={resetGame}>
            <RotateCcw size={18} />
            {t.reset}
          </button>
        </div>

        <div className="settings-summary" aria-live="polite">
          <span>{t.timePerRound}: <strong>{secondsPerRound}s</strong></span>
          <span>{t.roundCount}: <strong>{roundLimit}</strong></span>
        </div>
      </section>

      <section className="play-area">
        <div className="prompt-panel">
          <div className="prompt-topline">
            <span><Crosshair size={16} /> {t[modeMeta.promptKey]}</span>
            {phase !== 'setup' && (
              <span>{phase === 'finished' ? t.gameOver : phase === 'paused' ? t.pause : t.activeRound}</span>
            )}
          </div>

          <div className={targetName ? 'capital-card has-target' : 'capital-card is-empty'}>
            <p>{t[modeMeta.targetLabelKey]}</p>
            {targetName && <TargetName name={targetName} />}
            <span>{phase === 'setup' ? t[modeMeta.setupHintKey] : t[modeMeta.questionHintKey]}</span>
          </div>

          <div className="timer-card">
            <div className="timer-ring" style={{ '--timer': timerRatio } as CssVars} aria-hidden="true">
              <span>{timeLeft}</span>
            </div>
            <span className="sr-only" aria-live="polite">
              {phase === 'finished' ? `${score}/${roundLimit}` : `${timeLeft} ${t.secondsLeft}`}
            </span>
          </div>

          <div className={`result-line ${result?.type ?? ''}`} role="status" aria-live="polite">
            {phase === 'finished'
              ? interpolate(t.done, { bestStreak })
              : result?.type === 'correct'
                ? t.correct
                : result?.type === 'timeout'
                  ? interpolate(t.timeout, { answer: result.correctAnswer, country: result.correctAnswer })
                  : result?.type === 'wrong'
                    ? interpolate(t.wrong, { answer: result.correctAnswer, country: result.correctAnswer })
                    : t[modeMeta.helperKey]}
          </div>

          <label className="country-select-label" htmlFor="country-answer">
            {t.keyboardAnswer}
          </label>
          <select
            id="country-answer"
            className="country-select"
            disabled={phase !== 'playing' || Boolean(result)}
            onChange={chooseAnswerFromSelect}
            defaultValue=""
          >
            <option value="">{t[modeMeta.chooseKey]}</option>
            {answerOptions
              .map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
          </select>
        </div>

        <div className="map-panel">
          <div className="progress-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
          <svg className="world-map" viewBox={mapViewBox} role="img" aria-label={t.mapLabel}>
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" />
              </pattern>
            </defs>
            <rect className="ocean" width={WIDTH} height={HEIGHT} rx="18" />
            <rect className="map-grid" width={WIDTH} height={HEIGHT} />
            <path className="sphere-outline" d={PATH({ type: 'Sphere' }) ?? undefined} />

            <g className="country-layer">
              {WORLD_FEATURES.map((country, index) => (
                <path
                  key={`${country.mapId ?? country.properties?.name ?? 'country'}-${index}`}
                  data-iso={country.mapId ?? undefined}
                  className={mapCountryClass(country)}
                  d={PATH(country) ?? undefined}
                  onClick={() => activeGameMode === 'countries' && phase === 'playing' && !result && country.mapId && resolveRound(country.mapId)}
                >
                  <title>{activeGameMode === 'countries' && phase === 'playing' && !result ? t.selectCountry : getCountryDisplayName(country.mapId, language)}</title>
                </path>
              ))}
            </g>

            <path className="country-borders" d={PATH(BORDERS_GEO) ?? undefined} />

            {activeGameMode !== 'countries' && (
              <g key={`water-layer-${activeGameMode}`} className="water-layer" aria-label={t[modeMeta.promptKey]}>
                {getWaterFeatures(activeGameMode).map((feature) => (
                  <g key={feature.id} className={mapWaterClass(feature)}>
                    <g className="water-regions">
                      {feature.regions?.map((region, index) => {
                        const projected = projectWaterRegion(region)
                        if (!projected) return null

                        return (
                          <ellipse
                            key={`${feature.id}-region-${index}`}
                            data-feature-id={feature.id}
                            cx={projected.cx}
                            cy={projected.cy}
                            rx={projected.rx}
                            ry={projected.ry}
                            onClick={() => phase === 'playing' && !result && resolveRound(feature.id)}
                          >
                            <title>{phase === 'playing' && !result ? t[modeMeta.selectTitleKey] : getWaterFeatureDisplayName(feature, language)}</title>
                          </ellipse>
                        )
                      })}
                    </g>
                    <g className="water-paths">
                      {feature.paths?.map((path, index) => {
                        const points = projectFeaturePath(path)
                        if (!points) return null

                        return (
                          <polyline
                            key={`${feature.id}-path-${index}`}
                            data-feature-id={feature.id}
                            points={points}
                            style={{ '--feature-line-width': feature.lineWidth ?? 9 } as CssVars}
                            onClick={() => phase === 'playing' && !result && resolveRound(feature.id)}
                          >
                            <title>{phase === 'playing' && !result ? t[modeMeta.selectTitleKey] : getWaterFeatureDisplayName(feature, language)}</title>
                          </polyline>
                        )
                      })}
                    </g>
                  </g>
                ))}
              </g>
            )}

          </svg>

          {phase === 'paused' && (
            <div className="map-overlay">
              <Settings2 size={28} />
              <strong>{t.paused}</strong>
            </div>
          )}

          {phase === 'finished' && (
            <div className="map-overlay">
              <TimerReset size={30} />
              <strong>{score >= Math.ceil(roundLimit * 0.8) ? t.greatResult : t.tryAgain}</strong>
              <button className="primary-button" type="button" onClick={startGame}>
                <Play size={18} />
                {t.playAgain}
              </button>
            </div>
          )}
        </div>
      </section>

      {newAchievements.length > 0 && (
        <aside className="achievement-toast" role="status" aria-live="polite">
          <Trophy size={20} />
          <span>{interpolate(t.achievementUnlocked, { name: newAchievements[0].name })}</span>
          <button type="button" onClick={() => setNewAchievements([])} aria-label={t.dismiss}>
            ×
          </button>
        </aside>
      )}

      {activeDialog === 'settings' && (
        <AppDialog closeLabel={t.closeDialog} initialFocus="#seconds-per-round" labelledBy="settings-title" onClose={() => setActiveDialog(null)}>
          <h2 id="settings-title">{t.settingsTitle}</h2>
          <form className="dialog-form" noValidate onSubmit={saveSettings}>
            <label htmlFor="seconds-per-round">{t.timePerRound}</label>
            <input
              id="seconds-per-round"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={settingsDraft.secondsPerRound}
              aria-invalid={Boolean(settingsErrors.secondsPerRound)}
              aria-describedby={settingsErrors.secondsPerRound ? 'seconds-error' : undefined}
              onChange={(event) => setSettingsDraft((value) => ({ ...value, secondsPerRound: event.target.value }))}
            />
            {settingsErrors.secondsPerRound && <p id="seconds-error" className="field-error">{settingsErrors.secondsPerRound}</p>}

            <label htmlFor="round-limit">{t.roundCount}</label>
            <input
              id="round-limit"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={settingsDraft.roundLimit}
              aria-invalid={Boolean(settingsErrors.roundLimit)}
              aria-describedby={settingsErrors.roundLimit ? 'round-error' : undefined}
              onChange={(event) => setSettingsDraft((value) => ({ ...value, roundLimit: event.target.value }))}
            />
            {settingsErrors.roundLimit && <p id="round-error" className="field-error">{settingsErrors.roundLimit}</p>}

            <button className="primary-button" type="submit">{t.saveSettings}</button>
            {settingsSaved && <p className="success-message" role="status">{t.settingsSaved}</p>}
          </form>
        </AppDialog>
      )}

      {activeDialog === 'auth' && (
        <AppDialog closeLabel={t.closeDialog} initialFocus="#auth-email" labelledBy="auth-title" onClose={() => setActiveDialog(null)}>
          <h2 id="auth-title">{authMode === 'login' ? t.loginTitle : t.registerTitle}</h2>
          <form className="dialog-form" noValidate onSubmit={submitAuth}>
            {authErrors.form && <p className="field-error" role="alert">{authErrors.form}</p>}
            <label htmlFor="auth-email">{t.email}</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={authForm.email}
              aria-invalid={Boolean(authErrors.email)}
              aria-describedby={authErrors.email ? 'auth-email-error' : undefined}
              onChange={(event) => setAuthForm((value) => ({ ...value, email: event.target.value }))}
            />
            {authErrors.email && <p id="auth-email-error" className="field-error">{authErrors.email}</p>}

            <label htmlFor="auth-password">{t.password}</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              value={authForm.password}
              aria-invalid={Boolean(authErrors.password)}
              aria-describedby={authErrors.password ? 'auth-password-error' : undefined}
              onChange={(event) => setAuthForm((value) => ({ ...value, password: event.target.value }))}
            />
            {authErrors.password && <p id="auth-password-error" className="field-error">{authErrors.password}</p>}

            <button className="primary-button" type="submit" disabled={authLoading}>
              {authLoading ? t.loading : authMode === 'login' ? t.login : t.register}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setAuthErrors({})
                setAuthMode((value) => (value === 'login' ? 'register' : 'login'))
              }}
            >
              {authMode === 'login' ? t.needAccount : t.haveAccount}
            </button>
          </form>
        </AppDialog>
      )}

      {activeDialog === 'profile' && (
        <AppDialog closeLabel={t.closeDialog} labelledBy="profile-title" onClose={() => setActiveDialog(null)}>
          <div className="profile-header">
            <div>
              <h2 id="profile-title">{t.profileTitle}</h2>
              <p>{currentUser ? currentUser.email : t.guestSession}</p>
            </div>
            {currentUser ? (
              <button className="secondary-button" type="button" onClick={handleLogout}>
                <LogOut size={17} />
                {t.logout}
              </button>
            ) : (
              <button className="secondary-button" type="button" onClick={openAuthDialog}>
                <User size={17} />
                {t.login}
              </button>
            )}
          </div>

          <section className="profile-section" aria-labelledby="achievements-title">
            <h3 id="achievements-title">{t.achievements}</h3>
            <div className="achievement-grid">
              {ownerAchievements.map((achievement) => (
                <article className={achievement.earned ? 'achievement earned' : 'achievement'} key={achievement.id}>
                  <Trophy size={18} />
                  <strong>{achievement.name}</strong>
                  <p>{achievement.description}</p>
                  <span>{achievement.earnedAt ? new Date(achievement.earnedAt).toLocaleDateString() : t.locked}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="profile-section" aria-labelledby="history-title">
            <h3 id="history-title">{t.history}</h3>
            {ownerResults.length ? (
              <div className="history-list">
                {ownerResults.map((game) => (
                  <details key={game.id}>
                    <summary>
                      <span>{new Date(game.completedAt).toLocaleString()}</span>
                      <strong>{game.score}/{game.rounds} · {game.accuracy}%</strong>
                    </summary>
                    <dl className="result-meta">
                      <div><dt>{t.timePerRound}</dt><dd>{game.secondsPerRound}s</dd></div>
                      <div><dt>{t.duration}</dt><dd>{Math.round(game.durationMs / 1000)}s</dd></div>
                      <div><dt>{t.wrongAnswers}</dt><dd>{game.incorrectAnswers}</dd></div>
                    </dl>
                    <ol className="round-detail-list">
                      {game.roundDetails.map((round) => (
                        <li key={round.id}>
                          <strong>{round.question}</strong>
                          <span>{round.correct ? t.correct : t.wrongShort}</span>
                          <small>{t.correctAnswer}: {round.correctAnswer}{round.userAnswer ? ` · ${t.yourAnswer}: ${round.userAnswer}` : ` · ${t.timeoutShort}`}</small>
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            ) : (
              <p className="empty-state">{t.noHistory}</p>
            )}
          </section>
        </AppDialog>
      )}
    </main>
  )
}

export default App
