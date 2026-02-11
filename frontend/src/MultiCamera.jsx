import { useState, useRef, useEffect } from 'react'
import io from 'socket.io-client'
import './MultiCamera.css'

function MultiCamera() {
  const [cameras, setCameras] = useState([])
  const [analytics, setAnalytics] = useState({ hourly: {}, trend: [], peak_hour: 0, avg_count: 0 })
  const [alertHistory, setAlertHistory] = useState([])
  const [threshold, setThreshold] = useState(5)
  const [totalCount, setTotalCount] = useState(0)
  
  const socketRef = useRef(null)
  const camerasRef = useRef({})

  useEffect(() => {
    socketRef.current = io('http://localhost:5000')
    
    socketRef.current.on('detection_result', (data) => {
      setCameras(prev => prev.map(cam => 
        cam.id === data.camera_id 
          ? { ...cam, count: data.count, detections: data.detections }
          : cam
      ))
      updateTotalCount()
    })
    
    socketRef.current.on('analytics_data', (data) => setAnalytics(data))
    socketRef.current.on('alerts_data', (data) => setAlertHistory(data.alerts))

    const interval = setInterval(() => {
      socketRef.current?.emit('get_analytics')
      socketRef.current?.emit('get_alerts')
    }, 5000)

    return () => {
      socketRef.current?.disconnect()
      clearInterval(interval)
    }
  }, [])

  const updateTotalCount = () => {
    const total = cameras.reduce((sum, cam) => sum + (cam.count || 0), 0)
    setTotalCount(total)
  }

  const addCamera = async () => {
    const cameraId = `camera_${Date.now()}`
    const newCamera = {
      id: cameraId,
      name: `Camera ${cameras.length + 1}`,
      isActive: false,
      count: 0,
      detections: [],
      stream: null
    }
    setCameras(prev => [...prev, newCamera])
  }

  const startCamera = async (cameraId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      
      setCameras(prev => prev.map(cam => 
        cam.id === cameraId ? { ...cam, stream, isActive: true } : cam
      ))
      
      camerasRef.current[cameraId] = { stream, isActive: true }
      sendFrames(cameraId, stream)
    } catch (err) {
      console.error('Camera error:', err)
    }
  }

  const sendFrames = (cameraId, stream) => {
    const video = document.createElement('video')
    video.srcObject = stream
    video.play()
    
    video.onloadedmetadata = () => {
      const sendFrame = () => {
        if (!camerasRef.current[cameraId]?.isActive) return
        
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        
        if (canvas.width > 0) {
          ctx.drawImage(video, 0, 0)
          socketRef.current?.emit('video_frame', { 
            camera_id: cameraId,
            frame: canvas.toDataURL('image/jpeg', 0.7) 
          })
        }
        
        if (camerasRef.current[cameraId]?.isActive) {
          setTimeout(sendFrame, 500)
        }
      }
      setTimeout(sendFrame, 500)
    }
  }

  const stopCamera = (cameraId) => {
    const camera = cameras.find(c => c.id === cameraId)
    camera?.stream?.getTracks().forEach(t => t.stop())
    
    setCameras(prev => prev.map(cam => 
      cam.id === cameraId ? { ...cam, isActive: false, count: 0, detections: [] } : cam
    ))
    
    if (camerasRef.current[cameraId]) {
      camerasRef.current[cameraId].isActive = false
    }
  }

  const removeCamera = (cameraId) => {
    stopCamera(cameraId)
    setCameras(prev => prev.filter(cam => cam.id !== cameraId))
    delete camerasRef.current[cameraId]
  }

  return (
    <div className="multi-camera">
      <header className="header">
        <h1>🎥 Multi-Camera Crowd Detection</h1>
        <div className="header-stats">
          <div className="stat-box">
            <span className="stat-value">{totalCount}</span>
            <span className="stat-label">Total Count</span>
          </div>
          <div className="stat-box">
            <span className="stat-value">{cameras.filter(c => c.isActive).length}</span>
            <span className="stat-label">Active Cameras</span>
          </div>
          <div className="stat-box">
            <span className="stat-value">{analytics.peak_hour}:00</span>
            <span className="stat-label">Peak Hour</span>
          </div>
        </div>
        <button className="add-camera-btn" onClick={addCamera}>+ Add Camera</button>
      </header>

      <div className="main-grid">
        <div className="cameras-grid">
          {cameras.map(camera => (
            <CameraView 
              key={camera.id}
              camera={camera}
              threshold={threshold}
              onStart={() => startCamera(camera.id)}
              onStop={() => stopCamera(camera.id)}
              onRemove={() => removeCamera(camera.id)}
            />
          ))}
        </div>

        <div className="sidebar">
          <div className="panel">
            <h2>⚙️ Settings</h2>
            <label>
              Threshold: 
              <input type="number" value={threshold} onChange={(e) => setThreshold(+e.target.value)} min="1" />
            </label>
          </div>

          <div className="panel">
            <h2>📊 Analytics</h2>
            <div className="trend-chart">
              {analytics.trend.slice(-20).map((count, i) => (
                <div key={i} className="bar" style={{ height: `${count * 10}px`, background: count >= threshold ? '#f44' : '#4af' }} />
              ))}
            </div>
          </div>

          <div className="panel alert-panel">
            <h2>🚨 Alerts</h2>
            <div className="alert-list">
              {alertHistory.slice(-10).reverse().map((alert, i) => (
                <div key={i} className={`alert-item ${alert.status.toLowerCase()}`}>
                  <div>{alert.time}</div>
                  <div>{alert.count}/{alert.threshold}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CameraView({ camera, threshold, onStart, onStop, onRemove }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    if (camera.stream && videoRef.current) {
      videoRef.current.srcObject = camera.stream
    }
  }, [camera.stream])

  useEffect(() => {
    if (camera.detections && camera.detections.length > 0) {
      drawDetections()
    }
  }, [camera.detections])

  const drawDetections = () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    canvas.width = video.offsetWidth
    canvas.height = video.offsetHeight
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const scaleX = canvas.width / (video.videoWidth || 640)
    const scaleY = canvas.height / (video.videoHeight || 480)

    camera.detections.forEach((d) => {
      const [x1, y1, x2, y2] = d.bbox
      ctx.strokeStyle = camera.count >= threshold ? '#ff0000' : '#00ff00'
      ctx.lineWidth = 2
      ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2-x1) * scaleX, (y2-y1) * scaleY)
      ctx.fillStyle = camera.count >= threshold ? '#ff0000' : '#00ff00'
      ctx.font = '12px Arial'
      ctx.fillText(`ID:${d.id}`, x1 * scaleX, y1 * scaleY - 5)
    })
  }

  return (
    <div className={`camera-card ${camera.count >= threshold ? 'alert' : ''}`}>
      <div className="camera-header">
        <h3>{camera.name}</h3>
        <div className="camera-controls">
          {!camera.isActive ? (
            <button onClick={onStart}>▶</button>
          ) : (
            <button onClick={onStop}>⏹</button>
          )}
          <button onClick={onRemove} className="remove-btn">✕</button>
        </div>
      </div>
      
      <div className="video-wrapper">
        <video ref={videoRef} autoPlay muted />
        <canvas ref={canvasRef} />
        {camera.isActive && (
          <div className={`count-badge ${camera.count >= threshold ? 'alert' : ''}`}>
            {camera.count}
          </div>
        )}
      </div>
    </div>
  )
}

export default MultiCamera
