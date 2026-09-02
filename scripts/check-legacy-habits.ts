import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const { connectToDatabase } = await import('../src/lib/db')
  const Habit = (await import('../src/models/Habit')).default
  const { MongoClient } = await import('mongodb')

  await connectToDatabase()
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: npx tsx scripts/check-legacy-habits.ts <email>')
    process.exit(1)
  }

  const client = new MongoClient(process.env.MONGODB_URI as string)
  await client.connect()
  const db = client.db()
  const userDoc = await db.collection('user').findOne({ email })
  if (!userDoc) {
    console.error(`No user found with email "${email}"`)
    process.exit(1)
  }
  const userId = String(userDoc._id)
  console.log(`Resolved userId: ${userId}`)

  const count = await Habit.countDocuments({ userId })
  console.log(`Total Habit documents for userId "${userId}": ${count}`)

  const sample = await Habit.find({ userId }).limit(10).lean()
  console.log('\nSample (up to 10):')
  sample.forEach((h: Record<string, unknown>) => {
    const historySize = h.history instanceof Map ? h.history.size : Object.keys(h.history || {}).length
    console.log(`- name: "${h.name}", category: "${h.category}", history entries: ${historySize}, createdAt: ${h.createdAt}`)
  })

  await client.close()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})