/** 碳滑板弓–板拓扑（与后端 strip_topology 对齐） */

const DEFAULT_SLOTS = [
  { key: 'bow2_0', bow_id: 'bow2', bow_label: '2车弓', strip_idx: 0, label: '2车弓板1', legacy_field: 'thick_car2' },
  { key: 'bow2_1', bow_id: 'bow2', bow_label: '2车弓', strip_idx: 1, label: '2车弓板2', legacy_field: 'thick_col1' },
  { key: 'bow5_0', bow_id: 'bow5', bow_label: '5车弓', strip_idx: 0, label: '5车弓板1', legacy_field: 'thick_car5' },
  { key: 'bow5_1', bow_id: 'bow5', bow_label: '5车弓', strip_idx: 1, label: '5车弓板2', legacy_field: 'thick_col2' },
]

const STRIP_COLORS = ['#3488d9', '#5a9ee3', '#3dbfad', '#6ed0c2', '#e8a84a', '#f0c078', '#9b7bdb', '#c4a8f0']

export function defaultTopology(stripsPerBow = 2) {
  const n = [2, 3, 4].includes(Number(stripsPerBow)) ? Number(stripsPerBow) : 2
  if (n === 2) {
    return {
      bow_count: 2,
      strips_per_bow: 2,
      total_strips: 4,
      bows: [
        { id: 'bow2', label: '2车弓' },
        { id: 'bow5', label: '5车弓' },
      ],
      slots: DEFAULT_SLOTS,
      summary: '双弓2板（共4块）',
    }
  }
  const bows = [
    { id: 'bow2', label: '2车弓' },
    { id: 'bow5', label: '5车弓' },
  ]
  const slots = []
  for (const b of bows) {
    for (let i = 0; i < n; i++) {
      slots.push({
        key: `${b.id}_${i}`,
        bow_id: b.id,
        bow_label: b.label,
        strip_idx: i,
        label: `${b.label}板${i + 1}`,
        legacy_field: i < 2 ? DEFAULT_SLOTS.find((s) => s.bow_id === b.id && s.strip_idx === i)?.legacy_field : null,
      })
    }
  }
  return {
    bow_count: 2,
    strips_per_bow: n,
    total_strips: n * 2,
    bows,
    slots,
    summary: `双弓${n}板（共${n * 2}块）`,
  }
}

export function resolveTopology(source) {
  if (source?.topology?.slots?.length) return source.topology
  if (source?.strips_per_bow) return defaultTopology(source.strips_per_bow)
  return defaultTopology(2)
}

export function stripColor(idx) {
  return STRIP_COLORS[idx % STRIP_COLORS.length]
}

/** 从测点行取某槽位厚度 */
export function slotValue(row, slot) {
  if (!row || !slot) return null
  if (row.strip_values && row.strip_values[slot.key] != null) return row.strip_values[slot.key]
  if (row.strips?.[slot.bow_id]?.[slot.strip_idx] != null) return row.strips[slot.bow_id][slot.strip_idx]
  if (slot.legacy_field && row[slot.legacy_field] != null) return row[slot.legacy_field]
  return null
}

export function emptyStripValues(topo) {
  const out = {}
  for (const s of topo.slots || []) out[s.key] = null
  return out
}

export function stripValuesFromRow(row, topo) {
  const out = emptyStripValues(topo)
  for (const s of topo.slots || []) {
    out[s.key] = slotValue(row, s)
  }
  return out
}

export function payloadFromStripValues(stripValues, topo) {
  const strips = {}
  for (const b of topo.bows || []) strips[b.id] = Array(topo.strips_per_bow).fill(null)
  for (const s of topo.slots || []) {
    const v = stripValues?.[s.key]
    if (v != null && v !== '') strips[s.bow_id][s.strip_idx] = Number(v)
  }
  const legacy = {}
  for (const s of topo.slots || []) {
    if (s.legacy_field) legacy[s.legacy_field] = stripValues?.[s.key] ?? null
  }
  return { strips, ...legacy, strip_values: stripValues }
}
