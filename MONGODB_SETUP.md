# MongoDB Setup Guide

## Steps to Add MongoDB Storage

### 1. Install MongoDB
**Windows:**
- Download from: https://www.mongodb.com/try/download/community
- Run installer, choose "Complete" installation
- Install as Windows Service (default)

**Or use MongoDB Atlas (Cloud - Free):**
- Go to: https://www.mongodb.com/cloud/atlas/register
- Create free cluster
- Get connection string

### 2. Install Python Package
```bash
cd backend
pip install pymongo
```

### 3. Configure MongoDB URI
Edit `backend/.env`:
```
MONGO_URI=mongodb://localhost:27017/
```

**For MongoDB Atlas:**
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/
```

### 4. Start MongoDB (Local)
```bash
# Windows - MongoDB runs as service automatically
# Or manually:
mongod
```

### 5. Start Backend
```bash
cd backend
python app.py
```

## What's Stored in MongoDB

### Collections:
1. **detections** - All crowd detection records
   - timestamp, count, hour, minute, date

2. **alerts** - All threshold alerts
   - timestamp, location, count, threshold, status, action

3. **daily_stats** - Daily aggregated statistics
   - date, counts array, total alerts

## Benefits:
✅ Data persists after server restart
✅ Query historical data
✅ Scalable storage
✅ Automatic indexing
✅ No memory limits

## Verify MongoDB is Working:
```bash
# Connect to MongoDB shell
mongosh

# Check database
use crowd_detection
db.detections.countDocuments()
db.alerts.countDocuments()
```
