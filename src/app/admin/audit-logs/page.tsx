import { connectToDatabase } from '@/lib/db'
import AuditLog from '@/models/AuditLog'
import { ShieldCheck, Calendar, Clock, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminAuditLogsPage() {
  await connectToDatabase()
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean()

  return (
    <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-foreground font-panchang">
          Audit Logging
        </h1>
        <p className="text-zinc-500 text-xs font-bold tracking-widest uppercase mt-1">
          Super Admin Panel • Cryptographic operational logs for system modifications
        </p>
      </div>

      <div className="border border-border bg-card text-card-foreground overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans">
          <thead>
            <tr className="border-b border-border bg-background/50">
              <th className="py-4 px-6 text-xs font-bold tracking-widest uppercase text-zinc-500">Timestamp</th>
              <th className="py-4 px-6 text-xs font-bold tracking-widest uppercase text-zinc-500">Operator</th>
              <th className="py-4 px-6 text-xs font-bold tracking-widest uppercase text-zinc-500">Action Type</th>
              <th className="py-4 px-6 text-xs font-bold tracking-widest uppercase text-zinc-500">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-zinc-500 text-xs font-bold uppercase tracking-widest">
                  No audit logs recorded yet
                </td>
              </tr>
            ) : (
              logs.map((log: any) => (
                <tr key={log._id.toString()} className="border-b border-border hover:bg-muted/40 transition-colors">
                  <td className="py-4 px-6 text-sm text-zinc-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-4 px-6 text-sm font-bold text-foreground">
                    {log.adminEmail}
                    <div className="text-[10px] text-zinc-550 font-normal mt-0.5">{log.adminId}</div>
                  </td>
                  <td className="py-4 px-6 text-sm">
                    <span className="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 bg-zinc-800 text-zinc-300 uppercase rounded-sm">
                      {log.action.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-zinc-400 max-w-lg leading-relaxed">
                    {log.details}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
