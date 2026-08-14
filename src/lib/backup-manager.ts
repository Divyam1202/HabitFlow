// src/lib/backup-manager.ts

import { ClientSettings } from '@/lib/data-import'

export type BackupSource =
  | 'manual'
  | 'sync'
  | 'scheduled'
  | 'pre-destructive'
  | 'import-safety'
  | 'restore-safety'
  | 'auto-import'
  | 'auto-reset'
  | 'auto-restore'

export type UserStateSummary = {
  stateKeys: string[]
  habits: number
  habitHistoryCells: number
  completedHabitCells: number
  heatmapDays: number
  heatmapNonZeroDays: number
  heatmapExecutions: number
  todayHabits: number
  sportsEntriesToday: number
}

export type HabytFlowExportPayload = {
  exportedAt: string
  format: 'habytflow-user-export-v1'
  user: {
    id: string
    email?: string | null
    name?: string | null
  }
  userState: {
    id: string
    userId: string
    timezone: string
    createdAt?: unknown
    updatedAt?: unknown
    stateData: Record<string, unknown>
    stateDataRaw: string
    summary: UserStateSummary
  }
  relatedData: {
    legacyHabits: Record<string, unknown>[]
    habitSchedules: Record<string, unknown>[]
    notes: Record<string, unknown>[]
    dailyMetrics: Record<string, unknown>[]
    sportsLogs: Record<string, unknown>[]
    notifications: Record<string, unknown>[]
    notificationLogs: Record<string, unknown>[]
  }
  clientSettings?: ClientSettings
}

export type StoredBackupRecord = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  sizeBytes: number
  source: BackupSource
  payload: HabytFlowExportPayload
}

export type BackupListItem = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  sizeBytes: number
  source: BackupSource
  summary: UserStateSummary
  clientSettings?: ClientSettings
}

export type BackupStatus = {
  label: string
  tone: 'good' | 'warn' | 'bad'
  daysOld: number | null
}

export type BackupState = Record<string, unknown> & {
  backups?: unknown[]
}

// ---- Growth-control config ----------------------------------------------
// These two limits are what keep the parent UserState document from
// growing unbounded toward MongoDB's 16MB document cap. Every path that
// writes backups back into state (appendBackupToState, normalizeBackups,
// replaceBackupBySource) funnels through trimAutomaticBackups below, so
// changing these constants is enough to retune retention everywhere.
const MAX_AUTOMATIC_BACKUPS = 5
const MAX_MANUAL_BACKUPS = 5
const MAX_BACKUPS_TOTAL_BYTES = 8 * 1024 * 1024 // 8MB budget for the whole backups array

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function stripEmbeddedBackups(state: Record<string, unknown>) {
  const nextState = clone(state)
  delete (nextState as BackupState).backups
  return nextState
}

function backupsByteSize(backups: StoredBackupRecord[]): number {
  return Buffer.byteLength(JSON.stringify(backups), 'utf8')
}

export function summarizeState(state: Record<string, unknown> | null): UserStateSummary {
  const gridData = Array.isArray(state?.gridData) ? state.gridData : []
  const heatmapData = Array.isArray(state?.heatmapData) ? state.heatmapData : []
  const todayHabits = Array.isArray(state?.todayHabits) ? state.todayHabits : []
  const todayActivity = typeof state?.todayActivity === 'object' && state.todayActivity !== null
    ? state.todayActivity as { sportsLog?: unknown[] }
    : null

  return {
    stateKeys: state ? Object.keys(state) : [],
    habits: gridData.length,
    habitHistoryCells: gridData.reduce((sum, habit) => {
      const days = typeof habit === 'object' && habit !== null && Array.isArray((habit as { days?: unknown[] }).days)
        ? (habit as { days: unknown[] }).days
        : []
      return sum + days.length
    }, 0),
    completedHabitCells: gridData.reduce((sum, habit) => {
      const days = typeof habit === 'object' && habit !== null && Array.isArray((habit as { days?: Array<{ completed?: boolean }> }).days)
        ? (habit as { days: Array<{ completed?: boolean }> }).days
        : []
      return sum + days.filter((day) => day.completed).length
    }, 0),
    heatmapDays: heatmapData.length,
    heatmapNonZeroDays: heatmapData.filter((day) => {
      if (typeof day !== 'object' || day === null) return false
      return ((day as { count?: number }).count || 0) > 0
    }).length,
    heatmapExecutions: heatmapData.reduce((sum, day) => {
      if (typeof day !== 'object' || day === null) return sum
      return sum + ((day as { count?: number }).count || 0)
    }, 0),
    todayHabits: todayHabits.length,
    sportsEntriesToday: Array.isArray(todayActivity?.sportsLog) ? todayActivity.sportsLog.length : 0,
  }
}

