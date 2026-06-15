import { type CSSProperties, type ChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { geoEqualEarth, geoPath } from 'd3-geo'
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crosshair,
  LogOut,
  MapPinned,
  Maximize2,
  Minus,
  Monitor,
  Moon,
  Mountain,
  Pause,
  Play,
  Plus,
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
import { getCountryFacts, type CountryFact } from './services/wikimediaFacts'
import { getWaterFeatureDisplayName, getWaterFeatures } from './services/waterFeatures'
import type {
  AnswerOption,
  AuthErrors,
  ContinentCode,
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
type PlayMode = 'quiz' | 'learn'
type MapSize = 'normal' | 'large' | 'full'
type LearningProgress = { continent: ContinentCode; deckIds: string[]; roundIndex: number; phase: 'playing' | 'finished' }
type MapSelection = { id: string; mode: GameMode } | null
type RoundResolveMode = 'answer' | 'timeout'
type AudioCue = 'start' | 'correct' | 'wrong' | 'timeout'
type AudioPlayer = (type: AudioCue) => void
type RoundResult = { type: Exclude<AudioCue, 'start'>; correctAnswer: string }
type CssVars = CSSProperties & Record<`--${string}`, string | number>
type MapTooltip = { text: string; x: number; y: number } | null
const CONTINENTS: ContinentCode[] = ['EU', 'AS', 'AF', 'NA', 'SA', 'OC']
const MAP_ZOOM_STEPS = [0, 0.4, 0.7, 1, 1.25, 1.5, 1.75, 2]
const LEARNING_PROGRESS_KEY = 'capital-rush-learning-progress'

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
  const shuffled = [...list]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const item = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = item
  }
  return shuffled
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
  return (
    <strong className="capital-name">
      {name}
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
    return createCountryItems(PLAYABLE_COUNTRIES)
  }

  return getWaterFeatures(gameMode).map((feature) => ({
    ...feature,
    mode: gameMode as FeatureGameItem['mode'],
  }))
}

