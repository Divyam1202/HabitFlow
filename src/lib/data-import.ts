export type ImportStrategy = 'merge' | 'replace'
export type ImportSourceType = 'habytflow-backup' | 'generic-json' | 'csv'

export type ClientSettings = {
  timeFormat?: '12h' | '24h'
  theme?: 'system' | 'dark' | 'light'
}

export type ImportedHabit = {
  name: string
  category?: string
  time?: string
  frequency?: number[]
}

export type ImportedCompletion = {
  habitName: string
  date: string
  completed: boolean
  notes?: string
}

export type ImportedNutritionRecord = {
  date: string
  hydration?: number
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
}

export type ImportedSportRecord = {
  date: string
  name: string
  durationHours: number
}

export type ImportedNoteRecord = {
  date: string
  content: string
}

export type ImportedNotificationRecord = Record<string, unknown>

export type ImportedNotificationLogRecord = Record<string, unknown>

export type DataImportBundle = {
  fileName: string
  sourceType: ImportSourceType
  sourceLabel: string
  habits: ImportedHabit[]
  legacyHabits: Record<string, unknown>[]
  completionRecords: ImportedCompletion[]
  nutritionRecords: ImportedNutritionRecord[]
  sportsRecords: ImportedSportRecord[]
  notes: ImportedNoteRecord[]
  notifications: ImportedNotificationRecord[]
  notificationLogs: ImportedNotificationLogRecord[]
  archives: unknown[]
  settings: ClientSettings
  rawStateData: Record<string, unknown> | null
  invalidRecords: Array<{ reason: string; raw?: unknown }>
  duplicateKeys: string[]
  warnings: string[]
}

export type DataImportPreview = {
  fileName: string
  sourceType: ImportSourceType
  sourceLabel: string
  habitCount: number
  dateRange: { start: string | null; end: string | null }
  totalCompletions: number
  nutritionRecords: number
  sportsRecords: number
  notes: number
  invalidRecords: number
  duplicateRecords: number
  warnings: string[]
  sampleHabits: string[]
}

const CSV_HEADERS = {
  habit: ['habit', 'name'],
  date: ['date', 'day'],
  completed: ['completed', 'done', 'status'],
  notes: ['notes', 'note', 'comment', 'comments'],
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function toDateOnlyString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function normalizeDateString(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return toDateOnlyString(value)
  }

  const raw = stringOrEmpty(value)
  if (!raw) return null

  const dateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (dateOnly) return dateOnly[1]

  const asDate = new Date(raw)
  if (Number.isNaN(asDate.getTime())) return null

  return toDateOnlyString(asDate)
}

function isTruthyCompleted(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'y', 'done', 'completed', 'checked'].includes(value.trim().toLowerCase())
  }
  return false
}

function extractClientSettings(source: unknown): ClientSettings {
  if (!isObject(source)) return {}

  const timeFormat = source.timeFormat === '12h' || source.timeFormat === '24h' ? source.timeFormat : undefined
  const theme = source.theme === 'system' || source.theme === 'dark' || source.theme === 'light'
    ? source.theme
    : undefined

  return { timeFormat, theme }
}

function expandRollingDays(
  habitName: string,
  days: unknown[],
  baseDate: string | null,
  invalidRecords: DataImportBundle['invalidRecords'],
  importedNotes: ImportedNoteRecord[]
): ImportedCompletion[] {
  const anchor = normalizeDateString(baseDate) || normalizeDateString(new Date())
  if (!anchor) return []

  const anchorDate = new Date(`${anchor}T00:00:00`)
  const result: ImportedCompletion[] = []

  days.forEach((day, index) => {
    if (!isObject(day)) return
    const completed = isTruthyCompleted(day.completed)
    const explicitDate = normalizeDateString(day.date)
    const date = explicitDate || (() => {
      const d = new Date(anchorDate)
      d.setDate(d.getDate() - ((days.length - 1) - index))
      return normalizeDateString(d)
    })()

    if (!date) {
      invalidRecords.push({ reason: `Unable to resolve date for ${habitName} day entry`, raw: day })
      return
    }

    const notes = stringOrEmpty(day.notes || day.note)
    if (notes) importedNotes.push({ date, content: notes })

    result.push({
      habitName,
      date,
      completed,
      notes: notes || undefined,
    })
  })

  return result
}