export function isAutomaticBackupSource(source: BackupSource) {
  return source !== 'manual'
}

function parseDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getBackupAgeDays(backup: StoredBackupRecord | null | undefined) {
  if (!backup) return null
  const createdAt = parseDate(backup.createdAt)
  if (!createdAt) return null
  const diff = Date.now() - createdAt.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

export function getLatestBackup(backups: StoredBackupRecord[]) {
  return [...backups].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null
}

export function getAutomaticBackups(backups: StoredBackupRecord[], limit = 5) {
  return [...backups]
    .filter((backup) => isAutomaticBackupSource(backup.source))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

export function getBackupStatus(latestBackup: StoredBackupRecord | null | undefined): BackupStatus {
  if (!latestBackup) {
    return {
      label: 'No backup available',
      tone: 'bad',
      daysOld: null,
    }
  }

  const daysOld = getBackupAgeDays(latestBackup)
  if (daysOld === null) {
    return {
      label: 'Backup unavailable',
      tone: 'warn',
      daysOld: null,
    }
  }

  if (daysOld < 2) {
    return {
      label: 'Up to date',
      tone: 'good',
      daysOld,
    }
  }

  return {
    label: 'Backup recommended',
    tone: 'warn',
    daysOld,
  }
}

export function createExportPayload(params: {
  exportedAt?: string
  user: { id: string; email?: string | null; name?: string | null }
  userState: {
    id: string
    userId: string
    timezone?: string | null
    createdAt?: unknown
    updatedAt?: unknown
    stateDataRaw: string
    stateData: Record<string, unknown>
  }
  relatedData: HabytFlowExportPayload['relatedData']
  clientSettings?: ClientSettings
}): HabytFlowExportPayload {
  const stateData = stripEmbeddedBackups(params.userState.stateData)

  return {
    exportedAt: params.exportedAt || new Date().toISOString(),
    format: 'habytflow-user-export-v1',
    user: params.user,
    userState: {
      id: params.userState.id,
      userId: params.userState.userId,
      timezone: params.userState.timezone || 'Asia/Kolkata',
      createdAt: params.userState.createdAt,
      updatedAt: params.userState.updatedAt,
      stateData,
      stateDataRaw: JSON.stringify(stateData),
      summary: summarizeState(stateData),
    },
    relatedData: {
      legacyHabits: clone(params.relatedData.legacyHabits || []),
      habitSchedules: clone(params.relatedData.habitSchedules || []),
      notes: clone(params.relatedData.notes || []),
      dailyMetrics: clone(params.relatedData.dailyMetrics || []),
      sportsLogs: clone(params.relatedData.sportsLogs || []),
      notifications: clone(params.relatedData.notifications || []),
      notificationLogs: clone(params.relatedData.notificationLogs || []),
    },
    clientSettings: params.clientSettings,
  }
}

export function createStoredBackupRecord(
  payload: HabytFlowExportPayload,
  source: BackupSource,
  name?: string
): StoredBackupRecord {
  const record: Omit<StoredBackupRecord, 'sizeBytes'> = {
    id: `backup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name || `Backup ${new Date(payload.exportedAt).toLocaleString()}`,
    createdAt: payload.exportedAt,
    updatedAt: payload.exportedAt,
    source,
    payload,
  }

  return {
    ...record,
    sizeBytes: Buffer.byteLength(JSON.stringify(record), 'utf8'),
  }
}

/**
 * Trims the backups array down to a safe size:
 *  - at most MAX_AUTOMATIC_BACKUPS non-manual backups
 *  - at most MAX_MANUAL_BACKUPS manual backups
 *  - the combined array never exceeds MAX_BACKUPS_TOTAL_BYTES, dropping
 *    the oldest backups first (always keeping at least the single newest
 *    backup, even if it alone is over budget, so a fresh backup is never
 *    silently discarded)
 *
 * This is the single choke point all backup-writing functions in this
 * file go through, so it's the one place that needs to change to retune
 * retention or fix runaway document growth.
 */
export function trimAutomaticBackups(backups: StoredBackupRecord[], keep = MAX_AUTOMATIC_BACKUPS) {
  const automaticBackups = backups
    .filter((backup) => isAutomaticBackupSource(backup.source))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, keep)

  const manualBackups = backups
    .filter((backup) => !isAutomaticBackupSource(backup.source))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_MANUAL_BACKUPS)

  let combined = [...automaticBackups, ...manualBackups].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )

  while (combined.length > 1 && backupsByteSize(combined) > MAX_BACKUPS_TOTAL_BYTES) {
    combined = combined.slice(0, -1)
  }

  return combined
}

export function normalizeBackups(backups: StoredBackupRecord[], nextBackup?: StoredBackupRecord) {
  const deduped = nextBackup
    ? [
        ...backups.filter((backup) => backup.id !== nextBackup.id),
        nextBackup,
      ]
    : [...backups]

  return trimAutomaticBackups(deduped)
}

export function getStoredBackups(state: BackupState | null | undefined): StoredBackupRecord[] {
  if (!state || !Array.isArray(state.backups)) return []
  return state.backups
    .filter((item): item is StoredBackupRecord => isObject(item) && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.createdAt === 'string' && typeof item.updatedAt === 'string' && typeof item.sizeBytes === 'number' && typeof item.source === 'string' && isObject(item.payload))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getBackupList(state: BackupState | null | undefined): BackupListItem[] {
  return getStoredBackups(state).map((backup) => ({
    id: backup.id,
    name: backup.name,
    createdAt: backup.createdAt,
    updatedAt: backup.updatedAt,
    sizeBytes: backup.sizeBytes,
    source: backup.source,
    summary: backup.payload.userState.summary,
    clientSettings: backup.payload.clientSettings,
  }))
}

export function appendBackupToState(
  state: Record<string, unknown> | null,
  backup: StoredBackupRecord
) {
  const nextState = isObject(state) ? clone(state) : {}
  const existing = toArray<StoredBackupRecord>((nextState as BackupState).backups)
  const filtered = existing.filter((item) => item && item.id !== backup.id)
  return {
    ...nextState,
    backups: trimAutomaticBackups([...filtered, backup]),
  }
}

export function replaceBackupBySource(
  state: Record<string, unknown> | null,
  backup: StoredBackupRecord,
  sourceToReplace: BackupSource
) {
  const nextState = isObject(state) ? clone(state) : {}
  const existing = toArray<StoredBackupRecord>((nextState as BackupState).backups)
  const filtered = existing.filter((item) => item && item.source !== sourceToReplace && item.id !== backup.id)
  return {
    ...nextState,
    backups: trimAutomaticBackups([...filtered, backup]),
  }
}

export function findBackupById(
  state: BackupState | null | undefined,
  backupId: string
): StoredBackupRecord | null {
  return getStoredBackups(state).find((backup) => backup.id === backupId) || null
}

export function buildBackupDownloadPayload(backup: StoredBackupRecord) {
  return clone(backup.payload)
}

export function buildRestoredStateFromBackup(
  backup: StoredBackupRecord,
  backups: StoredBackupRecord[]
) {
  const state = clone(backup.payload.userState.stateData)
  const trackingStartedAt = typeof (state as Record<string, unknown>).trackingStartedAt === 'string'
    ? (state as Record<string, unknown>).trackingStartedAt
    : typeof backup.payload.userState.createdAt === 'string'
      ? backup.payload.userState.createdAt
      : undefined
  return {
    ...state,
    ...(trackingStartedAt ? { trackingStartedAt } : {}),
    backups,
  }
}
