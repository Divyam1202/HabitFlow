import { connectToDatabase } from '@/lib/db'
import AuditLog from '@/models/AuditLog'
import { ShieldCheck, Calendar, Clock, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminAuditLogsPage() {
  await connectToDatabase()
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean()

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8 md:px-10">
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
          Super Admin
        </div>
        <h1 className="font-panchang text-2xl font-black uppercase tracking-tight text-foreground md:text-[2rem]">
          Audit Logging
        </h1>
        <p className="max-w-2xl text-sm text-zinc-500">
          Operational event history for system changes, moderation, and restore activity.
        </p>
      </div>

      <div className="bg-card/65 ring-1 ring-white/5">
        {logs.length === 0 ? (
          <div className="px-4 py-16 text-center text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
            No audit logs recorded yet
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {logs.map((log: any) => {
              const tone =
                String(log.action || '').includes('DELETE') ? 'red' :
                String(log.action || '').includes('RESTORE') ? 'amber' :
                String(log.action || '').includes('CREATE') ? 'green' :
                'neutral'

              return (
                <div key={log._id.toString()} className="group px-4 py-4 transition-colors hover:bg-white/[0.03]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                          tone === 'red'
                            ? 'border-red-500/20 text-red-400'
                            : tone === 'amber'
                              ? 'border-amber-500/20 text-amber-400'
                              : tone === 'green'
                                ? 'border-emerald-500/20 text-emerald-400'
                                : 'border-white/10 text-zinc-300'
                        }`}>
                          {log.action.replaceAll('_', ' ')}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <p className="mt-3 max-w-4xl text-sm text-white">
                        {log.details}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                        <span>{log.adminEmail}</span>
                        <span className="text-zinc-700">•</span>
                        <span>{log.adminId}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-zinc-500">
                      <Clock size={13} />
                      <span className="text-[10px] uppercase tracking-[0.22em]">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
