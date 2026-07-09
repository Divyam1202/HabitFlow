const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://habytflow_db_user:8rev3D8xFl3zxQJZ@cluster0.02fqvey.mongodb.net/?appName=Cluster0";

// Define schemas to match the models
const UserStateSchema = new mongoose.Schema({
  userId: String,
  stateData: String,
  fcmToken: String,
  timezone: String
}, { timestamps: true });

const NotificationLogSchema = new mongoose.Schema({
  userId: String,
  habitId: String,
  habitName: String,
  scheduledTime: String,
  triggerTime: String,
  timezone: String,
  status: String,
  errorMessage: String
}, { timestamps: true });

const UserState = mongoose.models.UserState || mongoose.model('UserState', UserStateSchema, 'userstates');
const NotificationLog = mongoose.models.NotificationLog || mongoose.model('NotificationLog', NotificationLogSchema, 'notificationlogs');

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB successfully.\n");

    // 1. Cron Status
    console.log("=== CRON STATUS ===");
    const latestLogs = await NotificationLog.find().sort({ createdAt: -1 }).limit(30).lean();
    if (latestLogs.length > 0) {
      console.log("Last execution time (UTC):", latestLogs[0].createdAt);
      // Try to estimate frequency from timestamps
      const uniqueTimes = [...new Set(latestLogs.map(l => l.createdAt.getTime()))].sort((a,b) => b-a);
      if (uniqueTimes.length > 1) {
        const diffs = [];
        for (let i = 0; i < uniqueTimes.length - 1; i++) {
          diffs.push((uniqueTimes[i] - uniqueTimes[i+1]) / 60000);
        }
        const avgDiff = diffs.reduce((a,b) => a+b, 0) / diffs.length;
        console.log(`Estimated frequency (based on recent logs spacing): ~${avgDiff.toFixed(1)} minutes`);
      } else {
        console.log("Execution frequency: Single/Unknown run");
      }
      
      const errors = await NotificationLog.find({ status: 'failed' }).sort({ createdAt: -1 }).limit(5).lean();
      if (errors.length > 0) {
        console.log("Recent errors:");
        errors.forEach(e => console.log(`  - At ${e.createdAt.toISOString()}: Habit "${e.habitName}" failed with: "${e.errorMessage}"`));
      } else {
        console.log("Recent errors: None");
      }
    } else {
      console.log("No execution logs found in NotificationLog collection.");
    }
    console.log();

    // 2 & 3. User & Habit inspection
    const users = await UserState.find().lean();
    console.log(`Found ${users.length} users in UserState.\n`);

    for (const user of users) {
      console.log(`=== FCM STATUS FOR USER: ${user.userId} ===`);
      console.log("FCM Token Exists?:", user.fcmToken ? "Yes" : "No");
      console.log("FCM Token Length:", user.fcmToken ? user.fcmToken.length : 0);
      console.log("User Timezone:", user.timezone);
      console.log("Last Updated:", user.updatedAt);
      console.log();

      console.log(`=== HABITS FOR USER: ${user.userId} ===`);
      let parsed = {};
      try {
        parsed = JSON.parse(user.stateData);
      } catch (e) {
        console.log("Failed to parse stateData");
      }
      const habits = parsed.gridData || [];
      habits.forEach(h => {
        console.log(`- Habit Name: "${h.name}"`);
        console.log(`  Habit ID: ${h.id}`);
        console.log(`  Habit Time: ${h.time}`);
        console.log(`  Notification Offset (minutes):`, h.notification !== undefined ? h.notification : "None");
        console.log(`  Goal/Frequency:`, h.goal || h.frequency);
        console.log(`  Is Completed Today:`, (parsed.todayHabits || []).includes(h.id) ? "Yes" : "No");
      });
      console.log();
    }

    // 4. Latest Match Results
    console.log("=== LATEST MATCH RESULTS ===");
    // Get unique runs in the last 6 hours
    const recentLogs = await NotificationLog.find({
      createdAt: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) }
    }).sort({ createdAt: -1 }).lean();

    if (recentLogs.length > 0) {
      recentLogs.forEach(log => {
        console.log(`Time (UTC): ${log.createdAt.toISOString()} | User: ${log.userId} | Habit: "${log.habitName}" | Status: ${log.status} | Err: ${log.errorMessage || 'None'} | Sched: ${log.scheduledTime} | Trig: ${log.triggerTime}`);
      });
    } else {
      console.log("No cron evaluation matches logged in the last 6 hours.");
    }

  } catch (err) {
    console.error("Error executing diagnostics:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
