import cv2
import json
import asyncio
import base64
import io
import os
import threading
import numpy as np
import tempfile
from PIL import Image
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pymongo import MongoClient
from ultralytics import YOLO
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from twilio.rest import Client as TwilioClient
import uvicorn
import tensorflow as tf
from tensorflow.keras.models import load_model

load_dotenv()

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# MongoDB
MONGO_URI       = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
mongo_client    = MongoClient(MONGO_URI)
db              = mongo_client['crowd_detection']
detections_col  = db['detections']
alerts_col      = db['alerts']
daily_stats_col = db['daily_stats']

# Twilio
TWILIO_SID   = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_FROM  = os.getenv('TWILIO_WHATSAPP_FROM')
TWILIO_TO    = os.getenv('TWILIO_WHATSAPP_TO')
print(f"[TWILIO] SID={TWILIO_SID}")
print(f"[TWILIO] FROM={TWILIO_FROM}")
print(f"[TWILIO] TO={TWILIO_TO}")
twilio = TwilioClient(TWILIO_SID, TWILIO_TOKEN)

# YOLO
print("Loading YOLO11n...")
model = YOLO('yolo11n.pt')
model.fuse()
model(np.zeros((640, 640, 3), dtype=np.uint8), verbose=False)
print("YOLO11n ready!")

# UCN Behaviour Model
ucn_model = None
try:
    print("Loading UCN behaviour model...")
    ucn_model = load_model('crowd_model_final.h5', compile=False)
    print("UCN model ready!")
except Exception as e:
    print(f"UCN model skipped: {e}")

def predict_behaviour(frame_bgr):
    if ucn_model is None:
        return "UNKNOWN", 0.0
    try:
        img   = cv2.resize(frame_bgr, (224, 224)) / 255.0
        img   = np.expand_dims(img, axis=0).astype(np.float32)
        score = float(ucn_model.predict(img, verbose=0)[0][0])
        label = "NORMAL" if score > 0.5 else "ABNORMAL"
        conf  = score if score > 0.5 else 1 - score
        return label, round(conf, 2)
    except:
        return "UNKNOWN", 0.0

# Alert state with thread lock to prevent race condition
last_alert_time = 0
ALERT_COOLDOWN  = 60
ALERT_ENABLED   = True   # set False to disable WhatsApp alerts temporarily
_alert_lock     = threading.Lock()

# MongoDB helpers
def save_detection(count):
    now = datetime.now()
    detections_col.insert_one({
        'timestamp': now, 'count': count,
        'hour': now.hour, 'minute': now.minute,
        'date': now.strftime('%Y-%m-%d')
    })
    daily_stats_col.update_one(
        {'date': now.strftime('%Y-%m-%d')},
        {'$push': {'counts': count}, '$setOnInsert': {'alerts': 0}},
        upsert=True
    )

def send_whatsapp_alert(count, threshold, address='Unknown', maps_url=''):
    global last_alert_time
    if not ALERT_ENABLED:
        print(f"[ALERT] Disabled. Would have sent: Count={count}/{threshold}")
        return False
    with _alert_lock:
        now = datetime.now().timestamp()
        if now - last_alert_time < ALERT_COOLDOWN:
            remaining = int(ALERT_COOLDOWN - (now - last_alert_time))
            print(f"[ALERT] Cooldown active, skipping. {remaining}s remaining.")
            return False
        last_alert_time = now  # reserve slot inside lock to prevent race condition
    print(f"[ALERT] Sending WhatsApp... FROM={TWILIO_FROM} TO={TWILIO_TO}")
    try:
        msg = twilio.messages.create(
            body=(
                "CROWD ALERT DETECTED\n\n"
                f"Count: {count}/{threshold}\n"
                f"Time: {datetime.now().strftime('%H:%M:%S')}\n"
                f"Location: {address[:60]}\n"
                f"Maps: {maps_url}\n\n"
                "Threshold exceeded! Immediate attention required."
            ),
            from_=TWILIO_FROM, to=TWILIO_TO
        )
        print(f"[ALERT] WhatsApp sent! SID={msg.sid} Status={msg.status}")
        alerts_col.insert_one({
            'timestamp': datetime.now(),
            'time':      datetime.now().strftime('%H:%M:%S'),
            'count':     count,
            'status':    'ALERT',
            'action':    'WhatsApp sent',
            'location':  address[:50]
        })
        daily_stats_col.update_one(
            {'date': datetime.now().strftime('%Y-%m-%d')},
            {'$inc': {'alerts': 1}}, upsert=True
        )
        return True
    except Exception as e:
        print(f"[ALERT ERROR] {type(e).__name__}: {e}")
        return False