function extractHabitEntries(habit: unknown, invalidRecords: DataImportBundle['invalidRecords']) {
  if (!isObject(habit)) return { habit: null, completions: [] as ImportedCompletion[], notes: [] as ImportedNoteRecord[] }

  const habitName = stringOrEmpty(habit.name || habit.title || habit.habit || habit.label)
  if (!habitName) {
    invalidRecords.push({ reason: 'Habit is missing a name', raw: habit })
    return { habit: null, completions: [], notes: [] }
  }

  const notes: ImportedNoteRecord[] = []
  const completions: ImportedCompletion[] = []

  const itemHabit: ImportedHabit = {
    name: habitName,
    category: stringOrEmpty(habit.category) || undefined,
    time: stringOrEmpty(habit.time) || undefined,
    frequency: Array.isArray(habit.frequency) ? habit.frequency.filter((n) => typeof n === 'number') as number[] : undefined,
  }

  if (isObject(habit.history)) {
    for (const [dateKey, value] of Object.entries(habit.history)) {
      const date = normalizeDateString(dateKey)
      if (!date) {
        invalidRecords.push({ reason: `Invalid history date for ${habitName}`, raw: { dateKey, value } })
        continue
      }
      const completed = isTruthyCompleted(value)
      completions.push({ habitName, date, completed })
    }
  }

  if (Array.isArray(habit.entries)) {
    for (const entry of habit.entries) {
      if (!isObject(entry)) {
        invalidRecords.push({ reason: `Invalid entry object for ${habitName}`, raw: entry })
        continue
      }
      const date = normalizeDateString(entry.date || entry.createdAt || entry.updatedAt)
      if (!date) {
        invalidRecords.push({ reason: `Missing entry date for ${habitName}`, raw: entry })
        continue
      }
      const completed = isTruthyCompleted(entry.completed)
      completions.push({
        habitName,
        date,
        completed,
        notes: stringOrEmpty(entry.notes || entry.note) || undefined,
      })
      const entryNotes = stringOrEmpty(entry.notes || entry.note)
      if (entryNotes) notes.push({ date, content: entryNotes })
    }
  }

  if (Array.isArray(habit.days)) {
    completions.push(...expandRollingDays(habitName, habit.days, stringOrEmpty(habit.currentSystemDate || habit.baseDate || habit.date), invalidRecords, notes))
  }

  return { habit: itemHabit, completions, notes }
}

function parseBackupJson(fileName: string, data: Record<string, unknown>, invalidRecords: DataImportBundle['invalidRecords']) {
  const stateContainer = isObject(data.userState) ? data.userState : {}
  const rawState = isObject(stateContainer.stateData)
    ? stateContainer.stateData
    : typeof stateContainer.stateData === 'string'
      ? safeJsonParse(stateContainer.stateData, invalidRecords)
      : isObject(data.stateData)
        ? data.stateData
        : null

  const parsedState = isObject(rawState) ? rawState : {}
  const gridData = toArray(parsedState.gridData)

  const habits: ImportedHabit[] = []
  const completionRecords: ImportedCompletion[] = []
  const noteRecords: ImportedNoteRecord[] = []

  for (const habit of gridData) {
    const extracted = extractHabitEntries(habit, invalidRecords)
    if (extracted.habit) habits.push(extracted.habit)
    completionRecords.push(...extracted.completions)
    noteRecords.push(...extracted.notes)
  }

  const relatedData = isObject(data.relatedData) ? data.relatedData : {}
  const legacyHabits = toArray(relatedData.legacyHabits).filter(isObject)
  const nutritionRecords = toArray(relatedData.dailyMetrics).flatMap((record) => {
    if (!isObject(record)) return []
    const date = normalizeDateString(record.date)
    if (!date) {
      invalidRecords.push({ reason: 'Nutrition record is missing a valid date', raw: record })
      return []
    }
    return [{
      date,
      hydration: typeof record.hydration === 'number' ? record.hydration : undefined,
      calories: typeof record.calories === 'number' ? record.calories : undefined,
      protein: typeof record.protein === 'number' ? record.protein : undefined,
      carbs: typeof record.carbs === 'number' ? record.carbs : undefined,
      fat: typeof record.fat === 'number' ? record.fat : undefined,
    }]
  })

  const sportsRecords = toArray(relatedData.sportsLogs).flatMap((record) => {
    if (!isObject(record)) return []
    const date = normalizeDateString(record.date)
    const name = stringOrEmpty(record.name)
    const durationHours = typeof record.durationHours === 'number'
      ? record.durationHours
      : typeof record.duration === 'number'
        ? record.duration
        : NaN
    if (!date || !name || Number.isNaN(durationHours)) {
      invalidRecords.push({ reason: 'Sports record is missing date, name, or duration', raw: record })
      return []
    }
    return [{ date, name, durationHours }]
  })

  const importedNotes = toArray(relatedData.notes).flatMap((record) => {
    if (!isObject(record)) return []
    const date = normalizeDateString(record.date)
    const content = stringOrEmpty(record.content || record.note || record.text)
    if (!date || !content) {
      invalidRecords.push({ reason: 'Note record is missing date or content', raw: record })
      return []
    }
    return [{ date, content }]
  })

  const notifications = toArray(relatedData.notifications).filter(isObject)
  const notificationLogs = toArray(relatedData.notificationLogs).filter(isObject)

  const clientSettings = extractClientSettings(isObject(data.clientSettings) ? data.clientSettings : {})
  const archives = toArray(parsedState.archives || data.archives)

  return {
    fileName,
    sourceType: 'habytflow-backup' as const,
    sourceLabel: 'HabytFlow Backup',
    habits,
    legacyHabits,
    completionRecords,
    nutritionRecords,
    sportsRecords,
    notes: [...noteRecords, ...importedNotes],
    notifications,
    notificationLogs,
    archives,
    settings: clientSettings,
    rawStateData: parsedState,
    invalidRecords,
    duplicateKeys: [],
    warnings: [],
  }
}

