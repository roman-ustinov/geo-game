import type { GameMode, Language, WaterFeature } from '../types'

type FeatureGameMode = Exclude<GameMode, 'countries'>

export const WATER_FEATURES_BY_MODE: Record<FeatureGameMode, WaterFeature[]> = {
  lakes: [
    {
      id: 'lake-superior',
      name: { en: 'Lake Superior', sk: 'Horné jazero' },
      regions: [{ center: [-87.5, 47.7], radiusLon: 4.6, radiusLat: 1.25 }],
    },
    {
      id: 'lake-michigan',
      name: { en: 'Lake Michigan', sk: 'Michiganské jazero' },
      regions: [{ center: [-87.1, 44.2], radiusLon: 1.15, radiusLat: 3.05 }],
    },
    {
      id: 'lake-huron',
      name: { en: 'Lake Huron', sk: 'Hurónske jazero' },
      regions: [{ center: [-82.5, 45.1], radiusLon: 2.45, radiusLat: 1.9 }],
    },
    {
      id: 'lake-victoria',
      name: { en: 'Lake Victoria', sk: 'Viktóriino jazero' },
      regions: [{ center: [33.1, -1.1], radiusLon: 2.65, radiusLat: 1.65 }],
    },
    {
      id: 'lake-tanganyika',
      name: { en: 'Lake Tanganyika', sk: 'Tanganika' },
      regions: [{ center: [29.55, -6.15], radiusLon: 0.82, radiusLat: 3.35 }],
    },
    {
      id: 'lake-malawi',
      name: { en: 'Lake Malawi', sk: 'Malawi' },
      regions: [{ center: [34.55, -12.05], radiusLon: 0.78, radiusLat: 3.0 }],
    },
    {
      id: 'lake-baikal',
      name: { en: 'Lake Baikal', sk: 'Bajkal' },
      regions: [{ center: [108.05, 53.55], radiusLon: 1.0, radiusLat: 2.65 }],
    },
    {
      id: 'great-bear-lake',
      name: { en: 'Great Bear Lake', sk: 'Veľké Medvedie jazero' },
      regions: [{ center: [-121.2, 66.0], radiusLon: 2.65, radiusLat: 1.25 }],
    },
    {
      id: 'great-slave-lake',
      name: { en: 'Great Slave Lake', sk: 'Veľké Otročie jazero' },
      regions: [{ center: [-114.5, 61.55], radiusLon: 2.5, radiusLat: 1.05 }],
    },
    {
      id: 'lake-winnipeg',
      name: { en: 'Lake Winnipeg', sk: 'Winnipežské jazero' },
      regions: [{ center: [-98.25, 52.85], radiusLon: 1.45, radiusLat: 2.5 }],
    },
    {
      id: 'lake-titicaca',
      name: { en: 'Lake Titicaca', sk: 'Titicaca' },
      regions: [{ center: [-69.35, -15.8], radiusLon: 1.1, radiusLat: 0.78 }],
    },
    {
      id: 'lake-chad',
      name: { en: 'Lake Chad', sk: 'Čadské jazero' },
      regions: [{ center: [14.3, 13.05], radiusLon: 1.25, radiusLat: 0.85 }],
    },
    {
      id: 'aral-sea',
      name: { en: 'Aral Sea', sk: 'Aralské jazero' },
      regions: [{ center: [59.2, 45.1], radiusLon: 1.35, radiusLat: 0.85 }],
    },
    {
      id: 'dead-sea',
      name: { en: 'Dead Sea', sk: 'Mŕtve more' },
      regions: [{ center: [35.5, 31.5], radiusLon: 0.35, radiusLat: 0.75 }],
    },
    {
      id: 'lake-nicaragua',
      name: { en: 'Lake Nicaragua', sk: 'Nikaragujské jazero' },
      regions: [{ center: [-85.35, 11.6], radiusLon: 1.05, radiusLat: 0.7 }],
    },
  ],
  seas: [
    {
      id: 'mediterranean-sea',
      name: { en: 'Mediterranean Sea', sk: 'Stredozemné more' },
      regions: [{ center: [17.8, 35.2], radiusLon: 21.0, radiusLat: 4.6 }],
    },
    {
      id: 'caribbean-sea',
      name: { en: 'Caribbean Sea', sk: 'Karibské more' },
      regions: [{ center: [-75.0, 15.3], radiusLon: 10.2, radiusLat: 4.25 }],
    },
    {
      id: 'black-sea',
      name: { en: 'Black Sea', sk: 'Čierne more' },
      regions: [{ center: [34.4, 43.3], radiusLon: 5.2, radiusLat: 2.05 }],
    },
    {
      id: 'red-sea',
      name: { en: 'Red Sea', sk: 'Červené more' },
      regions: [{ center: [38.2, 20.5], radiusLon: 2.05, radiusLat: 7.2 }],
    },
    {
      id: 'baltic-sea',
      name: { en: 'Baltic Sea', sk: 'Baltské more' },
      regions: [{ center: [20.0, 58.2], radiusLon: 4.1, radiusLat: 4.85 }],
    },
    {
      id: 'north-sea',
      name: { en: 'North Sea', sk: 'Severné more' },
      regions: [{ center: [2.4, 56.0], radiusLon: 4.3, radiusLat: 4.0 }],
    },
    {
      id: 'norwegian-sea',
      name: { en: 'Norwegian Sea', sk: 'Nórske more' },
      regions: [{ center: [2.5, 68.2], radiusLon: 8.0, radiusLat: 5.0 }],
    },
    {
      id: 'barents-sea',
      name: { en: 'Barents Sea', sk: 'Barentsovo more' },
      regions: [{ center: [39.5, 74.6], radiusLon: 11.5, radiusLat: 4.0 }],
    },
    {
      id: 'arabian-sea',
      name: { en: 'Arabian Sea', sk: 'Arabské more' },
      regions: [{ center: [62.0, 16.1], radiusLon: 12.2, radiusLat: 7.2 }],
    },
    {
      id: 'bay-of-bengal',
      name: { en: 'Bay of Bengal', sk: 'Bengálsky záliv' },
      regions: [{ center: [88.0, 14.0], radiusLon: 9.7, radiusLat: 7.8 }],
    },
    {
      id: 'south-china-sea',
      name: { en: 'South China Sea', sk: 'Juhočínske more' },
      regions: [{ center: [114.8, 12.0], radiusLon: 8.5, radiusLat: 8.0 }],
    },
    {
      id: 'east-china-sea',
      name: { en: 'East China Sea', sk: 'Východočínske more' },
      regions: [{ center: [126.0, 29.0], radiusLon: 5.1, radiusLat: 3.8 }],
    },
    {
      id: 'sea-of-japan',
      name: { en: 'Sea of Japan', sk: 'Japonské more' },
      regions: [{ center: [135.0, 41.2], radiusLon: 3.25, radiusLat: 4.9 }],
    },
    {
      id: 'bering-sea',
      name: { en: 'Bering Sea', sk: 'Beringovo more' },
      regions: [{ center: [-172.0, 58.0], radiusLon: 8.4, radiusLat: 5.8 }],
    },
    {
      id: 'coral-sea',
      name: { en: 'Coral Sea', sk: 'Koralové more' },
      regions: [{ center: [154.0, -18.0], radiusLon: 9.8, radiusLat: 6.8 }],
    },
    {
      id: 'tasman-sea',
      name: { en: 'Tasman Sea', sk: 'Tasmanovo more' },
      regions: [{ center: [160.0, -39.5], radiusLon: 7.8, radiusLat: 7.0 }],
    },
  ],
  oceans: [
    {
      id: 'pacific-ocean',
      name: { en: 'Pacific Ocean', sk: 'Tichý oceán' },
      regions: [
        { center: [-138.0, 0.0], radiusLon: 42.0, radiusLat: 54.0 },
        { center: [158.0, 0.0], radiusLon: 25.0, radiusLat: 52.0 },
      ],
    },
    {
      id: 'atlantic-ocean',
      name: { en: 'Atlantic Ocean', sk: 'Atlantický oceán' },
      regions: [{ center: [-30.0, 0.0], radiusLon: 25.5, radiusLat: 57.0 }],
    },
    {
      id: 'indian-ocean',
      name: { en: 'Indian Ocean', sk: 'Indický oceán' },
      regions: [{ center: [79.0, -24.0], radiusLon: 31.0, radiusLat: 32.0 }],
    },
    {
      id: 'southern-ocean',
      name: { en: 'Southern Ocean', sk: 'Južný oceán' },
      regions: [{ center: [0.0, -64.0], radiusLon: 90.0, radiusLat: 12.5 }],
    },
    {
      id: 'arctic-ocean',
      name: { en: 'Arctic Ocean', sk: 'Severný ľadový oceán' },
      regions: [{ center: [0.0, 78.5], radiusLon: 86.0, radiusLat: 11.5 }],
    },
  ],
  rivers: [
    {
      id: 'nile-river',
      name: { en: 'Nile', sk: 'Níl' },
      lineWidth: 10,
      paths: [[[31.2, 30.1], [31.0, 25.7], [32.2, 18.0], [33.5, 10.0], [31.7, 2.5], [30.4, -2.0]]],
    },
    {
      id: 'amazon-river',
      name: { en: 'Amazon River', sk: 'Amazonka' },
      lineWidth: 12,
      paths: [[[-73.5, -4.5], [-68.0, -4.0], [-62.0, -3.2], [-56.0, -2.4], [-50.2, -1.5]]],
    },
    {
      id: 'mississippi-river',
      name: { en: 'Mississippi River', sk: 'Mississippi' },
      lineWidth: 10,
      paths: [[[-95.2, 47.2], [-93.5, 42.0], [-91.5, 36.0], [-90.2, 32.0], [-89.3, 29.2]]],
    },
    {
      id: 'yangtze-river',
      name: { en: 'Yangtze River', sk: 'Jang-c’-ťiang' },
      lineWidth: 10,
      paths: [[[91.0, 33.5], [99.0, 30.5], [106.0, 30.7], [112.0, 30.0], [121.0, 31.2]]],
    },
    {
      id: 'yellow-river',
      name: { en: 'Yellow River', sk: 'Žltá rieka' },
      lineWidth: 9,
      paths: [[[96.0, 35.2], [103.0, 36.0], [108.0, 34.8], [112.5, 35.4], [119.0, 37.7]]],
    },
    {
      id: 'danube-river',
      name: { en: 'Danube', sk: 'Dunaj' },
      lineWidth: 8,
      paths: [[[8.2, 48.0], [14.4, 48.2], [19.0, 47.8], [23.5, 45.4], [29.6, 45.2]]],
    },
    {
      id: 'ganges-river',
      name: { en: 'Ganges', sk: 'Ganga' },
      lineWidth: 9,
      paths: [[[78.5, 30.0], [82.0, 25.4], [87.5, 24.0], [90.4, 23.6]]],
    },
    {
      id: 'mekong-river',
      name: { en: 'Mekong', sk: 'Mekong' },
      lineWidth: 8,
      paths: [[[94.5, 33.0], [98.5, 25.0], [101.5, 19.0], [104.5, 14.0], [106.2, 10.2]]],
    },
    {
      id: 'congo-river',
      name: { en: 'Congo River', sk: 'Kongo' },
      lineWidth: 10,
      paths: [[[25.0, -10.0], [21.0, -4.5], [17.5, -1.0], [14.5, -4.5], [12.2, -6.0]]],
    },
    {
      id: 'volga-river',
      name: { en: 'Volga', sk: 'Volga' },
      lineWidth: 8,
      paths: [[[33.0, 57.5], [39.5, 56.0], [45.5, 52.0], [47.8, 46.5]]],
    },
  ],
  mountains: [
    {
      id: 'himalayas',
      name: { en: 'Himalayas', sk: 'Himaláje' },
      regions: [{ center: [84.0, 29.2], radiusLon: 16.5, radiusLat: 3.0 }],
    },
    {
      id: 'andes',
      name: { en: 'Andes', sk: 'Andy' },
      regions: [{ center: [-71.5, -22.0], radiusLon: 3.0, radiusLat: 32.0 }],
    },
    {
      id: 'rocky-mountains',
      name: { en: 'Rocky Mountains', sk: 'Skalnaté vrchy' },
      regions: [{ center: [-114.0, 45.0], radiusLon: 4.8, radiusLat: 15.0 }],
    },
    {
      id: 'alps',
      name: { en: 'Alps', sk: 'Alpy' },
      regions: [{ center: [10.5, 46.4], radiusLon: 5.8, radiusLat: 1.8 }],
    },
    {
      id: 'atlas-mountains',
      name: { en: 'Atlas Mountains', sk: 'Atlas' },
      regions: [{ center: [-5.0, 31.5], radiusLon: 7.5, radiusLat: 2.2 }],
    },
    {
      id: 'ural-mountains',
      name: { en: 'Ural Mountains', sk: 'Ural' },
      regions: [{ center: [60.0, 58.0], radiusLon: 3.2, radiusLat: 12.5 }],
    },
    {
      id: 'great-dividing-range',
      name: { en: 'Great Dividing Range', sk: 'Veľké predelové vrchy' },
      regions: [{ center: [150.0, -27.0], radiusLon: 3.0, radiusLat: 12.0 }],
    },
    {
      id: 'caucasus',
      name: { en: 'Caucasus Mountains', sk: 'Kaukaz' },
      regions: [{ center: [44.5, 42.6], radiusLon: 5.4, radiusLat: 1.7 }],
    },
  ],
  deserts: [
    {
      id: 'sahara',
      name: { en: 'Sahara', sk: 'Sahara' },
      regions: [{ center: [13.0, 23.5], radiusLon: 29.0, radiusLat: 9.5 }],
    },
    {
      id: 'arabian-desert',
      name: { en: 'Arabian Desert', sk: 'Arabská púšť' },
      regions: [{ center: [45.0, 23.0], radiusLon: 12.0, radiusLat: 7.0 }],
    },
    {
      id: 'gobi-desert',
      name: { en: 'Gobi Desert', sk: 'Gobi' },
      regions: [{ center: [103.0, 42.5], radiusLon: 12.5, radiusLat: 4.2 }],
    },
    {
      id: 'kalahari-desert',
      name: { en: 'Kalahari Desert', sk: 'Kalahari' },
      regions: [{ center: [22.0, -23.0], radiusLon: 7.2, radiusLat: 5.8 }],
    },
    {
      id: 'atacama-desert',
      name: { en: 'Atacama Desert', sk: 'Atacama' },
      regions: [{ center: [-69.5, -23.5], radiusLon: 1.6, radiusLat: 7.0 }],
    },
    {
      id: 'great-victoria-desert',
      name: { en: 'Great Victoria Desert', sk: 'Veľká Viktóriina púšť' },
      regions: [{ center: [129.0, -29.0], radiusLon: 9.0, radiusLat: 4.8 }],
    },
    {
      id: 'great-basin-desert',
      name: { en: 'Great Basin Desert', sk: 'Veľká panvová púšť' },
      regions: [{ center: [-116.0, 40.0], radiusLon: 5.8, radiusLat: 4.0 }],
    },
    {
      id: 'taklamakan-desert',
      name: { en: 'Taklamakan Desert', sk: 'Taklamakan' },
      regions: [{ center: [82.0, 39.5], radiusLon: 7.5, radiusLat: 3.0 }],
    },
  ],
  islands: [
    {
      id: 'greenland',
      name: { en: 'Greenland', sk: 'Grónsko' },
      regions: [{ center: [-42.0, 72.0], radiusLon: 13.0, radiusLat: 11.0 }],
    },
    {
      id: 'madagascar',
      name: { en: 'Madagascar', sk: 'Madagaskar' },
      regions: [{ center: [47.0, -20.0], radiusLon: 3.5, radiusLat: 7.2 }],
    },
    {
      id: 'borneo',
      name: { en: 'Borneo', sk: 'Borneo' },
      regions: [{ center: [114.0, 0.8], radiusLon: 5.2, radiusLat: 4.8 }],
    },
    {
      id: 'new-guinea',
      name: { en: 'New Guinea', sk: 'Nová Guinea' },
      regions: [{ center: [143.5, -5.5], radiusLon: 8.8, radiusLat: 3.9 }],
    },
    {
      id: 'sumatra',
      name: { en: 'Sumatra', sk: 'Sumatra' },
      regions: [{ center: [101.0, -0.6], radiusLon: 3.6, radiusLat: 6.0 }],
    },
    {
      id: 'honshu',
      name: { en: 'Honshu', sk: 'Honšu' },
      regions: [{ center: [138.5, 37.5], radiusLon: 4.6, radiusLat: 2.8 }],
    },
    {
      id: 'great-britain',
      name: { en: 'Great Britain', sk: 'Veľká Británia' },
      regions: [{ center: [-2.5, 54.5], radiusLon: 3.2, radiusLat: 4.4 }],
    },
    {
      id: 'iceland',
      name: { en: 'Iceland', sk: 'Island' },
      regions: [{ center: [-19.0, 65.0], radiusLon: 3.7, radiusLat: 1.8 }],
    },
    {
      id: 'cuba',
      name: { en: 'Cuba', sk: 'Kuba' },
      regions: [{ center: [-79.5, 21.8], radiusLon: 5.2, radiusLat: 1.2 }],
    },
    {
      id: 'new-zealand',
      name: { en: 'New Zealand', sk: 'Nový Zéland' },
      regions: [
        { center: [172.8, -41.0], radiusLon: 2.4, radiusLat: 3.4 },
        { center: [169.5, -45.2], radiusLon: 2.2, radiusLat: 3.2 },
      ],
    },
  ],
}

export function getWaterFeatures(mode: GameMode): WaterFeature[] {
  return mode === 'countries' ? [] : WATER_FEATURES_BY_MODE[mode]
}

export function getWaterFeatureDisplayName(featureOrId: WaterFeature | string, language: Language, mode?: GameMode): string {
  const feature = typeof featureOrId === 'string'
    ? getWaterFeatures(mode ?? 'countries').find((item) => item.id === featureOrId)
    : featureOrId

  if (!feature) return ''
  return feature.name[language] ?? feature.name.en
}