def send_stampede_alert(count, density, risk_level, address='Unknown', maps_url=''):
    global last_alert_time
    if not ALERT_ENABLED:
        return False
    with _alert_lock:
        now = datetime.now().timestamp()
        if now - last_alert_time < ALERT_COOLDOWN:
            return False
        last_alert_time = now
    try:
        twilio.messages.create(
            body=(
                "STAMPEDE RISK ALERT\n\n"
                f"Risk Level: {risk_level}\n"
                f"People Count: {count}\n"
                f"Crowd Density: {density} people/m2\n"
                f"Time: {datetime.now().strftime('%H:%M:%S')}\n"
                f"Location: {address[:60]}\n\n"
                "Safety Guidelines:\n"
                "- CRITICAL (>6 p/m2): Immediate evacuation\n"
                "- DANGEROUS (4-6 p/m2): Stop entry\n"
                "- CROWDED (2-4 p/m2): Monitor closely"
            ),
            from_=TWILIO_FROM, to=TWILIO_TO
        )
        alerts_col.insert_one({
            'timestamp': datetime.now(),
            'time':      datetime.now().strftime('%H:%M:%S'),
            'count':     count,
            'density':   float(density),
            'status':    risk_level,
            'action':    'WhatsApp sent',
            'location':  address[:50]
        })
        daily_stats_col.update_one(
            {'date': datetime.now().strftime('%Y-%m-%d')},
            {'$inc': {'alerts': 1}}, upsert=True
        )
        return True
    except Exception as e:
        print(f"Stampede alert error: {e}")
        return False

def send_manual_report(report_data):
    try:
        twilio.messages.create(
            body=(
                "MANUAL CROWD REPORT\n\n"
                f"Time: {report_data.get('timestamp','N/A')}\n"
                f"Count: {report_data.get('densityCount',0)}\n"
                f"Threshold: {report_data.get('threshold',10)}\n"
                f"Location: {report_data.get('detailedAddress','N/A')}\n"
                f"Maps: {report_data.get('liveLocationUrl','N/A')}\n\n"
                f"Status: {'ALERT - Threshold Exceeded' if report_data.get('densityCount',0) >= report_data.get('threshold',10) else 'Normal'}"
            ),
            from_=TWILIO_FROM, to=TWILIO_TO
        )
        return True
    except Exception as e:
        print(f"Manual report error: {e}")
        return False

# Analytics
def get_analytics():
    records = list(detections_col.find().sort('timestamp', -1).limit(1000))
    hourly  = {}
    for r in records:
        hourly.setdefault(r['hour'], []).append(r['count'])
    hourly_avg = {h: sum(v)/len(v) for h, v in hourly.items()}
    peak       = max(hourly_avg.items(), key=lambda x: x[1]) if hourly_avg else (0, 0)
    recent     = [r['count'] for r in records[:50]]

    windows = {}
    for r in records:
        w = f"{r['hour']:02d}:{(r['minute']//15)*15:02d}"
        windows.setdefault(w, []).append(r['count'])
    peak_time_range = {'start':'--','end':'--','avg':0}
    if windows:
        pw   = max(windows.items(), key=lambda x: sum(x[1])/len(x[1]))
        h, m = map(int, pw[0].split(':'))
        em   = m + 15
        eh   = h + em // 60
        em   = em % 60
        peak_time_range = {
            'start': pw[0],
            'end':   f"{eh:02d}:{em:02d}",
            'avg':   round(sum(pw[1])/len(pw[1]), 1)
        }

    return {
        'hourly':           hourly_avg,
        'peak_hour':        peak[0],
        'peak_count':       round(peak[1], 1),
        'peak_time_range':  peak_time_range,
        'trend':            recent,
        'avg_count':        sum(recent)/len(recent) if recent else 0,
        'total_detections': len(records)
    }

def get_daily(date=None):
    date    = date or datetime.now().strftime('%Y-%m-%d')
    records = list(detections_col.find({'date': date}))
    counts  = [r['count'] for r in records]
    stats   = daily_stats_col.find_one({'date': date}) or {'counts': [], 'alerts': 0}
    all_c   = counts + stats.get('counts', [])
    return {
        'date':             date,
        'peak_crowd':       max(all_c) if all_c else 0,
        'avg_crowd':        round(sum(all_c)/len(all_c), 1) if all_c else 0,
        'total_alerts':     stats.get('alerts', 0),
        'total_detections': len(records)
    }