function parseGenericJson(fileName: string, data: unknown, invalidRecords: DataImportBundle['invalidRecords']) {
  const sourceLabel = 'Generic Habit JSON'
  const habits: ImportedHabit[] = []
  const legacyHabits: Record<string, unknown>[] = []
  const completionRecords: ImportedCompletion[] = []
  const nutritionRecords: ImportedNutritionRecord[] = []
  const sportsRecords: ImportedSportRecord[] = []
  const notes: ImportedNoteRecord[] = []
  const archives: unknown[] = []
  const settings = extractClientSettings(isObject(data) ? data.settings || data.clientSettings || {} : {})

  const addTopLevelNote = (value: unknown) => {
    if (!isObject(value)) return
    const date = normalizeDateString(value.date)
    const content = stringOrEmpty(value.content || value.note || value.text)
    if (!date || !content) {
      invalidRecords.push({ reason: 'Note record is missing date or content', raw: value })
      return
    }
    notes.push({ date, content })
  }

  const addTopLevelNutrition = (value: unknown) => {
    if (!isObject(value)) return
    const date = normalizeDateString(value.date)
    if (!date) {
      invalidRecords.push({ reason: 'Nutrition record is missing a valid date', raw: value })
      return
    }
    nutritionRecords.push({
      date,
      hydration: typeof value.hydration === 'number' ? value.hydration : undefined,
      calories: typeof value.calories === 'number' ? value.calories : undefined,
      protein: typeof value.protein === 'number' ? value.protein : undefined,
      carbs: typeof value.carbs === 'number' ? value.carbs : undefined,
      fat: typeof value.fat === 'number' ? value.fat : undefined,
    })
  }

  const addTopLevelSport = (value: unknown) => {
    if (!isObject(value)) return
    const date = normalizeDateString(value.date)
    const name = stringOrEmpty(value.name || value.sport)
    const durationHours = typeof value.durationHours === 'number'
      ? value.durationHours
      : typeof value.duration === 'number'
        ? value.duration
        : NaN
    if (!date || !name || Number.isNaN(durationHours)) {
      invalidRecords.push({ reason: 'Sports record is missing date, name, or duration', raw: value })
      return
    }
    sportsRecords.push({ date, name, durationHours })
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      if (isObject(item) && (item.entries || item.history || item.days || item.name || item.title || item.habit)) {
        const extracted = extractHabitEntries(item, invalidRecords)
        if (extracted.habit) habits.push(extracted.habit)
        completionRecords.push(...extracted.completions)
        notes.push(...extracted.notes)
        continue
      }
      if (isObject(item) && (item.date && (item.completed !== undefined || item.content || item.note))) {
        const date = normalizeDateString(item.date)
        const habitName = stringOrEmpty(item.habitName || item.habit || item.name || item.title)
        if (!date || !habitName) {
          invalidRecords.push({ reason: 'Completion record is missing date or habit name', raw: item })
          continue
        }
        completionRecords.push({
          habitName,
          date,
          completed: isTruthyCompleted(item.completed),
          notes: stringOrEmpty(item.notes || item.note) || undefined,
        })
        const noteText = stringOrEmpty(item.notes || item.note)
        if (noteText) notes.push({ date, content: noteText })
        continue
      }
      invalidRecords.push({ reason: 'Unsupported array entry shape', raw: item })
    }
  } else if (isObject(data)) {
    const habitArrays = [
      data.habits,
      data.items,
      data.habitList,
      data.trackedHabits,
    ]

    for (const habitArray of habitArrays) {
      for (const item of toArray(habitArray)) {
        const extracted = extractHabitEntries(item, invalidRecords)
        if (extracted.habit) habits.push(extracted.habit)
        completionRecords.push(...extracted.completions)
        notes.push(...extracted.notes)
      }
    }

    for (const item of toArray(data.entries)) {
      if (isObject(item)) {
        const date = normalizeDateString(item.date)
        const habitName = stringOrEmpty(item.habitName || item.habit || item.name || item.title)
        if (!date || !habitName) {
          invalidRecords.push({ reason: 'Entry record is missing date or habit name', raw: item })
          continue
        }
        completionRecords.push({
          habitName,
          date,
          completed: isTruthyCompleted(item.completed),
          notes: stringOrEmpty(item.notes || item.note) || undefined,
        })
      }
    }

    for (const item of toArray(data.records)) {
      if (isObject(item)) {
        const date = normalizeDateString(item.date)
        const habitName = stringOrEmpty(item.habitName || item.habit || item.name || item.title)
        if (!date || !habitName) {
          invalidRecords.push({ reason: 'Record is missing date or habit name', raw: item })
          continue
        }
        completionRecords.push({
          habitName,
          date,
          completed: isTruthyCompleted(item.completed),
          notes: stringOrEmpty(item.notes || item.note) || undefined,
        })
      }
    }

    for (const item of toArray(data.nutritionRecords || data.dailyMetrics)) addTopLevelNutrition(item)
    for (const item of toArray(data.sportsRecords || data.sportsLogs)) addTopLevelSport(item)
    for (const item of toArray(data.notes)) addTopLevelNote(item)
    archives.push(...toArray(data.archives))
  }

  return {
    fileName,
    sourceType: 'generic-json' as const,
    sourceLabel,
    habits,
    legacyHabits,
    completionRecords,
    nutritionRecords,
    sportsRecords,
    notes,
    notifications: [],
    notificationLogs: [],
    archives,
    settings,
    rawStateData: null,
    invalidRecords,
    duplicateKeys: [],
    warnings: [],
  }
}

