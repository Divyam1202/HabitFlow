const { MongoClient } = require('mongodb');

async function main() {
  const uri = "mongodb+srv://habytflow_db_user:8rev3D8xFl3zxQJZ@cluster0.02fqvey.mongodb.net/?appName=Cluster0";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB");
    const db = client.db();
    const collection = db.collection('userstates');
    
    const users = await collection.find({ fcmToken: { $exists: true, $ne: "" } }).toArray();
    console.log(`Found ${users.length} users with FCM tokens:`);
    users.forEach(u => {
      console.log(`User ID: ${u.userId}`);
      console.log(`FCM Token: ${u.fcmToken ? u.fcmToken.substring(0, 20) + '...' : 'none'}`);
      try {
        const data = JSON.parse(u.stateData);
        const habits = data.gridData || [];
        console.log(`Habits:`, habits.map(h => `${h.name} at ${h.time} (remind: ${h.notification}m)`));
      } catch (e) {
        console.log("Failed to parse stateData for", u.userId);
      }
      console.log('---');
    });

  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

main();
