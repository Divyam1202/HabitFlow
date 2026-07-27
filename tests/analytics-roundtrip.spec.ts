import { expect, test } from '@playwright/test'
import { createExportPayload } from '@/lib/backup-manager'
import { parseImportText } from '@/lib/data-import'
import { calculateHistoricalAnalyticsView, buildAnalyticsMonthOptions, type AnalyticsHistorySnapshot } from '@/utils/analytics'

function buildSnapshot(): AnalyticsHistorySnapshot {
  return {
    userState: {
      trackingStartedAt: '2026-06-01T00:00:00.000Z',
    },
    relatedData: {
      legacyHabits: [
        {
          name: 'Gym',
          category: 'Health',
          history: {
            '2026-06-29': true,
            '2026-06-30': false,
            '2026-07-01': true,
            '2026-07-02': true,
            '2026-07-03': false,
          },
        },
        {
          name: 'Reading',
          category: 'Growth',
          history: {
            '2026-06-29': false,
            '2026-06-30': true,
            '2026-07-01': false,
            '2026-07-02': true,
            '2026-07-03': true,
          },
        },
      ],
      dailyMetrics: [
        { date: '2026-06-30', hydration: 1500, calories: 1800, protein: 120, carbs: 210 },
        { date: '2026-07-03', hydration: 1800, calories: 1900, protein: 130, carbs: 230 },
      ],
      sportsLogs: [
        { date: '2026-07-03', name: 'Run', durationHours: 1.5 },
      ],
    },
  }
}

function rebuildSnapshotFromBundle(bundle: ReturnType<typeof parseImportText>): AnalyticsHistorySnapshot {
  return {
    userState: {
      trackingStartedAt: '2026-06-01T00:00:00.000Z',
    },
    relatedData: {
      legacyHabits: bundle.legacyHabits,
      dailyMetrics: bundle.nutritionRecords,
      sportsLogs: bundle.sportsRecords,
    },
  }
}

test('analytics stay identical across export/import round trips', () => {
  const referenceDate = new Date('2026-07-31T00:00:00.000Z')
  const snapshot = buildSnapshot()
  const originalView = calculateHistoricalAnalyticsView(snapshot, new Date(referenceDate))

  const firstExport = createExportPayload({
    user: { id: 'user-1', email: 'test@example.com', name: 'Tester' },
    userState: {
      id: 'state-1',
      userId: 'user-1',
      timezone: 'UTC',
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T00:00:00.000Z',
      stateDataRaw: JSON.stringify({ trackingStartedAt: snapshot.userState?.trackingStartedAt }),
      stateData: { trackingStartedAt: snapshot.userState?.trackingStartedAt },
    },
    relatedData: {
      legacyHabits: snapshot.relatedData?.legacyHabits || [],
      habitSchedules: [],
      notes: [],
      dailyMetrics: snapshot.relatedData?.dailyMetrics || [],
      sportsLogs: snapshot.relatedData?.sportsLogs || [],
      notifications: [],
      notificationLogs: [],
    },
  })

  const firstBundle = parseImportText('fixture.json', JSON.stringify(firstExport))
  const firstRoundTripSnapshot = rebuildSnapshotFromBundle(firstBundle)
  const firstRoundTripView = calculateHistoricalAnalyticsView(firstRoundTripSnapshot, new Date(referenceDate))

  const secondExport = createExportPayload({
    user: { id: 'user-1', email: 'test@example.com', name: 'Tester' },
    userState: {
      id: 'state-1',
      userId: 'user-1',
      timezone: 'UTC',
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T00:00:00.000Z',
      stateDataRaw: JSON.stringify({ trackingStartedAt: firstRoundTripSnapshot.userState?.trackingStartedAt }),
      stateData: { trackingStartedAt: firstRoundTripSnapshot.userState?.trackingStartedAt },
    },
    relatedData: {
      legacyHabits: firstRoundTripSnapshot.relatedData?.legacyHabits || [],
      habitSchedules: [],
      notes: [],
      dailyMetrics: firstRoundTripSnapshot.relatedData?.dailyMetrics || [],
      sportsLogs: firstRoundTripSnapshot.relatedData?.sportsLogs || [],
      notifications: [],
      notificationLogs: [],
    },
  })

  const secondBundle = parseImportText('fixture.json', JSON.stringify(secondExport))
  const secondRoundTripSnapshot = rebuildSnapshotFromBundle(secondBundle)
  const secondRoundTripView = calculateHistoricalAnalyticsView(secondRoundTripSnapshot, new Date(referenceDate))

  expect(firstRoundTripView).toEqual(originalView)
  expect(secondRoundTripView).toEqual(originalView)
  expect(buildAnalyticsMonthOptions(snapshot, new Date(referenceDate))).toEqual(buildAnalyticsMonthOptions(secondRoundTripSnapshot, new Date(referenceDate)))
})