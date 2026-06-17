const { MongoClient } = require('mongodb');
const admin = require('firebase-admin');
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

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI is not loaded!");
    return;
  }

  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    const db = client.db();
    const collection = db.collection('userstates');
    
    // Find a user with fcmToken
    const user = await collection.findOne({ fcmToken: { $exists: true, $ne: "" } });
    if (!user) {
      console.error("No user with FCM token found in DB.");
      return;
    }

    console.log(`Found user: ${user.userId}`);
    const token = user.fcmToken;
    console.log(`Token length: ${token.length}`);
    console.log(`Token start: ${token.substring(0, 15)}...`);

    // Initialize Firebase Admin
    const { initializeApp: initApp, getApps: getAppsList, cert: certCred } = require('firebase-admin/app');
    const { getMessaging: getMessagingInstance } = require('firebase-admin/messaging');

    if (!getAppsList().length) {
      initApp({
        credential: certCred({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY
        })
      });
      console.log("Firebase Admin initialized");
    }
    const messagingInstance = getMessagingInstance();

    // Try sending ACTUAL notification payload
    const message = {
      notification: {
        title: 'HabytFlow Reminder',
        body: 'This is an actual test habit reminder notification!',
      },
      token: token,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default',
          vibrateTimingsMillis: [0, 500, 500, 500],
          defaultVibrateTimings: false,
          defaultSound: true
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default'
          }
        }
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200, 100, 200]
        }
      }
    };

    console.log("Sending message...");
    const response = await messagingInstance.send(message);
    console.log("SUCCESSFULLY SENT MESSAGE! Response:", response);

  } catch (err) {
    console.error("ERROR SENDING MESSAGE:", err);
  } finally {
    await client.close();
  }
}

main();
