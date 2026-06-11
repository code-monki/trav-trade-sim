import {
  UWP_STARPORT, UWP_SIZE, UWP_ATMOSPHERE, UWP_HYDRO,
  UWP_POPULATION, UWP_GOVERNMENT, UWP_LAW, UWP_TECH,
} from './traveller-data.js'

export function parseSectorRoutes(xmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  if (doc.querySelector('parsererror')) return []

  const routes = []
  doc.querySelectorAll('Routes Route').forEach(el => {
    routes.push({
      start:        el.getAttribute('Start')        || '',
      end:          el.getAttribute('End')          || '',
      allegiance:   el.getAttribute('Allegiance')   || '',
      type:         el.getAttribute('Type')         || '',
      style:        el.getAttribute('Style')        || '',
      color:        el.getAttribute('Color')        || '',
      startOffsetX: parseInt(el.getAttribute('StartOffsetX') || '0', 10),
      startOffsetY: parseInt(el.getAttribute('StartOffsetY') || '0', 10),
      endOffsetX:   parseInt(el.getAttribute('EndOffsetX')   || '0', 10),
      endOffsetY:   parseInt(el.getAttribute('EndOffsetY')   || '0', 10),
    })
  })
  return routes
}

export function decodeUWP(uwp) {
  if (!uwp || uwp.length < 2) return []
  const parts = uwp.split('-')
  const main = parts[0] || ''
  const tech = parts[1] || ''
  const lu = (table, ch) => {
    if (!ch) return 'Unknown'
    return table[ch.toUpperCase()] || table[ch] || 'Unknown'
  }
  return [
    { label: 'Starport',      value: main[0] || '?', description: lu(UWP_STARPORT,    main[0]) },
    { label: 'Size',          value: main[1] || '?', description: lu(UWP_SIZE,         main[1]) },
    { label: 'Atmosphere',    value: main[2] || '?', description: lu(UWP_ATMOSPHERE,   main[2]) },
    { label: 'Hydrographics', value: main[3] || '?', description: lu(UWP_HYDRO,        main[3]) },
    { label: 'Population',    value: main[4] || '?', description: lu(UWP_POPULATION,   main[4]) },
    { label: 'Government',    value: main[5] || '?', description: lu(UWP_GOVERNMENT,   main[5]) },
    { label: 'Law Level',     value: main[6] || '?', description: lu(UWP_LAW,          main[6]) },
    { label: 'Tech Level',    value: tech    || '?', description: lu(UWP_TECH,          tech)    },
  ]
}

export function parseTabDelimited(text) {
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'))
  if (lines.length < 2) return { headers: [], worlds: [] }

  const headers = lines[0].split('\t').map(h => h.trim())
  const worlds = lines.slice(1).map(line => {
    const values = line.split('\t')
    const world = {}
    headers.forEach((h, i) => {
      world[h] = values[i] !== undefined ? values[i].trim() : ''
    })
    return world
  }).filter(w => Object.values(w).some(v => v))

  return { headers, worlds }
}