def get_weekly():
    return [get_daily((datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')) for i in range(7)]

def get_alerts_data():
    alerts = list(alerts_col.find().sort('timestamp', -1).limit(50))
    return [{
        'time':     a['time'],
        'location': a.get('location', ''),
        'count':    a['count'],
        'density':  a.get('density', 0),
        'status':   a['status'],
        'action':   a['action']
    } for a in alerts]

# WebSocket: Camera stream
@app.websocket("/ws")
async def camera_ws(websocket: WebSocket):
    await websocket.accept()
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_FPS, 30)
    frame_count = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.1)
                continue

            results = model(frame, classes=[0], conf=0.4, iou=0.5, verbose=False)
            detections = []
            if results[0].boxes is not None:
                for i, box in enumerate(results[0].boxes):
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    detections.append({
                        "id": i + 1,
                        "x": x1, "y": y1,
                        "w": x2-x1, "h": y2-y1,
                        "conf": round(float(box.conf[0]), 2)
                    })

            count = len(detections)
            frame_count += 1

            if frame_count % 5 == 0:
                asyncio.get_event_loop().run_in_executor(None, save_detection, count)

            behaviour, behaviour_conf = "UNKNOWN", 0.0
            if frame_count % 10 == 0:
                behaviour, behaviour_conf = predict_behaviour(frame)

            _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
            await websocket.send_text(json.dumps({
                "frame":          base64.b64encode(buf).decode(),
                "detections":     detections,
                "count":          count,
                "behaviour":      behaviour,
                "behaviour_conf": behaviour_conf
            }))
            await asyncio.sleep(0.033)

    except WebSocketDisconnect:
        pass
    finally:
        cap.release()

# WebSocket: Data channel
@app.websocket("/ws/data")
async def data_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        await websocket.send_text(json.dumps({'type': 'analytics', 'data': get_analytics()}))
        await websocket.send_text(json.dumps({'type': 'daily',     'data': get_daily()}))
        await websocket.send_text(json.dumps({'type': 'alerts',    'data': get_alerts_data()}))

        while True:
            try:
                msg    = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
                data   = json.loads(msg)
                action = data.get('action')

                if action == 'get_analytics':
                    await websocket.send_text(json.dumps({'type': 'analytics', 'data': get_analytics()}))

                elif action == 'get_daily':
                    await websocket.send_text(json.dumps({'type': 'daily', 'data': get_daily()}))

                elif action == 'get_weekly':
                    await websocket.send_text(json.dumps({'type': 'weekly', 'data': get_weekly()}))

                elif action == 'get_alerts':
                    await websocket.send_text(json.dumps({'type': 'alerts', 'data': get_alerts_data()}))

                elif action == 'threshold_alert':
                    success = await asyncio.get_event_loop().run_in_executor(
                        None, send_whatsapp_alert,
                        data.get('count', 0),
                        data.get('threshold', 10),
                        data.get('address', 'Unknown'),
                        data.get('maps_url', '')
                    )
                    await websocket.send_text(json.dumps({'type': 'alert_sent', 'success': success}))
                    await websocket.send_text(json.dumps({'type': 'alerts', 'data': get_alerts_data()}))

                elif action == 'stampede_alert':
                    success = await asyncio.get_event_loop().run_in_executor(
                        None, send_stampede_alert,
                        data.get('count', 0),
                        data.get('density', 0),
                        data.get('risk_level', 'UNKNOWN'),
                        data.get('address', 'Unknown'),
                        data.get('maps_url', '')
                    )
                    await websocket.send_text(json.dumps({'type': 'stampede_sent', 'success': success}))
                    await websocket.send_text(json.dumps({'type': 'alerts', 'data': get_alerts_data()}))

                elif action == 'send_report':
                    success = await asyncio.get_event_loop().run_in_executor(
                        None, send_manual_report, data.get('report', {})
                    )
                    await websocket.send_text(json.dumps({'type': 'report_sent', 'success': success}))

            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({'type': 'analytics', 'data': get_analytics()}))
                await websocket.send_text(json.dumps({'type': 'daily',     'data': get_daily()}))
                await websocket.send_text(json.dumps({'type': 'alerts',    'data': get_alerts_data()}))

    except WebSocketDisconnect:
        pass

# WebSocket: Video upload
@app.websocket("/ws/video")
async def video_ws(websocket: WebSocket):
    await websocket.accept()
    tmp_path = None
    try:
        video_bytes = await websocket.receive_bytes()
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as f:
            f.write(video_bytes)
            tmp_path = f.name

        cap = cv2.VideoCapture(tmp_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        frame_count = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            results = model(frame, classes=[0], conf=0.4, iou=0.5, verbose=False)
            detections = []
            if results[0].boxes is not None:
                for i, box in enumerate(results[0].boxes):
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    detections.append({"id": i+1, "x": x1, "y": y1, "w": x2-x1, "h": y2-y1, "conf": round(float(box.conf[0]), 2)})

            count = len(detections)
            frame_count += 1

            behaviour, behaviour_conf = "UNKNOWN", 0.0
            if frame_count % 10 == 0:
                behaviour, behaviour_conf = predict_behaviour(frame)

            _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
            await websocket.send_text(json.dumps({
                "frame":          base64.b64encode(buf).decode(),
                "detections":     detections,
                "count":          count,
                "behaviour":      behaviour,
                "behaviour_conf": behaviour_conf
            }))
            await asyncio.sleep(1 / fps)

        cap.release()
        await websocket.send_text(json.dumps({"done": True}))
    except WebSocketDisconnect:
        pass
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass  # Windows file lock, ignore

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000, log_level="warning")
