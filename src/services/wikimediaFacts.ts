import type { Language } from '../types'

export type CountryFact = {
  label: string
  value: string
}

const FIELD_LABELS: Record<Language, Record<string, string>> = {
  sk: {
    nativeName: 'Miestny názov',
    capital: 'Hlavné mesto',
    largestCity: 'Najväčšie mesto',
    officialLanguage: 'Úradné jazyky',
    demonym: 'Demonym',
    government: 'Štátne zriadenie',
    headOfState: 'Prezident / hlava štátu',
    headOfGovernment: 'Predseda vlády',
    inception: 'Vznik',
    border: 'Susedia',
    area: 'Rozloha',
    population: 'Počet obyvateľov',
    gdp: 'HDP',
    hdi: 'Index ľudského rozvoja',
    currency: 'Mena',
    timeZone: 'Časové pásmo',
    iso: 'Medzinárodný kód',
    vehicleCode: 'Medzinárodná poznávacia značka',
    topLevelDomain: 'Internetová doména',
    callingCode: 'Smerové telefónne číslo',
    funFacts: 'Zaujímavosti',
  },
  en: {
    nativeName: 'Local name',
    capital: 'Capital',
    largestCity: 'Largest city',
    officialLanguage: 'Official languages',
    demonym: 'Demonym',
    government: 'Government',
    headOfState: 'Head of state',
    headOfGovernment: 'Head of government',
    inception: 'Formation',
    border: 'Borders',
    area: 'Area',
    population: 'Population',
    gdp: 'GDP',
    hdi: 'Human Development Index',
    currency: 'Currency',
    timeZone: 'Time zone',
    iso: 'ISO code',
    vehicleCode: 'Vehicle code',
    topLevelDomain: 'Internet domain',
    callingCode: 'Calling code',
    funFacts: 'Fun facts',
  },
}

const cache = new Map<string, CountryFact[]>()

function formatNumber(value: string, unit = ''): string {
  return `${Number(value).toLocaleString('sk-SK')}${unit}`
}

function addFact(facts: CountryFact[], language: Language, key: string, value: string | null | undefined) {
  if (!value) return
  facts.push({ label: FIELD_LABELS[language][key], value })
}

function unique(values: Array<string | undefined>): string {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].join(', ')
}

export async function getCountryFacts(alpha2: string, language: Language): Promise<CountryFact[]> {
  const cacheKey = `${language}:${alpha2}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const query = `
SELECT ?description ?nativeName ?capitalLabel ?largestCityLabel ?officialLanguageLabel ?demonym ?governmentLabel ?headOfStateLabel ?headOfGovernmentLabel ?inception ?borderLabel ?area ?population ?gdp ?hdi ?currencyLabel ?timeZoneLabel ?iso2 ?iso3 ?vehicleCode ?topLevelDomainLabel ?callingCode WHERE {
  ?country wdt:P297 "${alpha2}".
  OPTIONAL { ?country schema:description ?description. FILTER(LANG(?description) = "${language}") }
  OPTIONAL { ?country wdt:P1705 ?nativeName. }
  OPTIONAL { ?country wdt:P36 ?capital. }
  OPTIONAL { ?country wdt:P31 wd:Q3624078; wdt:P131* ?country. }
  OPTIONAL { ?country wdt:P37 ?officialLanguage. }
  OPTIONAL { ?country wdt:P1549 ?demonym. FILTER(LANG(?demonym) = "${language}") }
  OPTIONAL { ?country wdt:P122 ?government. }
  OPTIONAL { ?country wdt:P35 ?headOfState. }
  OPTIONAL { ?country wdt:P6 ?headOfGovernment. }
  OPTIONAL { ?country wdt:P571 ?inception. }
  OPTIONAL { ?country wdt:P47 ?border. }
  OPTIONAL { ?country wdt:P2046 ?area. }
  OPTIONAL { ?country wdt:P1082 ?population. }
  OPTIONAL { ?country wdt:P2131 ?gdp. }
  OPTIONAL { ?country wdt:P1081 ?hdi. }
  OPTIONAL { ?country wdt:P38 ?currency. }
  OPTIONAL { ?country wdt:P421 ?timeZone. }
  OPTIONAL { ?country wdt:P297 ?iso2. }
  OPTIONAL { ?country wdt:P298 ?iso3. }
  OPTIONAL { ?country wdt:P395 ?vehicleCode. }
  OPTIONAL { ?country wdt:P78 ?topLevelDomain. }
  OPTIONAL { ?country wdt:P474 ?callingCode. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${language},en". }
}
LIMIT 500`
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8000)
  let data: { results?: { bindings?: Array<Record<string, { value: string }>> } }
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return []
    data = await response.json() as { results?: { bindings?: Array<Record<string, { value: string }>> } }
  } catch {
    return []
  } finally {
    window.clearTimeout(timeout)
  }

  const rows = data.results?.bindings ?? []
  const get = (key: string) => unique(rows.map((row) => row[key]?.value))
  const first = (key: string) => rows.find((row) => row[key]?.value)?.[key]?.value
  const facts: CountryFact[] = []

  addFact(facts, language, 'nativeName', get('nativeName'))
  addFact(facts, language, 'capital', get('capitalLabel'))
  addFact(facts, language, 'largestCity', get('largestCityLabel'))
  addFact(facts, language, 'officialLanguage', get('officialLanguageLabel'))
  addFact(facts, language, 'demonym', get('demonym'))
  addFact(facts, language, 'government', get('governmentLabel'))
  addFact(facts, language, 'headOfState', get('headOfStateLabel'))
  addFact(facts, language, 'headOfGovernment', get('headOfGovernmentLabel'))
  addFact(facts, language, 'inception', first('inception')?.slice(0, 10))
  addFact(facts, language, 'border', get('borderLabel'))
  addFact(facts, language, 'area', first('area') ? `${formatNumber(first('area') ?? '', ' km²')}` : null)
  addFact(facts, language, 'population', first('population') ? formatNumber(first('population') ?? '') : null)
  addFact(facts, language, 'gdp', first('gdp') ? `${formatNumber(first('gdp') ?? '')} USD` : null)
  addFact(facts, language, 'hdi', first('hdi'))
  addFact(facts, language, 'currency', get('currencyLabel'))
  addFact(facts, language, 'timeZone', get('timeZoneLabel'))
  addFact(facts, language, 'iso', [get('iso3'), get('iso2')].filter(Boolean).join(' / '))
  addFact(facts, language, 'vehicleCode', get('vehicleCode'))
  addFact(facts, language, 'topLevelDomain', get('topLevelDomainLabel'))
  addFact(facts, language, 'callingCode', get('callingCode'))

  const borders = rows.map((row) => row.borderLabel?.value).filter((value): value is string => Boolean(value))
  const funFacts = [
    first('description'),
    borders.length ? `${language === 'sk' ? 'Počet susedov' : 'Number of bordering countries'}: ${new Set(borders).size}` : undefined,
    get('timeZoneLabel') ? `${language === 'sk' ? 'Časové pásma' : 'Time zones'}: ${get('timeZoneLabel')}` : undefined,
    get('currencyLabel') ? `${language === 'sk' ? 'Používaná mena' : 'Currency used'}: ${get('currencyLabel')}` : undefined,
    get('topLevelDomainLabel') ? `${language === 'sk' ? 'Internetová doména' : 'Internet domain'}: ${get('topLevelDomainLabel')}` : undefined,
  ].filter((value): value is string => Boolean(value))
  addFact(facts, language, 'funFacts', funFacts.map((fact) => `• ${fact}`).join('\n'))

  cache.set(cacheKey, facts)
  return facts
}
