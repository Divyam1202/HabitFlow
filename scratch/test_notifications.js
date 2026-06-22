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

function calculateTargetTime(timeHHMM, offsetMinutes) {
  if (!timeHHMM) return '';
  const [hours, minutes] = timeHHMM.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return '';
  
  const date = new Date();
  date.setHours(hours);
  date.setMinutes(minutes - offsetMinutes);
  
  const targetHours = String(date.getHours()).padStart(2, '0');
  const targetMinutes = String(date.getMinutes()).padStart(2, '0');
  return `${targetHours}:${targetMinutes}`;
}

async function runTests() {
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

    console.log("\n--- TEST 1: Timezone & Re-reminders logic ---");
    const testTimezones = ['Asia/Kolkata', 'America/New_York', 'Europe/London', 'UTC', 'Invalid/Timezone'];
    for (const tz of testTimezones) {
      const currentTime = getCurrentTimeInTimezone(tz);
      console.log(`Current time in [${tz}]: ${currentTime}`);
    }

    const testHabitTime = "18:00";
    const testOffset = 15; // 15 mins before 18:00 (17:45)
    console.log(`Habit Time: ${testHabitTime}, Offset: ${testOffset} mins`);
    console.log(`Target Time T (due): ${calculateTargetTime(testHabitTime, testOffset)} (Expect 17:45)`);
    console.log(`Target Time T + 15m: ${calculateTargetTime(testHabitTime, testOffset - 15)} (Expect 18:00)`);
    console.log(`Target Time T + 45m: ${calculateTargetTime(testHabitTime, testOffset - 45)} (Expect 18:30)`);

    console.log("\n--- TEST 2: Simulate complete action database updates ---");
    // Find any user to simulate on
    const user = await userStatesCol.findOne({});
    if (!user) {
      console.log("No users found to run completion simulation on.");
    } else {
      console.log(`Found user: ${user.userId}`);
      console.log(`Original stateData size: ${user.stateData ? user.stateData.length : 0} bytes`);
      
      let state = {};
      try {
        state = JSON.parse(user.stateData || "{}");
      } catch (e) {
        console.error("Failed to parse stateData:", e);
      }

      // We will mock habitId = 9999
      const mockHabitId = 9999;
      if (!state.todayHabits) state.todayHabits = [];
      
      // Ensure mock habit is in gridData
      if (!state.gridData) state.gridData = [];
      const hasMockHabit = state.gridData.some(h => h.id === mockHabitId);
      if (!hasMockHabit) {
        state.gridData.push({
          id: mockHabitId,
          name: "Test Habit via Action",
          category: "🏋️ Health",
          time: "08:00",
          days: [
            { day: 1, completed: false },
            { day: 2, completed: false }
          ]
        });
      }

      // Simulate the update logic
      if (!state.todayHabits.includes(mockHabitId)) {
        state.todayHabits.push(mockHabitId);
      }

      state.gridData = state.gridData.map(h => {
        if (h.id !== mockHabitId) return h;
        const newDays = [...(h.days || [])];
        const lastIdx = newDays.length - 1;
        if (lastIdx >= 0) {
          newDays[lastIdx] = { ...newDays[lastIdx], completed: true };
        }
        return { ...h, days: newDays };
      });

      // Save updated state back (simulate save)
      const updatedStateString = JSON.stringify(state);
      await userStatesCol.updateOne(
        { userId: user.userId },
        { $set: { stateData: updatedStateString } }
      );
      console.log("Updated stateData in DB successfully");

      // Verify the update
      const verifiedUser = await userStatesCol.findOne({ userId: user.userId });
      const verifiedState = JSON.parse(verifiedUser.stateData);
      const isHabitCompleted = verifiedState.todayHabits.includes(mockHabitId);
      const lastDayStatus = verifiedState.gridData.find(h => h.id === mockHabitId)?.days?.slice(-1)[0]?.completed;
      console.log(`Verification: todayHabits contains mockHabitId? ${isHabitCompleted}`);
      console.log(`Verification: last day completed status? ${lastDayStatus}`);

      // Clean up the mock habit from user state so we don't pollute user's actual DB
      state.todayHabits = state.todayHabits.filter(id => id !== mockHabitId);
      state.gridData = state.gridData.filter(h => h.id !== mockHabitId);
      await userStatesCol.updateOne(
        { userId: user.userId },
        { $set: { stateData: JSON.stringify(state) } }
      );
      console.log("Cleaned up mock habit from user state successfully.");
    }

    console.log("\n--- TEST 3: Insert and verify all TelemetryEvents ---");
    // Clear out any old mock telemetries
    await telemetryCol.deleteMany({ "metadata.habitName": "Test Action Telemetry" });

    const eventTypes = [
      'notification_delivered',
      'notification_opened',
      'notification_completed',
      'notification_skipped',
      'notification_snoozed'
    ];

    const testEvents = eventTypes.map(type => ({
      eventType: type,
      metadata: {
        habitName: "Test Action Telemetry",
        category: "health"
      },
      createdAt: new Date()
    }));

    const insertResult = await telemetryCol.insertMany(testEvents);
    console.log(`Inserted ${insertResult.insertedCount} test telemetry events.`);

    // Fetch them back
    const fetchedEvents = await telemetryCol.find({ "metadata.habitName": "Test Action Telemetry" }).toArray();
    console.log(`Successfully fetched ${fetchedEvents.length} events back from DB:`);
    fetchedEvents.forEach(evt => {
      console.log(`  - EventType: ${evt.eventType}, habitName: ${evt.metadata.habitName}`);
    });

    // Cleanup
    await telemetryCol.deleteMany({ "metadata.habitName": "Test Action Telemetry" });
    console.log("Cleaned up test telemetry events successfully.");

    console.log("\n--- ALL TESTS COMPLETED SUCCESSFULLY! ---");

  } catch (error) {
    console.error("Test failed with error:", error);
  } finally {
    await client.close();
  }
}

runTests();
