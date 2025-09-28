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
from datetime import datetime
import os
from dotenv import load_dotenv

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

client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# Load YOLOv8 model
model = YOLO('yolov8n.pt')
person_counter = 0
tracked_persons = {}
last_alert_time = 0
ALERT_COOLDOWN = 60  # 1 minute cooldown for testing

@socketio.on('video_frame')
def handle_video_frame(data):
    global person_counter, tracked_persons
    try:
        # Decode image
        image_data = data['frame'].split(',')[1]
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to numpy array
        img_array = np.array(image)
        
        # Run detection
        results = model(img_array, conf=0.5)
        
        current_detections = []
        for r in results:
            boxes = r.boxes
            if boxes is not None:
                for box in boxes:
                    if int(box.cls[0]) == 0:  # Person class
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        center_x = (x1 + x2) / 2
                        center_y = (y1 + y2) / 2
                        
                        # Find closest existing person (within 100 pixels)
                        assigned_id = None
                        min_distance = 100
                        
                        for person_id, (old_x, old_y) in tracked_persons.items():
                            distance = ((center_x - old_x)**2 + (center_y - old_y)**2)**0.5
                            if distance < min_distance:
                                min_distance = distance
                                assigned_id = person_id
                        
                        # If no close person found, create new ID
                        if assigned_id is None:
                            person_counter += 1
                            assigned_id = person_counter
                        
                        # Update position
                        tracked_persons[assigned_id] = (center_x, center_y)
                        
                        current_detections.append({
                            'id': assigned_id,
                            'bbox': [int(x1), int(y1), int(x2), int(y2)],
                            'confidence': float(box.conf[0])
                        })
        
        # Remove persons not seen in current frame
        current_ids = [d['id'] for d in current_detections]
        tracked_persons = {pid: pos for pid, pos in tracked_persons.items() if pid in current_ids}
        
        print(f"Found {len(current_detections)} persons with IDs: {current_ids}")
        
        emit('detection_result', {
            'count': len(current_detections),
            'detections': current_detections
        })
        
    except Exception as e:
        print(f"Error: {e}")
        emit('detection_result', {'count': 0, 'detections': []})

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

@socketio.on('threshold_alert')
def handle_threshold_alert(data):
    count = data.get('count', 0)
    threshold = data.get('threshold', 5)
    location_data = data.get('location', {})
    detections_data = data.get('detections', [])
    
    print(f"Threshold alert received: {count}/{threshold} - Sending full report")
    success = send_whatsapp_report(count, threshold, location_data, detections_data)
    
    emit('alert_sent', {
        'success': success,
        'count': count,
        'threshold': threshold,
        'type': 'auto_report'
    })

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

@socketio.on('connect')
def handle_connect():
    print('Client connected')

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)