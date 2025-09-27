from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import cv2
import numpy as np
from ultralytics import YOLO
import base64
import io
from PIL import Image

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Load YOLOv8 model
model = YOLO('yolov8n.pt')
person_counter = 0
tracked_persons = {}  # Store person positions

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

@socketio.on('connect')
def handle_connect():
    print('Client connected')

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)