function parseCsv(fileName: string, text: string, invalidRecords: DataImportBundle['invalidRecords']) {
  const rows = parseCsvRows(text)
  if (rows.length === 0) {
    throw new Error('CSV file is empty')
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase())
  const getColumnIndex = (names: string[]) => header.findIndex((value) => names.includes(value))
  const habitIdx = getColumnIndex(CSV_HEADERS.habit)
  const dateIdx = getColumnIndex(CSV_HEADERS.date)
  const completedIdx = getColumnIndex(CSV_HEADERS.completed)
  const notesIdx = getColumnIndex(CSV_HEADERS.notes)

  if (habitIdx < 0 || dateIdx < 0 || completedIdx < 0) {
    throw new Error('CSV must include Habit, Date, and Completed columns')
  }

  const habits = new Map<string, ImportedHabit>()
  const legacyHabits: Record<string, unknown>[] = []
  const completionRecords: ImportedCompletion[] = []
  const notes: ImportedNoteRecord[] = []

  rows.slice(1).forEach((row, rowIndex) => {
    const habitName = stringOrEmpty(row[habitIdx])
    const date = normalizeDateString(row[dateIdx])
    const completed = isTruthyCompleted(row[completedIdx])
    const noteText = notesIdx >= 0 ? stringOrEmpty(row[notesIdx]) : ''

    if (!habitName || !date) {
      invalidRecords.push({ reason: `Invalid CSV row ${rowIndex + 2}`, raw: row })
      return
    }

    if (!habits.has(habitName.toLowerCase())) {
      habits.set(habitName.toLowerCase(), { name: habitName })
    }

    completionRecords.push({
      habitName,
      date,
      completed,
      notes: noteText || undefined,
    })

    if (noteText) {
      notes.push({ date, content: noteText })
    }
  })

  return {
    fileName,
    sourceType: 'csv' as const,
    sourceLabel: 'CSV',
    habits: Array.from(habits.values()),
    legacyHabits,
    completionRecords,
    nutritionRecords: [],
    sportsRecords: [],
    notes,
    notifications: [],
    notificationLogs: [],
    archives: [],
    settings: {},
    rawStateData: null,
    invalidRecords,
    duplicateKeys: [],
    warnings: [],
  }
}

