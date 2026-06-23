const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://habytflow_db_user:8rev3D8xFl3zxQJZ@cluster0.02fqvey.mongodb.net/?appName=Cluster0";

const NotificationLogSchema = new mongoose.Schema(
  {
    userId: String,
    habitId: String,
    habitName: String,
    status: String,
    scheduledTime: String,
    triggerTime: String,
    timezone: String,
    errorMessage: String,
  },
  { timestamps: true }
);

const UserStateSchema = new mongoose.Schema({
  userId: String,
  stateData: String,
  timezone: String,
  fcmToken: String,
});

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  const NotificationLog = mongoose.models.NotificationLog || mongoose.model('NotificationLog', NotificationLogSchema);
  const UserState = mongoose.models.UserState || mongoose.model('UserState', UserStateSchema);

  const usersCount = await UserState.countDocuments({});
  console.log("Total UserStates:", usersCount);

  const users = await UserState.find({});
  for (const user of users) {
    console.log(`User: ${user.userId} | Timezone: ${user.timezone} | Has FCM Token: ${!!user.fcmToken}`);
    if (user.stateData) {
      try {
        const parsed = JSON.parse(user.stateData);
        console.log("Habits count:", parsed.gridData ? parsed.gridData.length : 0);
        if (parsed.gridData) {
          parsed.gridData.forEach(h => {
            console.log(`  - Habit: "${h.name}" | Time: "${h.time}" | Frequency: ${JSON.stringify(h.frequency)} | Notification Offset: ${h.notification}`);
          });
        }
      } catch (e) {
        console.log("Failed to parse stateData:", e.message);
      }
    }
  }

  const logsCount = await NotificationLog.countDocuments({});
  console.log("\nTotal NotificationLogs:", logsCount);

  const lastLogs = await NotificationLog.find({}).sort({ createdAt: -1 }).limit(20);
  console.log("\nLast 20 NotificationLogs:");
  lastLogs.forEach(l => {
    console.log(`[${l.createdAt.toISOString()}] User: ${l.userId} | Habit: "${l.habitName}" | Status: ${l.status} | Scheduled: ${l.scheduledTime} | Trigger: ${l.triggerTime} | Error: ${l.errorMessage || 'None'}`);
  });

  await mongoose.disconnect();
}

main().catch(console.error);
