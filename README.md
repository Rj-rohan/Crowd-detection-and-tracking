# Crowd Detection & Tracking

YOLOv8-powered **real-time** person detection and crowd tracking system with automatic monitoring.

## 🎯 Key Features

- ⚡ **Real-Time Detection** - Continuous monitoring at 10 FPS
- 🎥 **Auto-Start** - Detection begins immediately when camera starts
- 🚨 **Smart Alerts** - Automatic WhatsApp notifications on threshold breach
- 📊 **Live Dashboard** - Real-time count, density map, and analytics
- 📍 **GPS Tracking** - Auto location with detailed address
- 📄 **HTML Reports** - Downloadable reports with images
- 🗄️ **MongoDB** - Historical data and analytics

## Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Features
- ⚡ **Real-time detection** at 10 FPS (frames per second)
- 🎥 **Automatic monitoring** - starts immediately with camera
- 🔴 **Live indicator** - visual feedback when detection is active
- 👥 **Person counting** with unique ID tracking
- 📊 **Crowd density map** with real-time visualization
- 🚨 **Automatic alerts** via WhatsApp when threshold exceeded
- 📍 **GPS location** with detailed address lookup
- 📄 **HTML reports** with camera snapshots and density maps
- 📈 **Analytics dashboard** with hourly trends and peak times
- 🗄️ **MongoDB storage** for historical data

## Usage
1. Start MongoDB, backend, and frontend servers
2. Open browser at `http://localhost:5173`
3. Click **"Start Camera"** - detection begins automatically
4. Watch real-time count with 🔴 live indicator
5. Set threshold for automatic WhatsApp alerts
6. Generate reports anytime with images

## How It Works

### Real-Time Operation (Like Professional CCTV)
```
Camera ON → Continuous Detection → Live Updates → Auto Alerts
```

- **Frame Rate**: 10 FPS (every 100ms)
- **Detection**: YOLOv8x model (~50-100ms per frame)
- **Total Latency**: ~150-200ms (real-time)
- **Auto Alerts**: WhatsApp when count ≥ threshold

### Detection Modes
- **Camera**: Real-time at 10 FPS (continuous)
- **Image**: Single frame analysis (high accuracy)
- **Video**: Tracking mode with ByteTrack

See [REALTIME_SYSTEM.md](REALTIME_SYSTEM.md) for detailed documentation.