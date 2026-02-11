from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import cv2
import numpy as np
from ultralytics import YOLO
import base64
import io
from PIL import Image
from twilio.rest import Client
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Twilio configuration from environment variables
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_WHATSAPP_FROM = os.getenv('TWILIO_WHATSAPP_FROM')
TWILIO_WHATSAPP_TO = os.getenv('TWILIO_WHATSAPP_TO')

# MongoDB configuration
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
mongo_client = MongoClient(MONGO_URI)
db = mongo_client['crowd_detection']
detections_col = db['detections']
alerts_col = db['alerts']
daily_stats_col = db['daily_stats']

client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# Load YOLOv8 models
print("Loading YOLOv8n (fast) for camera...")
model_fast = YOLO('yolov8n.pt')
print("Loading YOLOv8x (accurate) for image/video...")
model_accurate = YOLO('yolov8x.pt')
print("Models loaded successfully!")
last_alert_time = 0
ALERT_COOLDOWN = 60
frame_skip_counter = 0

@socketio.on('video_frame')
def handle_video_frame(data):
    global detection_history, frame_skip_counter
    try:
        source_type = data.get('source_type', 'camera')
        
        # Skip frames for camera only
        if source_type == 'camera':
            frame_skip_counter += 1
            if frame_skip_counter % 2 != 0:  # Process every 2nd frame
                return
        
        image_data = data['frame'].split(',')[1]
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        img_array = np.array(image)
        
        # Different processing based on source
        if source_type == 'camera':
            current_detections = process_camera_frame(img_array)
        elif source_type == 'image':
            current_detections = process_image_frame(img_array)
        elif source_type == 'video':
            current_detections = process_video_frame(img_array)
        else:
            current_detections = process_camera_frame(img_array)
        
        detection_data = {
            'timestamp': datetime.now(),
            'count': len(current_detections),
            'hour': datetime.now().hour,
            'minute': datetime.now().minute,
            'date': datetime.now().strftime('%Y-%m-%d')
        }
        detections_col.insert_one(detection_data)
        update_daily_stats(len(current_detections))
        
        emit('detection_result', {
            'count': len(current_detections),
            'detections': current_detections
        })
        
    except Exception as e:
        print(f"Error: {e}")
        emit('detection_result', {'count': 0, 'detections': []})

def process_camera_frame(img_array):
    """Process live camera feed - FAST MODEL"""
    # Resize to 416x416 for maximum speed
    img_array = cv2.resize(img_array, (416, 416))
    
    results = model_fast(img_array, conf=0.4, iou=0.5, classes=[0], max_det=50, verbose=False)
    
    detections = []
    for r in results:
        boxes = r.boxes
        if boxes is not None:
            for i, box in enumerate(boxes):
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                # Scale back to original size
                detections.append({
                    'id': i + 1,
                    'bbox': [int(x1), int(y1), int(x2), int(y2)],
                    'confidence': float(box.conf[0])
                })
    return detections

def process_image_frame(img_array):
    """Process uploaded image - no tracking, lower confidence - ACCURATE MODEL"""
    results = model_accurate(img_array, conf=0.1, iou=0.3, classes=[0], max_det=500, agnostic_nms=True, verbose=False)
    
    detections = []
    for r in results:
        boxes = r.boxes
        if boxes is not None:
            for i, box in enumerate(boxes):
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    'id': i + 1,
                    'bbox': [int(x1), int(y1), int(x2), int(y2)],
                    'confidence': float(box.conf[0])
                })
    return detections

