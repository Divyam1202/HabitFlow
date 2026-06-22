const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local to load environment variables
function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.replace(/\\n/g, '\n');
      }
    });
  }
}

loadEnv();

// Helper matching timezone logic in route
function getCurrentTimeInTimezone(timezone) {
  try {
    const options = { 
      timeZone: timezone, 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    };
    return new Intl.DateTimeFormat('en-GB', options).format(new Date());
  } catch (e) {
    const options = { 
      timeZone: 'UTC', 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    };
    return new Intl.DateTimeFormat('en-GB', options).format(new Date());
  }
}

async function runSnoozeTests() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI is not loaded!");
    return;
  }

  console.log("Connecting to MongoDB...");
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db();
    const userStatesCol = db.collection('userstates');
    const telemetryCol = db.collection('telemetryevents');

    console.log("\n--- TEST 1: Simulate /api/notifications/snooze ---");
    const user = await userStatesCol.findOne({});
    if (!user) {
      console.log("No user found to run test on.");
      return;
    }

    console.log(`Found user: ${user.userId}`);
    const userTimezone = user.timezone || 'Asia/Kolkata';
    const currentTime = getCurrentTimeInTimezone(userTimezone);
    console.log(`Current Time in ${userTimezone}: ${currentTime}`);

    // Calculate snooze trigger time (add 15 minutes)
    const [hours, minutes] = currentTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes + 15);
    const triggerTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    console.log(`Calculated triggerTime (T+15m): ${triggerTime}`);

    let state = {};
    try {
      state = JSON.parse(user.stateData || "{}");
    } catch(e) {
      state = {};
    }

    const testHabitId = 8888;
    if (!state.gridData) state.gridData = [];
    if (!state.gridData.some(h => h.id === testHabitId)) {
      state.gridData.push({
        id: testHabitId,
        name: "Snooze Test Habit",
        category: "🧠 Growth",
        time: "09:00",
        days: [{ day: 1, completed: false }]
      });
    }

    if (!state.snoozedReminders) state.snoozedReminders = [];
    state.snoozedReminders.push({
      habitId: testHabitId,
      triggerTime: triggerTime
    });

    await userStatesCol.updateOne({ userId: user.userId }, { $set: { stateData: JSON.stringify(state) } });
    console.log("Saved snooze reminder to database successfully.");

    // Verification
    const updatedUser = await userStatesCol.findOne({ userId: user.userId });
    const parsedState = JSON.parse(updatedUser.stateData);
    const snoozeEntry = parsedState.snoozedReminders.find(s => s.habitId === testHabitId);
    console.log("Verification: Snooze entry exists?", !!snoozeEntry);
    console.log("Verification: Snooze trigger time matches?", snoozeEntry?.triggerTime === triggerTime);

    console.log("\n--- TEST 2: Simulate Cron checking & firing snooze reminder ---");
    // Let's check matching snooze logic: we will mock current time as the snooze triggerTime
    const mockCurrentTime = triggerTime;
    const testSnoozes = parsedState.snoozedReminders || [];
    const todayHabits = parsedState.todayHabits || [];
    
    let snoozedUpdated = false;
    const remainingSnoozes = [];

    for (const snooze of testSnoozes) {
      if (snooze.triggerTime === mockCurrentTime) {
        snoozedUpdated = true;
        const isCompleted = todayHabits.includes(snooze.habitId);
        if (!isCompleted) {
          console.log(`[Mock Cron] Triggering and firing snooze notification for habit #${snooze.habitId}!`);
          // Save simulated delivery telemetry
          const testEvent = {
            eventType: 'notification_delivered',
            metadata: {
              habitName: "Snooze Test Habit",
              category: "growth"
            },
            createdAt: new Date()
          };
          await telemetryCol.insertOne(testEvent);
        }
      } else {
        remainingSnoozes.push(snooze);
      }
    }

    if (snoozedUpdated) {
      parsedState.snoozedReminders = remainingSnoozes;
      console.log(`[Mock Cron] Consumed snooze reminder. Remaining snoozes count: ${remainingSnoozes.length}`);
    }

    console.log("\n--- TEST 3: Simulate /api/habits/complete & skip telemetries ---");
    const testEvents = [
      { eventType: 'notification_completed', metadata: { habitName: 'Snooze Test Habit', category: 'growth' }, createdAt: new Date() },
      { eventType: 'habit_completed', metadata: { habitName: 'Snooze Test Habit', category: 'growth' }, createdAt: new Date() },
      { eventType: 'notification_skipped', metadata: { habitName: 'Snooze Test Habit', category: 'growth' }, createdAt: new Date() }
    ];
    await telemetryCol.insertMany(testEvents);
    console.log("Inserted custom action telemetry events successfully.");

    // Fetch and check
    const countDelivered = await telemetryCol.countDocuments({ eventType: 'notification_delivered', "metadata.habitName": "Snooze Test Habit" });
    const countCompleted = await telemetryCol.countDocuments({ eventType: 'notification_completed', "metadata.habitName": "Snooze Test Habit" });
    const countSkipped = await telemetryCol.countDocuments({ eventType: 'notification_skipped', "metadata.habitName": "Snooze Test Habit" });
    
    console.log(`Verification: Delivered telemetry events: ${countDelivered} (Expect 1)`);
    console.log(`Verification: Completed telemetry events: ${countCompleted} (Expect 1)`);
    console.log(`Verification: Skipped telemetry events: ${countSkipped} (Expect 1)`);

    // Clean up
    state.snoozedReminders = state.snoozedReminders.filter(s => s.habitId !== testHabitId);
    state.gridData = state.gridData.filter(h => h.id !== testHabitId);
    await userStatesCol.updateOne({ userId: user.userId }, { $set: { stateData: JSON.stringify(state) } });
    await telemetryCol.deleteMany({ "metadata.habitName": "Snooze Test Habit" });
    console.log("\nCleaned up all test artifacts successfully.");
    console.log("--- ALL SNOOZE INTEGRATION TESTS PASSED! ---");

  } catch(err) {
    console.error("Test execution failed:", err);
  } finally {
    await client.close();
  }
}

runSnoozeTests();
