# Industry-Level Crowd Detection Dashboard

## New Features Added ✨

### 1. **Live Camera Feed**
- Real-time person detection with ByteTrack
- Bounding boxes with stable IDs
- Live person count display

### 2. **Analytics Panel**
- **Crowd Trends**: Visual bar chart showing last 50 detection frames
- **Peak Hours**: Hourly average crowd density analysis
- **Heatmap**: Real-time crowd density visualization with color gradients

### 3. **Alert History Table**
- Time of alert
- Location (truncated address)
- Count vs Threshold
- Status (Warning/Critical)
- Action taken (WhatsApp sent)

## Setup Instructions

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

## Dashboard Features

### Header Stats
- **Live Count**: Current number of people detected
- **Peak Hour**: Hour with highest average crowd
- **Avg Count**: Average people count over recent detections

### Live Feed Panel
- Start/Stop camera controls
- Adjustable threshold
- Real-time bounding boxes with IDs
- Location tracking with Google Maps link

### Analytics Panel
- **Trend Chart**: Color-coded bars (blue=normal, red=threshold exceeded)
- **Hourly Chart**: Shows peak hours with gradient bars
- **Heatmap**: Dark background with red heat zones showing crowd density

### Alert History
- Scrollable table with all alerts
- Color-coded rows (red=critical, orange=warning)
- Shows complete alert lifecycle

## Technical Improvements

### ByteTrack Integration
- Stable ID tracking across frames
- Better occlusion handling
- Optimized for crowded scenes
- Lower confidence threshold (0.4) for better detection

### Analytics Storage
- In-memory storage (last 1000 detections)
- Hourly aggregation
- Alert history (last 100 alerts)

## API Endpoints

### Socket Events
- `video_frame`: Send frame for detection
- `get_analytics`: Request analytics data
- `get_alerts`: Request alert history
- `threshold_alert`: Triggered when threshold exceeded

## Usage

1. Start backend server (port 5000)
2. Start frontend (port 5173)
3. Open browser to http://localhost:5173
4. Click "▶ Start" to begin detection
5. Monitor live feed, analytics, and alerts in real-time

## Next Steps for Production

- Add PostgreSQL/MongoDB for persistent storage
- Implement user authentication
- Add multi-camera support
- Export reports to PDF/CSV
- Add video recording on alerts
- Implement zone-based detection