def process_video_frame(img_array):
    """Process uploaded video - tracking with lower confidence - ACCURATE MODEL"""
    results = model_accurate.track(img_array, conf=0.2, iou=0.4, persist=True, tracker="bytetrack.yaml", classes=[0], max_det=400, verbose=False)
    
    detections = []
    for r in results:
        boxes = r.boxes
        if boxes is not None and boxes.id is not None:
            for box, track_id in zip(boxes, boxes.id):
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    'id': int(track_id),
                    'bbox': [int(x1), int(y1), int(x2), int(y2)],
                    'confidence': float(box.conf[0])
                })
        elif boxes is not None:
            for i, box in enumerate(boxes):
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    'id': i + 1,
                    'bbox': [int(x1), int(y1), int(x2), int(y2)],
                    'confidence': float(box.conf[0])
                })
    return detections

def send_whatsapp_report(count, threshold, location_data=None, detections_data=None):
    global last_alert_time
    current_time = datetime.now().timestamp()
    
    if current_time - last_alert_time < ALERT_COOLDOWN:
        return False
    
    try:
        # Create HTML report
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Crowd Alert Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }}
        .container {{ max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }}
        .header {{ text-align: center; color: #d32f2f; border-bottom: 3px solid #f44336; padding-bottom: 15px; margin-bottom: 20px; }}
        .alert {{ background: #ffebee; border: 2px solid #f44336; padding: 15px; border-radius: 8px; margin: 15px 0; }}
        .info {{ background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; }}
        .location {{ background: #f3e5f5; padding: 15px; border-radius: 8px; margin: 15px 0; }}
        .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 12px; }}
        .status {{ font-size: 18px; font-weight: bold; color: #d32f2f; }}
        a {{ color: #1976d2; text-decoration: none; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 CROWD ALERT REPORT</h1>
            <p class="status">THRESHOLD EXCEEDED - IMMEDIATE ATTENTION REQUIRED</p>
        </div>
        
        <div class="alert">
            <h3>📊 Detection Summary</h3>
            <p><strong>People Count:</strong> {count}</p>
            <p><strong>Threshold:</strong> {threshold}</p>
            <p><strong>Status:</strong> ALERT - Threshold Exceeded</p>
            <p><strong>Detection Time:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </div>
        
        <div class="location">
            <h3>📍 Location Information</h3>
            <p><strong>Address:</strong> {location_data.get('address', 'Location not available') if location_data else 'Location not available'}</p>
            <p><strong>Track Location:</strong> <a href="{location_data.get('maps_url', '#') if location_data else '#'}" target="_blank">🗺️ View on Google Maps</a></p>
        </div>
        
        <div class="info">
            <h3>👥 Detection Details</h3>
            <p><strong>Detected Person IDs:</strong> {', '.join([str(d.get('id', '?')) for d in detections_data]) if detections_data else 'No detections'}</p>
            <p><strong>Total Detections:</strong> {len(detections_data) if detections_data else 0}</p>
        </div>
        
        <div class="footer">
            <p>Auto-generated by Crowd Detection System</p>
            <p>Report ID: ALERT-{int(current_time)}</p>
        </div>
    </div>
</body>
</html>
        """
        
        # Save HTML file temporarily
        filename = f"crowd_alert_{int(current_time)}.html"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        # Send text message with HTML report link
        message_text = f"""
🚨 *CROWD ALERT DETECTED*

📊 Count: {count}/{threshold}
🕐 Time: {datetime.now().strftime('%H:%M:%S')}
📍 Location: {location_data.get('address', 'Unknown')[:50] if location_data else 'Unknown'}

📄 Detailed HTML report generated
⚠️ Immediate attention required!
        """
        
        message = client.messages.create(
            body=message_text,
            from_=TWILIO_WHATSAPP_FROM,
            to=TWILIO_WHATSAPP_TO
        )
        
        # Clean up temp file
        try:
            os.remove(filename)
        except:
            pass
        
        last_alert_time = current_time
        print(f"WhatsApp HTML report sent automatically: {message.sid}")
        return True
        
    except Exception as e:
        print(f"Failed to send WhatsApp HTML report: {e}")
        return False

def update_daily_stats(count):
    today = datetime.now().strftime('%Y-%m-%d')
    daily_stats_col.update_one(
        {'date': today},
        {'$push': {'counts': count}, '$setOnInsert': {'alerts': 0}},
        upsert=True
    )

@socketio.on('stampede_alert')
def handle_stampede_alert(data):
    global alert_history
    count = data.get('count', 0)
    density = data.get('density', 0)
    risk_level = data.get('risk_level', 'UNKNOWN')
    area = data.get('area', 50)
    location_data = data.get('location', {})
    detections_data = data.get('detections', [])
    
    alert_data = {
        'timestamp': datetime.now(),
        'time': datetime.now().strftime('%H:%M:%S'),
        'location': location_data.get('address', 'Unknown')[:50],
        'count': count,
        'density': float(density),
        'area': area,
        'status': risk_level,
        'action': 'WhatsApp sent'
    }
    alerts_col.insert_one(alert_data)
    
    # Update daily alert count
    today = datetime.now().strftime('%Y-%m-%d')
    daily_stats_col.update_one(
        {'date': today},
        {'$inc': {'alerts': 1}},
        upsert=True
    )
    
    print(f"Stampede alert: {count} people, Density: {density} p/m², Risk: {risk_level}")
    success = send_stampede_alert(count, density, risk_level, area, location_data, detections_data)
    
    emit('alert_sent', {
        'success': success,
        'count': count,
        'density': density,
        'risk_level': risk_level,
        'type': 'stampede_alert'
    })

def send_stampede_alert(count, density, risk_level, area, location_data=None, detections_data=None):
    global last_alert_time
    current_time = datetime.now().timestamp()
    
    if current_time - last_alert_time < ALERT_COOLDOWN:
        return False
    
    try:
        message_text = f"""
🚨 *STAMPEDE RISK ALERT*

⚠️ *Risk Level:* {risk_level}
👥 *People Count:* {count}
📊 *Crowd Density:* {density} people/m²
📐 *Coverage Area:* {area} m²
🕐 *Time:* {datetime.now().strftime('%H:%M:%S')}
📍 *Location:* {location_data.get('address', 'Unknown')[:50] if location_data else 'Unknown'}

🔴 *Safety Guidelines:*
- CRITICAL (>6 p/m²): Immediate evacuation
- DANGEROUS (4-6 p/m²): Stop entry, manage flow
- CROWDED (2-4 p/m²): Monitor closely

⚠️ *Immediate action required!*
        """
        
        message = client.messages.create(
            body=message_text,
            from_=TWILIO_WHATSAPP_FROM,
            to=TWILIO_WHATSAPP_TO
        )
        
        last_alert_time = current_time
        print(f"WhatsApp stampede alert sent: {message.sid}")
        return True
        
    except Exception as e:
        print(f"Failed to send WhatsApp alert: {e}")
        return False

@socketio.on('send_report')
def handle_send_report(data):
    try:
        report_data = data.get('report', {})
        
        report_text = f"""
📊 *MANUAL CROWD REPORT* 📊

🕐 *Time:* {report_data.get('timestamp', 'N/A')}
👥 *People Count:* {report_data.get('densityCount', 0)}
🎯 *Threshold:* {report_data.get('threshold', 5)}
📍 *Location:* {report_data.get('detailedAddress', 'N/A')}

🗺️ *Track Location:*
{report_data.get('liveLocationUrl', 'Not available')}

📋 *Status:* {'🚨 ALERT - Threshold Exceeded' if report_data.get('densityCount', 0) >= report_data.get('threshold', 5) else '✅ Normal Density'}

*Generated manually by user*
        """
        
        message = client.messages.create(
            body=report_text,
            from_=TWILIO_WHATSAPP_FROM,
            to=TWILIO_WHATSAPP_TO
        )
        
        print(f"Manual WhatsApp report sent: {message.sid}")
        emit('report_sent', {'success': True, 'message_id': message.sid, 'type': 'manual_report'})
        
    except Exception as e:
        print(f"Failed to send manual WhatsApp report: {e}")
        emit('report_sent', {'success': False, 'error': str(e)})

@socketio.on('get_analytics')
def handle_get_analytics():
    detection_records = list(detections_col.find().sort('timestamp', -1).limit(1000))
    
    hourly_data = {}
    time_series = []
    
    for record in detection_records:
        hour = record['hour']
        hourly_data[hour] = hourly_data.get(hour, []) + [record['count']]
        time_series.append({'time': record['timestamp'].isoformat(), 'count': record['count']})
    
    hourly_avg = {h: sum(counts)/len(counts) for h, counts in hourly_data.items()}
    peak_hour = max(hourly_avg.items(), key=lambda x: x[1]) if hourly_avg else (0, 0)
    
    peak_time_range = find_peak_time_range(detection_records)
    
    recent_counts = [r['count'] for r in detection_records[:50]]
    
    emit('analytics_data', {
        'hourly': hourly_avg,
        'peak_hour': peak_hour[0],
        'peak_count': round(peak_hour[1], 1),
        'peak_time_range': peak_time_range,
        'trend': recent_counts,
        'time_series': time_series[:100],
        'total_detections': len(detection_records),
        'avg_count': sum(recent_counts)/len(recent_counts) if recent_counts else 0
    })

def find_peak_time_range(records):
    if len(records) < 10:
        return {'start': '00:00', 'end': '00:00', 'avg': 0}
    
    windows = {}
    for record in records:
        hour = record['hour']
        minute = record['minute']
        window = f"{hour:02d}:{(minute//15)*15:02d}"
        windows[window] = windows.get(window, []) + [record['count']]
    
    if not windows:
        return {'start': '00:00', 'end': '00:00', 'avg': 0}
    
    peak_window = max(windows.items(), key=lambda x: sum(x[1])/len(x[1]))
    start_time = peak_window[0]
    hour, minute = map(int, start_time.split(':'))
    end_minute = minute + 15
    end_hour = hour + (end_minute // 60)
    end_minute = end_minute % 60
    
    return {
        'start': start_time,
        'end': f"{end_hour:02d}:{end_minute:02d}",
        'avg': round(sum(peak_window[1])/len(peak_window[1]), 1)
    }

@socketio.on('get_daily_report')
def handle_get_daily_report():
    today = datetime.now().strftime('%Y-%m-%d')
    report = generate_daily_report(today)
    emit('daily_report', report)

@socketio.on('get_weekly_report')
def handle_get_weekly_report():
    reports = []
    for i in range(7):
        date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
        reports.append(generate_daily_report(date))
    emit('weekly_report', {'reports': reports})

def generate_daily_report(date):
    day_records = list(detections_col.find({'date': date}))
    counts = [r['count'] for r in day_records]
    
    stats = daily_stats_col.find_one({'date': date}) or {'counts': [], 'alerts': 0}
    all_counts = counts + stats.get('counts', [])
    
    return {
        'date': date,
        'peak_crowd': max(all_counts) if all_counts else 0,
        'avg_crowd': round(sum(all_counts)/len(all_counts), 1) if all_counts else 0,
        'total_alerts': stats.get('alerts', 0),
        'total_detections': len(day_records)
    }

@socketio.on('get_alerts')
def handle_get_alerts():
    alerts = list(alerts_col.find().sort('timestamp', -1).limit(50))
    alerts_data = [{
        'time': a['time'],
        'location': a['location'],
        'count': a['count'],
        'density': a.get('density', 0),
        'status': a['status'],
        'action': a['action']
    } for a in alerts]
    emit('alerts_data', {'alerts': alerts_data})

@socketio.on('reset_counter')
def handle_reset_counter():
    global frame_skip_counter
    frame_skip_counter = 0
    print('Frame counter reset')

@socketio.on('connect')
def handle_connect():
    print('Client connected')

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)