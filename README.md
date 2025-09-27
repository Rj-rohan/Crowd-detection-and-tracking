# Crowd Detection & Tracking

YOLOv8-powered real-time person detection and crowd tracking system.

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
- Real-time person detection using YOLOv8
- Live webcam processing
- Person count tracking
- Bounding box visualization

## Usage
1. Start backend server (port 5000)
2. Start frontend dev server (port 5173)
3. Click "Start Camera" to begin detection
4. View real-time person count and bounding boxes