function createCountryItems(countries: readonly typeof PLAYABLE_COUNTRIES[number][]): GameItem[] {
  return countries.map((country) => ({
    ...country,
    id: country.iso,
    mode: 'countries',
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
    return [...new Set(WORLD_FEATURES.map((country) => country.mapId).filter((id): id is string => Boolean(id)))]
      .map((id) => ({
        id,
        name: getCountryDisplayName(id, language),
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

function getFlagUrl(alpha2: string | undefined, width: 40 | 80 = 80): string {
  if (!alpha2 || alpha2.length !== 2) return ''
  return `https://flagcdn.com/w${width}/${alpha2.toLowerCase()}.png`
}

function getBrowserLanguage(): Language {
  return navigator.languages?.some((code) => code.toLowerCase().startsWith('sk')) ? 'sk' : 'en'
}

function normalizeLearningProgress(progress: LearningProgress | null, continent: ContinentCode): LearningProgress | null {
  if (!progress || progress.continent !== continent || !progress.deckIds.length) return null

  const countryIds = new Set(PLAYABLE_COUNTRIES.filter((country) => country.continent === continent).map((country) => country.iso))
  if (progress.deckIds.some((id) => !countryIds.has(id))) return null

  return {
    continent: progress.continent,
    deckIds: progress.deckIds,
    roundIndex: clamp(progress.roundIndex, 0, progress.deckIds.length - 1),
    phase: progress.phase,
  }
}

function createLearningDeckFromIds(ids: string[]): GameItem[] {
  const countriesById = new Map(PLAYABLE_COUNTRIES.map((country) => [country.iso, country]))
  return ids
    .map((id) => countriesById.get(id))
    .filter((country): country is typeof PLAYABLE_COUNTRIES[number] => Boolean(country))
    .map((country) => ({ ...country, mode: 'countries' }))
}

function buildLearningProgress(continent: ContinentCode, deck: GameItem[], roundIndex: number, phase: LearningProgress['phase']): LearningProgress | null {
  const deckIds = deck.filter((item): item is GameItem & { mode: 'countries' } => item.mode === 'countries').map((item) => item.id)
  return deckIds.length ? { continent, deckIds, roundIndex, phase } : null
}

function App() {
  const [language, setLanguage] = usePersistentState<Language>('capital-rush-language', getBrowserLanguage())
  const [settings, setSettings] = usePersistentState<GameSettings>('capital-rush-settings', DEFAULT_SETTINGS)
  const [playMode, setPlayMode] = usePersistentState<PlayMode>('capital-rush-primary-play-mode', 'learn')
  const [learningContinent, setLearningContinent] = usePersistentState<ContinentCode>('capital-rush-learning-continent', 'EU')
  const [learningProgress, setLearningProgress] = usePersistentState<LearningProgress | null>(LEARNING_PROGRESS_KEY, null)
  const [themeMode, setThemeMode] = usePersistentState<ThemeMode>('capital-rush-theme', 'auto')
  const [soundOn, setSoundOn] = useState(true)
  const [initialLearningProgress] = useState(() => playMode === 'learn' ? normalizeLearningProgress(learningProgress, learningContinent) : null)
  const [phase, setPhase] = useState<Phase>(() => initialLearningProgress?.phase ?? 'setup')
  const [deck, setDeck] = useState<GameItem[]>(() => initialLearningProgress ? createLearningDeckFromIds(initialLearningProgress.deckIds) : [])
  const [roundIndex, setRoundIndex] = useState(() => initialLearningProgress?.roundIndex ?? 0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [mapZoom, setMapZoom] = useState(1)
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 })
  const [modesCollapsed, setModesCollapsed] = useState(false)
  const [mapSide, setMapSide] = useState<'right' | 'left'>('right')
  const [mapSize, setMapSize] = useState<MapSize>('normal')
  const [mapTooltip, setMapTooltip] = useState<MapTooltip>(null)
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
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getCurrentUser())
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authForm, setAuthForm] = useState({ email: '', password: '' })
  const [authErrors, setAuthErrors] = useState<AuthErrors>({})
  const [authLoading, setAuthLoading] = useState(false)
  const [profileRefresh, setProfileRefresh] = useState(0)
  const [newAchievements, setNewAchievements] = useState<EarnedAchievement[]>([])
  const [countryFactsResult, setCountryFactsResult] = useState<{ key: string; facts: CountryFact[] } | null>(null)
  const [gameStartedAt, setGameStartedAt] = useState<string | null>(null)
  const roundStartedAtRef = useRef<number | null>(null)
  const roundDetailsRef = useRef<RoundDetail[]>([])
  const playerRef = useRef<AudioPlayer>(() => {})
  const mapDragRef = useRef<{ active: boolean; pointerId: number; x: number; y: number; panX: number; panY: number; viewWidth: number; viewHeight: number; moved: boolean; selection: MapSelection }>({
    active: false,
    pointerId: 0,
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
    viewWidth: WIDTH,
    viewHeight: HEIGHT,
    moved: false,
    selection: null,
  })
  const t = loadTranslations(language)

  const normalizedSettings = useMemo(() => ({
    ...DEFAULT_SETTINGS,
    ...settings,
    gameMode: isGameMode(settings.gameMode) ? settings.gameMode : DEFAULT_SETTINGS.gameMode,
  }), [settings])
  const secondsPerRound = normalizedSettings.secondsPerRound
  const roundLimit = normalizedSettings.roundLimit
  const configuredGameMode = normalizedSettings.gameMode
  const isLearning = playMode === 'learn'
  const learningCountries = useMemo(() => PLAYABLE_COUNTRIES.filter((country) => country.continent === learningContinent), [learningContinent])
  const currentRoundLimit = isLearning ? learningCountries.length : roundLimit
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
  const targetName = target ? (isLearning && target.mode === 'countries' ? getCountryDisplayName(target.iso, language) : getTargetDisplayName(target, language)) : null
  const learningCapital = isLearning && target?.mode === 'countries' ? getCapitalDisplayName(target.capital, language) : null
  const learningFlag = isLearning && target?.mode === 'countries' ? getFlagUrl(target.alpha2) : ''
  const capitalPoint = target?.mode === 'countries' && target.capitalPoint ? PROJECTION(target.capitalPoint) : null
  const answerOptions = useMemo(() => getAnswerOptions(activeGameMode, language), [activeGameMode, language])
  const progress = target ? ((roundIndex + (result || isLearning ? 1 : 0)) / currentRoundLimit) * 100 : 0
  const timerRatio = isLearning ? progress / 100 : Math.max(0, timeLeft / secondsPerRound)
  const isPlaying = phase === 'playing' && !result && !isLearning
  const canGoPreviousLearningCountry = isLearning && phase === 'playing' && roundIndex > 0
  const canGoNextLearningCountry = isLearning && phase !== 'paused' && (phase !== 'finished' || roundIndex + 1 < currentRoundLimit)
  const themeIcon = themeMode === 'light' ? <Sun size={20} /> : themeMode === 'dark' ? <Moon size={20} /> : <Monitor size={20} />
  const themeLabel = themeMode === 'light' ? t.lightTheme : themeMode === 'dark' ? t.darkTheme : t.autoTheme

  const baseMapViewBox = useMemo(() => {
    // Keep the setup map global, then zoom only during country rounds so tiny targets stay playable.
    if (!target || target.mode !== 'countries' || phase === 'setup' || phase === 'finished') {
      return `0 0 ${WIDTH} ${HEIGHT}`
    }

    const [[minX, minY], [maxX, maxY]] = PATH.bounds(target.geo)
    const countryWidth = maxX - minX
    const countryHeight = maxY - minY
    const maxCountrySize = Math.max(countryWidth, countryHeight)
    const viewWidth = isLearning
      ? maxCountrySize < 22 ? 120 : maxCountrySize < 55 ? 180 : maxCountrySize < 120 ? 300 : 520
      : maxCountrySize < 22 ? 360 : maxCountrySize < 55 ? 520 : maxCountrySize < 120 ? 700 : 900
    const viewHeight = viewWidth / 1.8
    const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
    const x = clamp(center.x - viewWidth / 2, 0, WIDTH - viewWidth)
    const y = clamp(center.y - viewHeight / 2, 0, HEIGHT - viewHeight)

    return `${x.toFixed(1)} ${y.toFixed(1)} ${viewWidth.toFixed(1)} ${viewHeight.toFixed(1)}`
  }, [isLearning, phase, target])
  const mapViewBox = useMemo(() => {
    if (mapZoom === 0) return `0 0 ${WIDTH} ${HEIGHT}`

    const [x, y, width, height] = baseMapViewBox.split(' ').map(Number)
    let view
    if (mapZoom < 1) {
      const nextWidth = WIDTH - (WIDTH - width) * mapZoom
      const nextHeight = HEIGHT - (HEIGHT - height) * mapZoom
      const center = { x: x + width / 2, y: y + height / 2 }
      view = { x: center.x - nextWidth / 2, y: center.y - nextHeight / 2, width: nextWidth, height: nextHeight }
    } else {
      const nextWidth = width / mapZoom
      const nextHeight = height / mapZoom
      view = { x: x + (width - nextWidth) / 2, y: y + (height - nextHeight) / 2, width: nextWidth, height: nextHeight }
    }

    const nextX = clamp(view.x + mapPan.x, 0, WIDTH - view.width)
    const nextY = clamp(view.y + mapPan.y, 0, HEIGHT - view.height)
    return `${nextX.toFixed(1)} ${nextY.toFixed(1)} ${view.width.toFixed(1)} ${view.height.toFixed(1)}`
  }, [baseMapViewBox, mapPan, mapZoom])
  const capitalMarkerRadius = (Number(mapViewBox.split(' ')[2]) || WIDTH) / 260
  const mapZoomStepIndex = MAP_ZOOM_STEPS.findIndex((step) => step >= mapZoom)
  const canZoomOut = mapZoomStepIndex > 0
  const canZoomIn = mapZoomStepIndex !== -1 && mapZoomStepIndex < MAP_ZOOM_STEPS.length - 1
  const countryFactsKey = isLearning && phase !== 'setup' && target?.mode === 'countries' && target.alpha2
    ? `${language}:${target.alpha2}`
    : null
  const countryFacts = countryFactsKey && countryFactsResult?.key === countryFactsKey ? countryFactsResult.facts : []
  const countryFactsLoading = Boolean(countryFactsKey && countryFactsResult?.key !== countryFactsKey)

  useEffect(() => {
    if (!countryFactsKey || target?.mode !== 'countries' || !target.alpha2) return undefined

    let cancelled = false
    getCountryFacts(target.alpha2, language)
      .then((facts) => {
        if (!cancelled) setCountryFactsResult({ key: countryFactsKey, facts })
      })

    return () => {
      cancelled = true
    }
  }, [countryFactsKey, language, target])

  useEffect(() => {
    if (!isLearning || !deck.length || (phase !== 'playing' && phase !== 'finished')) return
    setLearningProgress(buildLearningProgress(learningContinent, deck, roundIndex, phase))
  }, [deck, isLearning, learningContinent, phase, roundIndex, setLearningProgress])

  useEffect(() => {
    if (!isLearning || phase === 'setup') return undefined

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented) return
      if (event.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return

      if (event.key === 'ArrowLeft' && canGoPreviousLearningCountry) {
        event.preventDefault()
        const previousIndex = roundIndex - 1
        setMapZoom(1)
        setMapPan({ x: 0, y: 0 })
        setRoundIndex(previousIndex)
        setLearningProgress(buildLearningProgress(learningContinent, deck, previousIndex, 'playing'))
      } else if (event.key === 'ArrowRight' && canGoNextLearningCountry) {
        event.preventDefault()
        if (roundIndex + 1 >= currentRoundLimit) {
          setPhase('finished')
          setLearningProgress(buildLearningProgress(learningContinent, deck, roundIndex, 'finished'))
          return
        }
        const nextIndex = roundIndex + 1
        setMapZoom(1)
        setMapPan({ x: 0, y: 0 })
        setRoundIndex(nextIndex)
        setLearningProgress(buildLearningProgress(learningContinent, deck, nextIndex, 'playing'))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canGoNextLearningCountry, canGoPreviousLearningCountry, currentRoundLimit, deck, isLearning, learningContinent, phase, roundIndex, setLearningProgress])

  const resolveRound = useCallback((answerId: string | null, mode: RoundResolveMode = 'answer') => {
    if (!target || result || isLearning) return

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
  }, [isLearning, language, result, roundIndex, secondsPerRound, target])

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
        setMapZoom(1)
        setMapPan({ x: 0, y: 0 })
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
    const newDeck = isLearning
      ? buildRoundDeck(createCountryItems(learningCountries), learningCountries.length)
      : buildRoundDeck(createGameItems(configuredGameMode), roundLimit)
    setMapZoom(1)
    setMapPan({ x: 0, y: 0 })
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
    if (isLearning) setLearningProgress(buildLearningProgress(learningContinent, newDeck, 0, 'playing'))
    playerRef.current('start')
  }

  function resetGame() {
    clearGameState()
  }

  function zoomMap(direction: -1 | 1) {
    setMapZoom((value) => {
      const index = MAP_ZOOM_STEPS.findIndex((step) => step >= value)
      return MAP_ZOOM_STEPS[clamp((index === -1 ? MAP_ZOOM_STEPS.length - 1 : index) + direction, 0, MAP_ZOOM_STEPS.length - 1)]
    })
  }

  function resetMapView() {
    setMapZoom(1)
    setMapPan({ x: 0, y: 0 })
  }

  function panMap(deltaX: number, deltaY: number) {
    const [, , viewWidth, viewHeight] = mapViewBox.split(' ').map(Number)
    setMapPan((value) => ({
      x: value.x + deltaX * viewWidth,
      y: value.y + deltaY * viewHeight,
    }))
  }

  function controlMapWithKeyboard(event: ReactKeyboardEvent<SVGSVGElement>) {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomMap(1)
    } else if (event.key === '-') {
      event.preventDefault()
      zoomMap(-1)
    } else if (event.key === '0') {
      event.preventDefault()
      resetMapView()
    } else if (isLearning && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      return
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      panMap(-0.08, 0)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      panMap(0.08, 0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      panMap(0, -0.08)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      panMap(0, 0.08)
    }
  }

  function dragMap(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = mapDragRef.current
    if (!drag.active || event.pointerId !== drag.pointerId || event.buttons !== 1) return

    const rect = event.currentTarget.getBoundingClientRect()
    const deltaX = event.clientX - drag.x
    const deltaY = event.clientY - drag.y
    if (Math.hypot(deltaX, deltaY) > 8) drag.moved = true
    setMapPan({
      x: drag.panX - deltaX * (drag.viewWidth / rect.width),
      y: drag.panY - deltaY * (drag.viewHeight / rect.height),
    })
  }

  function startMapDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    setMapTooltip(null)
    const [, , viewWidth, viewHeight] = mapViewBox.split(' ').map(Number)
    mapDragRef.current = {
      active: true,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: mapPan.x,
      panY: mapPan.y,
      viewWidth,
      viewHeight,
      moved: false,
      selection: getMapSelectionFromTarget(event.target),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function stopMapDrag(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = mapDragRef.current
    if (event.pointerId !== drag.pointerId) return
    drag.active = false
    const releaseSelection = document.elementFromPoint(event.clientX, event.clientY)
    if (!drag.moved) resolveMapSelection(getMapSelectionFromTarget(releaseSelection) ?? drag.selection)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    window.setTimeout(() => {
      drag.moved = false
      drag.selection = null
    })
  }

  function zoomMapWithWheel(event: ReactWheelEvent<SVGSVGElement>) {
    event.preventDefault()
    zoomMap(event.deltaY > 0 ? -1 : 1)
  }

  function getMapSelectionFromTarget(targetElement: EventTarget | null): MapSelection {
    if (!(targetElement instanceof Element)) return null

    const country = targetElement.closest<SVGElement>('.country-shape[data-iso], .country-hit-area[data-iso]')
    if (country?.dataset.iso) return { id: country.dataset.iso, mode: 'countries' }

    const feature = targetElement.closest<SVGElement>('[data-feature-id]')
    const featureId = feature?.dataset.featureId
    return featureId ? { id: featureId, mode: activeGameMode } : null
  }

  function resolveMapSelection(selection: MapSelection) {
    if (!selection || isLearning || phase !== 'playing' || result || selection.mode !== activeGameMode) return
    resolveRound(selection.id)
  }

  function nextLearningCountry() {
    if (phase !== 'playing') {
      startGame()
      return
    }
    if (roundIndex + 1 >= currentRoundLimit) {
      setPhase('finished')
      setLearningProgress(buildLearningProgress(learningContinent, deck, roundIndex, 'finished'))
      return
    }
    const nextIndex = roundIndex + 1
    setMapZoom(1)
    setMapPan({ x: 0, y: 0 })
    setRoundIndex(nextIndex)
    setLearningProgress(buildLearningProgress(learningContinent, deck, nextIndex, 'playing'))
  }

  function previousLearningCountry() {
    if (!canGoPreviousLearningCountry) return
    const previousIndex = roundIndex - 1
    setMapZoom(1)
    setMapPan({ x: 0, y: 0 })
    setRoundIndex(previousIndex)
    setLearningProgress(buildLearningProgress(learningContinent, deck, previousIndex, 'playing'))
  }

  function clearGameState(nextSecondsPerRound = secondsPerRound) {
    setPhase('setup')
    resetMapView()
    setLearningProgress(null)
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
    if (playMode === 'quiz' && gameMode === configuredGameMode) return
    setPlayMode('quiz')
    setSettings((value) => ({
      ...DEFAULT_SETTINGS,
      ...value,
      gameMode,
    }))
    clearGameState(secondsPerRound)
  }

  function changeLearningContinent(continent: ContinentCode) {
    setPlayMode('learn')
    setLearningContinent(continent)
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

  function answerClass(id: string | null | undefined, base: string[]): string {
    return [
      ...base,
      target?.id === id && (result || (isLearning && phase !== 'setup')) && 'is-target',
      target?.id === id && isLearning && phase !== 'setup' && 'is-learning-target',
      !isLearning && selectedAnswerId === id && 'is-selected',
      !isLearning && result?.type === 'correct' && target?.id === id && 'is-correct',
      !isLearning && result?.type !== 'correct' && target?.id === id && result && 'is-missed',
      !isLearning && selectedAnswerId === id && selectedAnswerId !== target?.id && 'is-wrong',
    ].filter(Boolean).join(' ')
  }

  function mapCountryClass(country: CountryFeature): string {
    return answerClass(country.mapId, ['country-shape', activeGameMode !== 'countries' ? 'is-background' : ''])
  }

  function getMapCountryLabel(country: CountryFeature): string {
    return activeGameMode === 'countries' && !isLearning && phase === 'playing' && !result
      ? t.selectCountry
      : getCountryDisplayName(country.mapId, language)
  }

  function showMapTooltip(event: ReactPointerEvent<SVGElement>, text: string) {
    if (mapDragRef.current.active) return
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
    if (!rect) return
    setMapTooltip({
      text,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top + 12,
    })
  }

  function mapWaterClass(feature: WaterFeature): string {
    return answerClass(feature.id, ['water-feature', `water-feature-${activeGameMode}`])
  }

  return (
    <main className={`game-shell ${flash ? `flash-${flash}` : ''} ${isLearning ? 'is-learning-mode' : ''}`}>
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
            <strong>{phase === 'setup' ? 0 : Math.min(roundIndex + 1, currentRoundLimit)}/{currentRoundLimit}</strong>
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
            <img src={getFlagUrl(LANGUAGES[language].flagCode, 40)} alt="" width="28" height="21" loading="lazy" />
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

      <section className={`mode-band ${modesCollapsed ? 'is-collapsed' : ''}`} aria-label={t.gameMode}>
        <button
          className="mode-band-toggle"
          type="button"
          onClick={() => setModesCollapsed((value) => !value)}
          aria-expanded={!modesCollapsed}
        >
          <span>{t.gameMode}</span>
          {modesCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
        {!modesCollapsed && (
          <div className="mode-choice-grid main-mode-grid" role="radiogroup" aria-label={t.gameMode}>
            <button
              className={isLearning ? 'mode-choice-button active' : 'mode-choice-button'}
              type="button"
              role="radio"
              aria-checked={isLearning}
              onClick={() => changeLearningContinent(learningContinent)}
            >
              <BookOpen size={18} />
              <span>{t.modeLearning}</span>
            </button>
            {GAME_MODES.map((mode) => {
              const ChoiceIcon = GAME_MODE_META[mode].icon
              const isActive = playMode === 'quiz' && configuredGameMode === mode

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
        )}
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

        {isLearning ? (
          <div className="continent-picker segmented" role="radiogroup" aria-label={t.chooseContinent}>
            {CONTINENTS.map((continent) => (
              <button
                className={learningContinent === continent ? 'active' : ''}
                type="button"
                role="radio"
                aria-checked={learningContinent === continent}
                key={continent}
                onClick={() => changeLearningContinent(continent)}
              >
                {t[`continent${continent}` as keyof TranslationDictionary]}
              </button>
            ))}
          </div>
        ) : (
          <div className="settings-summary" aria-live="polite">
            <span>{t.timePerRound}: <strong>{secondsPerRound}s</strong></span>
            <span>{t.roundCount}: <strong>{roundLimit}</strong></span>
          </div>
        )}
      </section>

      <section className={`play-area map-${mapSide} map-${mapSize}`}>
        <div className="prompt-panel">
          <div className="prompt-topline">
            <span><Crosshair size={16} /> {isLearning ? t.learningMode : t[modeMeta.promptKey]}</span>
            {phase !== 'setup' && (
              <span>{phase === 'finished' ? t.gameOver : phase === 'paused' ? t.pause : t.activeRound}</span>
            )}
          </div>

          <div className={targetName ? 'capital-card has-target' : 'capital-card is-empty'}>
            <p>{isLearning ? t.countryName : t[modeMeta.targetLabelKey]}</p>
            {learningFlag && <img className="country-flag" src={learningFlag} alt="" width="46" height="34" loading="lazy" />}
            {targetName && <TargetName name={targetName} />}
            {learningCapital && <span className="learn-capital">{t.capitalCity}: <strong>{learningCapital}</strong></span>}
            <span>{isLearning ? (phase === 'setup' ? t.learningSetupHint : t.learningQuestionHint) : phase === 'setup' ? t[modeMeta.setupHintKey] : t[modeMeta.questionHintKey]}</span>
          </div>

          <div className="timer-card">
            <div className="timer-ring" style={{ '--timer': timerRatio } as CssVars} aria-hidden="true">
              <span>{isLearning ? (phase === 'setup' ? currentRoundLimit : Math.min(roundIndex + 1, currentRoundLimit)) : timeLeft}</span>
            </div>
            <span className="sr-only" aria-live="polite">
              {phase === 'finished' ? `${score}/${currentRoundLimit}` : isLearning ? `${roundIndex + 1}/${currentRoundLimit}` : `${timeLeft} ${t.secondsLeft}`}
            </span>
          </div>

          <div className={`result-line ${result?.type ?? ''}`} role="status" aria-live="polite">
            {phase === 'finished'
              ? isLearning ? t.learningDone : interpolate(t.done, { bestStreak })
              : result?.type === 'correct'
                ? t.correct
                : result?.type === 'timeout'
                  ? interpolate(t.timeout, { answer: result.correctAnswer, country: result.correctAnswer })
                  : result?.type === 'wrong'
                    ? interpolate(t.wrong, { answer: result.correctAnswer, country: result.correctAnswer })
                    : isLearning ? t.learningHelper : t[modeMeta.helperKey]}
          </div>

          {isLearning ? (
            <>
              <div className="learning-nav">
                <button className="secondary-button" type="button" disabled={!canGoPreviousLearningCountry} onClick={previousLearningCountry}>
                  <ChevronLeft size={18} />
                  {t.previousCountry}
                </button>
                <button className="primary-button learning-next" type="button" disabled={!canGoNextLearningCountry} onClick={nextLearningCountry}>
                  <ChevronRight size={18} />
                  {roundIndex + 1 >= currentRoundLimit ? t.finishLearning : t.nextCountry}
                </button>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        <div className="map-panel">
          <div className="panel-toolbar" role="toolbar" aria-label={t.mapLayout}>
            <button className="mini-icon-button" type="button" onClick={() => setMapSide('left')} disabled={mapSide === 'left'} aria-label={t.moveMapLeft} title={t.moveMapLeft}>
              <ChevronLeft size={16} />
            </button>
            <button className="mini-icon-button" type="button" onClick={() => setMapSide('right')} disabled={mapSide === 'right'} aria-label={t.moveMapRight} title={t.moveMapRight}>
              <ChevronRight size={16} />
            </button>
            <button className="mini-icon-button" type="button" onClick={() => setMapSize('normal')} disabled={mapSize === 'normal'} aria-label={t.shrinkMap} title={t.shrinkMap}>
              <Minus size={16} />
            </button>
            <button className="mini-icon-button" type="button" onClick={() => setMapSize('large')} disabled={mapSize === 'large'} aria-label={t.enlargeMap} title={t.enlargeMap}>
              <Plus size={16} />
            </button>
            <button className="mini-icon-button" type="button" onClick={() => setMapSize('full')} disabled={mapSize === 'full'} aria-label={t.fullWidthMap} title={t.fullWidthMap}>
              <Maximize2 size={16} />
            </button>
          </div>
          <div className="progress-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p id="map-keyboard-help" className="sr-only">{t.mapKeyboardHelp}</p>
          <div className="map-frame">
            <svg
              className="world-map"
              viewBox={mapViewBox}
              role="img"
              aria-label={t.mapLabel}
              aria-describedby="map-keyboard-help"
              tabIndex={0}
              onKeyDown={controlMapWithKeyboard}
              onPointerDown={startMapDrag}
              onPointerMove={dragMap}
              onPointerUp={stopMapDrag}
              onPointerCancel={stopMapDrag}
              onPointerLeave={(event) => {
                setMapTooltip(null)
                stopMapDrag(event)
              }}
              onWheel={zoomMapWithWheel}
            >
              <defs>
                <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" />
                </pattern>
              </defs>
              <rect className="ocean" width={WIDTH} height={HEIGHT} rx="18" />
              <rect className="map-grid" width={WIDTH} height={HEIGHT} />
              <path className="sphere-outline" d={PATH({ type: 'Sphere' }) ?? undefined} />

              {activeGameMode === 'countries' && !isLearning && (
                <g className="country-hit-layer" aria-hidden="true">
                  {WORLD_FEATURES.map((country, index) => (
                    <path
                      key={`hit-${country.mapId ?? country.properties?.name ?? 'country'}-${index}`}
                      data-iso={country.mapId ?? undefined}
                      className="country-hit-area"
                      d={PATH(country) ?? undefined}
                      onPointerEnter={(event) => showMapTooltip(event, getMapCountryLabel(country))}
                      onPointerMove={(event) => showMapTooltip(event, getMapCountryLabel(country))}
                      onPointerLeave={() => setMapTooltip(null)}
                    />
                  ))}
                </g>
              )}

              <g className="country-layer">
                {WORLD_FEATURES.map((country, index) => (
                  <path
                    key={`${country.mapId ?? country.properties?.name ?? 'country'}-${index}`}
                    data-iso={country.mapId ?? undefined}
                    className={mapCountryClass(country)}
                    d={PATH(country) ?? undefined}
                    onPointerEnter={(event) => showMapTooltip(event, getMapCountryLabel(country))}
                    onPointerMove={(event) => showMapTooltip(event, getMapCountryLabel(country))}
                    onPointerLeave={() => setMapTooltip(null)}
                  >
                    <title>{getMapCountryLabel(country)}</title>
                  </path>
                ))}
              </g>

              <path className="country-borders" d={PATH(BORDERS_GEO) ?? undefined} />

              {isLearning && phase !== 'setup' && capitalPoint && (
                <g className="capital-marker" aria-label={learningCapital ?? undefined}>
                  <circle cx={capitalPoint[0]} cy={capitalPoint[1]} r={capitalMarkerRadius} />
                </g>
              )}

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

            {mapTooltip && <div className="map-tooltip" style={{ left: mapTooltip.x, top: mapTooltip.y }}>{mapTooltip.text}</div>}

            <div className="map-zoom-controls" role="toolbar" aria-label={t.zoomMap}>
              <button type="button" onClick={() => zoomMap(-1)} disabled={!canZoomOut} aria-label={t.zoomOutMap} title={t.zoomOutMap}>
                <Minus size={18} />
              </button>
              <button type="button" onClick={() => zoomMap(1)} disabled={!canZoomIn} aria-label={t.zoomInMap} title={t.zoomInMap}>
                <Plus size={18} />
              </button>
            </div>

            {phase === 'paused' && (
              <div className="map-overlay">
                <Settings2 size={28} />
                <strong>{t.paused}</strong>
              </div>
            )}

            {phase === 'finished' && (
              <div className="map-overlay">
                <TimerReset size={30} />
                <strong>{isLearning ? t.learningDone : score >= Math.ceil(roundLimit * 0.8) ? t.greatResult : t.tryAgain}</strong>
                <button className="primary-button" type="button" onClick={startGame}>
                  <Play size={18} />
                  {t.playAgain}
                </button>
              </div>
            )}
          </div>

          {isLearning && (countryFactsLoading || countryFacts.length > 0) && (
            <section className="country-facts" aria-label={t.countryFacts}>
              <h3>{t.countryFacts}</h3>
              {countryFactsLoading ? (
                <p>{t.loadingFacts}</p>
              ) : (
                <dl>
                  {countryFacts.map((fact) => (
                    <div key={fact.label}>
                      <dt>{fact.label}</dt>
                      <dd>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
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
