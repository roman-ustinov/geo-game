import { countries as countryDirectory } from 'countries-list'
import isoCountries from 'i18n-iso-countries'
import enLocale from 'i18n-iso-countries/langs/en.json'
import skLocale from 'i18n-iso-countries/langs/sk.json'
import { feature, mesh } from 'topojson-client'
import world from 'world-atlas/countries-50m.json'
import type { FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'
import type { ContinentCode, CountryFeature, Language, LocalizedName, PlayableCountry } from '../types'

isoCountries.registerLocale(enLocale)
isoCountries.registerLocale(skLocale)

const SPECIAL_GEO_IDS: Record<string, string> = {
  Kosovo: 'XK',
  'N. Cyprus': 'XNC',
  Somaliland: 'XSOM',
}

const SPECIAL_COUNTRIES: Record<string, { name: LocalizedName; capital: string; continent: ContinentCode }> = {
  XK: { name: { en: 'Kosovo', sk: 'Kosovo' }, capital: 'Pristina', continent: 'EU' },
  XNC: { name: { en: 'Northern Cyprus', sk: 'Severný Cyprus' }, capital: 'North Nicosia', continent: 'EU' },
  XSOM: { name: { en: 'Somaliland', sk: 'Somaliland' }, capital: 'Hargeisa', continent: 'AF' },
}

const topology = world as unknown as Topology
const countriesObject = topology.objects.countries
const worldFeatureCollection = feature(topology, countriesObject) as FeatureCollection<Geometry, { name?: string }>

export const WORLD_FEATURES: CountryFeature[] = worldFeatureCollection.features.map((country) => ({
  ...country,
  mapId: String(country.id ?? SPECIAL_GEO_IDS[country.properties?.name ?? '']),
}))

export const BORDERS_GEO = mesh(topology, countriesObject as never, (a, b) => a !== b)

const geoByIso = new Map(WORLD_FEATURES.filter((country) => country.mapId).map((country) => [country.mapId, country]))

const standardPlayable = Object.entries(countryDirectory)
  .map(([alpha2, country]) => {
    const iso = isoCountries.alpha2ToNumeric(alpha2)
    const geo = iso ? geoByIso.get(iso) : null
    return {
      id: alpha2.toLowerCase(),
      iso,
      name: geo?.properties?.name ?? country.name,
      continent: country.continent,
      capital: country.capital,
      geo,
    }
  })
  .filter((country): country is PlayableCountry => Boolean(country.iso && country.geo && country.capital && country.continent !== 'AN'))

const specialPlayable = Object.entries(SPECIAL_COUNTRIES)
  .map(([iso, country]) => ({
    id: iso.toLowerCase(),
    iso,
    name: country.name.en,
    continent: country.continent,
    capital: country.capital,
    geo: geoByIso.get(iso),
  }))
  .filter((country): country is PlayableCountry => Boolean(country.geo))

export const PLAYABLE_COUNTRIES = [...standardPlayable, ...specialPlayable].sort((a, b) => a.name.localeCompare(b.name))

export function getCountryDisplayName(iso: string | undefined, language: Language): string {
  if (!iso) return ''
  const special = SPECIAL_COUNTRIES[iso]
  if (special) return special.name[language] ?? special.name.en

  const alpha2 = isoCountries.numericToAlpha2(iso)
  if (!alpha2) return iso
  return isoCountries.getName(alpha2, language) ?? isoCountries.getName(alpha2, 'en') ?? iso
}
