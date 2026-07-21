import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { connectToDatabase } from '@/lib/db'
import UserState from '@/models/UserState'
import {
  BackupState,
  buildBackupDownloadPayload,
  findBackupById,
} from '@/lib/backup-manager'

function parseState(stateData: unknown) {
  if (typeof stateData !== 'string') return null
  try {
    return JSON.parse(stateData) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ backupId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { backupId } = await params
    await connectToDatabase()

    const stateDoc = await UserState.findOne({ userId: session.user.id }).lean()
    const parsedState = parseState(stateDoc?.stateData)
    if (!parsedState) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 })
    }

    const backup = findBackupById(parsedState as BackupState, backupId)
    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 })
    }

    return NextResponse.json(buildBackupDownloadPayload(backup))
  } catch (error) {
    console.error('Error downloading backup:', error)
    return NextResponse.json({ error: 'Failed to download backup' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ backupId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { backupId } = await params
    await connectToDatabase()

    const stateDoc = await UserState.findOne({ userId: session.user.id }).lean()
    const parsedState = parseState(stateDoc?.stateData)
    if (!parsedState || !Array.isArray((parsedState as BackupState).backups)) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 })
    }

    const nextBackups = (parsedState as BackupState).backups!.filter((item) => {
      return typeof item !== 'object' || item === null || (item as { id?: string }).id !== backupId
    })

    await UserState.findOneAndUpdate(
      { userId: session.user.id },
      {
        $set: {
          stateData: JSON.stringify({
            ...parsedState,
            backups: nextBackups,
          }),
          timezone: stateDoc?.timezone || 'Asia/Kolkata',
        },
      },
      { upsert: true }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting backup:', error)
    return NextResponse.json({ error: 'Failed to delete backup' }, { status: 500 })
  }
}