function parseCsvRows(text: string) {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  const flushCell = () => {
    currentRow.push(currentCell)
    currentCell = ''
  }

  const flushRow = () => {
    flushCell()
    rows.push(currentRow)
    currentRow = []
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      flushCell()
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++
      if (currentCell.length > 0 || currentRow.length > 0) flushRow()
      continue
    }

    currentCell += char
  }

  if (currentCell.length > 0 || currentRow.length > 0) flushRow()
  return rows.filter((row) => row.some((cell) => cell.trim().length > 0))
}

function safeJsonParse(value: string, invalidRecords: DataImportBundle['invalidRecords']) {
  try {
    return JSON.parse(value)
  } catch {
    invalidRecords.push({ reason: 'Failed to parse nested JSON', raw: value })
    return null
  }
}

function detectDuplicateKeys(bundle: Omit<DataImportBundle, 'duplicateKeys' | 'warnings' | 'invalidRecords'>) {
  const duplicateKeys = new Set<string>()
  const seen = new Set<string>()

  const add = (key: string) => {
    if (seen.has(key)) {
      duplicateKeys.add(key)
      return
    }
    seen.add(key)
  }

  for (const habit of bundle.habits) add(`habit:${habit.name.toLowerCase()}`)
  for (const completion of bundle.completionRecords) add(`completion:${completion.habitName.toLowerCase()}|${completion.date}|${completion.completed ? '1' : '0'}|${completion.notes || ''}`)
  for (const record of bundle.nutritionRecords) add(`nutrition:${record.date}`)
  for (const record of bundle.sportsRecords) add(`sport:${record.date}|${record.name.toLowerCase()}|${record.durationHours}`)
  for (const record of bundle.notes) add(`note:${record.date}|${record.content.toLowerCase()}`)

  return Array.from(duplicateKeys)
}

function calculateDateRange(bundle: DataImportBundle) {
  const dates = [
    ...bundle.completionRecords.map((record) => record.date),
    ...bundle.nutritionRecords.map((record) => record.date),
    ...bundle.sportsRecords.map((record) => record.date),
    ...bundle.notes.map((record) => record.date),
  ].filter(Boolean)

  if (dates.length === 0) return { start: null, end: null }
  const sorted = [...dates].sort()
  return { start: sorted[0] || null, end: sorted[sorted.length - 1] || null }
}

export function parseImportText(fileName: string, text: string): DataImportBundle {
  const invalidRecords: DataImportBundle['invalidRecords'] = []

  let parsed: unknown
  const isCsv = fileName.toLowerCase().endsWith('.csv')
  if (isCsv) {
    return finalizeBundle(parseCsv(fileName, text, invalidRecords))
  }

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Unsupported file. Use .json or .csv')
  }

  if (isObject(parsed) && (parsed.userState || parsed.format === 'habytflow-user-export-v1' || parsed.sourceLabel === 'HabytFlow Backup')) {
    return finalizeBundle(parseBackupJson(fileName, parsed, invalidRecords))
  }

  return finalizeBundle(parseGenericJson(fileName, parsed, invalidRecords))

  function finalizeBundle(bundle: DataImportBundle): DataImportBundle {
    const duplicateKeys = detectDuplicateKeys(bundle)
    const warnings = [...bundle.warnings]
    if (bundle.invalidRecords.length > 0) warnings.push(`${bundle.invalidRecords.length} invalid record(s) detected`)
    if (duplicateKeys.length > 0) warnings.push(`${duplicateKeys.length} duplicate record(s) detected`)

    return {
      ...bundle,
      invalidRecords: bundle.invalidRecords,
      duplicateKeys,
      warnings,
    }
  }
}

export function buildImportPreview(bundle: DataImportBundle): DataImportPreview {
  return {
    fileName: bundle.fileName,
    sourceType: bundle.sourceType,
    sourceLabel: bundle.sourceLabel,
    habitCount: bundle.habits.length,
    dateRange: calculateDateRange(bundle),
    totalCompletions: bundle.completionRecords.filter((record) => record.completed).length,
    nutritionRecords: bundle.nutritionRecords.length,
    sportsRecords: bundle.sportsRecords.length,
    notes: bundle.notes.length,
    invalidRecords: bundle.invalidRecords.length,
    duplicateRecords: bundle.duplicateKeys.length,
    warnings: bundle.warnings,
    sampleHabits: bundle.habits.slice(0, 5).map((habit) => habit.name),
  }
}

export function toPlainObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}
