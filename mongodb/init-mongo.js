// MongoDB Initialization Script
db = db.getSiblingDB('crowd_detection');

db.createCollection('detections');
db.createCollection('alerts');
db.createCollection('daily_stats');

// Create indexes
db.detections.createIndex({ timestamp: -1 });
db.detections.createIndex({ date: 1 });
db.detections.createIndex({ date: 1, hour: 1 });
db.detections.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

db.alerts.createIndex({ timestamp: -1 });
db.alerts.createIndex({ status: 1, timestamp: -1 });
db.alerts.createIndex({ timestamp: 1 }, { expireAfterSeconds: 15552000 });

db.daily_stats.createIndex({ date: 1 }, { unique: true });

print('Database initialized successfully!');
