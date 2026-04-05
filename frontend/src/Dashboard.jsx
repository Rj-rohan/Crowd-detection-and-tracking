import { useState, useRef, useEffect } from 'react'
import io from 'socket.io-client'
import './Dashboard.css'

function Dashboard() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [sourceType, setSourceType] = useState('camera')
  const [isModelReady, setIsModelReady] = useState(true)
  const [personCount, setPersonCount] = useState(0)
  const [detections, setDetections] = useState([])
  const [density, setDensity] = useState(0)
  const [riskLevel, setRiskLevel] = useState('SAFE')
  const [coverageArea, setCoverageArea] = useState(50)
  const [analytics, setAnalytics] = useState({ 
    hourly: {}, trend: [], peak_hour: 0, avg_count: 0, 
    peak_count: 0, peak_time_range: {}, time_series: [] 
  })
  const [alertHistory, setAlertHistory] = useState([])
  const [dailyReport, setDailyReport] = useState(null)
  const [weeklyReport, setWeeklyReport] = useState([])
  const [location, setLocation] = useState('Unknown')
  const [detailedAddress, setDetailedAddress] = useState('Fetching...')
  const [liveLocationUrl, setLiveLocationUrl] = useState('')
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const heatmapRef = useRef(null)
  const socketRef = useRef(null)
  const streamingRef = useRef(false)

  useEffect(() => {
    streamingRef.current = isStreaming
  }, [isStreaming])

  useEffect(() => {
    socketRef.current = io('http://localhost:5000')
    
    socketRef.current.on('connect', () => {
      console.log('Connected to server')
      socketRef.current.emit('check_model_ready')
    })
    
    socketRef.current.on('model_ready', () => {
      console.log('Model is ready!')
      setIsModelReady(true)
    })
    
    socketRef.current.on('detection_result', (data) => {
      setPersonCount(data.count)
      setDetections(data.detections)
      
      // Calculate density
      const densityValue = data.count / coverageArea
      setDensity(densityValue)
      
      // Determine risk level
      let risk = 'SAFE'
      if (densityValue > 6) risk = 'CRITICAL'
      else if (densityValue > 0.50) risk = 'DANGEROUS'
      else if (densityValue > 0.3) risk = 'CROWDED'
      setRiskLevel(risk)
      
      drawDetections(data.detections)
      drawHeatmap(data.detections)
      checkStampedeRisk(data.count, densityValue, risk)
    })
    
    socketRef.current.on('analytics_data', (data) => {
      setAnalytics(data)
    })
    
    socketRef.current.on('alerts_data', (data) => {
      setAlertHistory(data.alerts)
    })
    
    socketRef.current.on('daily_report', (data) => {
      setDailyReport(data)
    })
    
    socketRef.current.on('weekly_report', (data) => {
      setWeeklyReport(data.reports)
    })

    getLocation()
    const interval = setInterval(() => {
      socketRef.current?.emit('get_analytics')
      socketRef.current?.emit('get_alerts')
      socketRef.current?.emit('get_daily_report')
    }, 5000)

    return () => {
      socketRef.current?.disconnect()
      clearInterval(interval)
    }
  }, [])

  const getLocation = () => {
    navigator.geolocation?.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords
      setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
      setLiveLocationUrl(`https://www.google.com/maps?q=${latitude},${longitude}`)
      
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
      const data = await res.json()
      setDetailedAddress(data.display_name?.substring(0, 60) || 'Unknown')
    })
  }

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    videoRef.current.srcObject = stream
    setIsStreaming(true)
    setSourceType('camera')
    
    videoRef.current.onloadedmetadata = () => {
      setTimeout(() => sendFrame(), 500)
    }
  }

  const uploadFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    if (file.type.startsWith('image/')) {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const video = videoRef.current
        
        canvas.width = img.width
        canvas.height = img.height
        
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        
        // Create image element to display
        const imgElement = document.createElement('img')
        imgElement.src = canvas.toDataURL()
        imgElement.style.width = '100%'
        imgElement.style.height = 'auto'
        
        // Replace video with image
        video.style.display = 'none'
        video.parentElement.insertBefore(imgElement, video)
        video.uploadedImage = imgElement
        
        socketRef.current?.emit('video_frame', { 
          frame: canvas.toDataURL('image/jpeg', 0.95),
          source_type: 'image'
        })
        setIsProcessing(true)
        setSourceType('image')
      }
      img.src = URL.createObjectURL(file)
    } else {
      const video = videoRef.current
      video.src = URL.createObjectURL(file)
      video.style.display = 'block'
      video.onloadedmetadata = () => {
        video.play()
        setIsStreaming(true)
        setSourceType('video')
        setTimeout(() => sendFrame(), 500)
      }
    }
  }

  const sendFrame = () => {
    if (!videoRef.current || (!streamingRef.current && sourceType === 'camera')) return
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = videoRef.current.videoWidth || 640
    canvas.height = videoRef.current.videoHeight || 480
    
    if (canvas.width > 0 && canvas.height > 0) {
      ctx.drawImage(videoRef.current, 0, 0)
      socketRef.current?.emit('video_frame', { 
        frame: canvas.toDataURL('image/jpeg', 0.7),
        source_type: sourceType
      })
    }
    
    if (streamingRef.current || sourceType === 'video') {
      setTimeout(() => sendFrame(), sourceType === 'camera' ? 1500 : 500)
    }
  }

  const stopCamera = () => {
    setIsStreaming(false)
    setIsProcessing(false)
    videoRef.current?.srcObject?.getTracks().forEach(t => t.stop())
    if (videoRef.current?.src) {
      videoRef.current.pause()
      videoRef.current.src = ''
    }
    if (videoRef.current?.uploadedImage) {
      videoRef.current.uploadedImage.remove()
      videoRef.current.uploadedImage = null
      videoRef.current.style.display = 'block'
    }
    setPersonCount(0)
    setDetections([])
    setDensity(0)
    setRiskLevel('SAFE')
    const ctx1 = canvasRef.current?.getContext('2d')
    const ctx2 = heatmapRef.current?.getContext('2d')
    if (ctx1) ctx1.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    if (ctx2) ctx2.clearRect(0, 0, 400, 300)
    
    // Reset backend frame counter
    socketRef.current?.emit('reset_counter')
  }

  const drawDetections = (dets) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    const img = video.uploadedImage
    
    if (!canvas) return
    
    let targetWidth, targetHeight, scaleX, scaleY
    
    if (img) {
      // For uploaded image
      targetWidth = img.offsetWidth
      targetHeight = img.offsetHeight
      canvas.width = targetWidth
      canvas.height = targetHeight
      scaleX = targetWidth / img.naturalWidth
      scaleY = targetHeight / img.naturalHeight
    } else if (video) {
      // For video/camera
      targetWidth = video.offsetWidth
      targetHeight = video.offsetHeight
      canvas.width = targetWidth
      canvas.height = targetHeight
      scaleX = targetWidth / (video.videoWidth || 640)
      scaleY = targetHeight / (video.videoHeight || 480)
    } else {
      return
    }

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    dets.forEach((d) => {
      const [x1, y1, x2, y2] = d.bbox
      const sx1 = x1 * scaleX
      const sy1 = y1 * scaleY
      const sx2 = x2 * scaleX
      const sy2 = y2 * scaleY
      
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 3
      ctx.strokeRect(sx1, sy1, sx2 - sx1, sy2 - sy1)
      
      ctx.fillStyle = '#00ff00'
      ctx.fillRect(sx1, sy1 - 25, 60, 25)
      
      ctx.fillStyle = '#000'
      ctx.font = 'bold 14px Arial'
      ctx.fillText(`ID:${d.id}`, sx1 + 5, sy1 - 8)
    })
  }

  const drawHeatmap = (dets) => {
    const canvas = heatmapRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, 400, 300)
    
    ctx.strokeStyle = '#333'
    for (let i = 0; i <= 400; i += 50) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, 300)
      ctx.stroke()
    }
    for (let i = 0; i <= 300; i += 50) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(400, i)
      ctx.stroke()
    }

    dets.forEach((d) => {
      const [x1, y1, x2, y2] = d.bbox
      const cx = ((x1 + x2) / 2 / 640) * 400
      const cy = ((y1 + y2) / 2 / 480) * 300
      
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30)
      gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)')
      gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.4)')
      gradient.addColorStop(1, 'rgba(255, 200, 0, 0)')
      
      ctx.fillStyle = gradient
      ctx.fillRect(cx - 30, cy - 30, 60, 60)
      
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 12px Arial'
      ctx.fillText(d.id, cx - 5, cy + 4)
    })
  }

  const checkStampedeRisk = (count, densityValue, risk) => {
    if (risk === 'CRITICAL' || risk === 'DANGEROUS') {
      socketRef.current?.emit('stampede_alert', {
        count,
        density: densityValue.toFixed(2),
        risk_level: risk,
        area: coverageArea,
        detections,
        location: { address: detailedAddress, maps_url: liveLocationUrl }
      })
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🎥 Crowd Detection Dashboard</h1>
        <div className="header-stats">
          <div className="stat-box">
            <span className="stat-value">{personCount}</span>
            <span className="stat-label">Live Count</span>
          </div>
          <div className="stat-box" style={{background: riskLevel === 'CRITICAL' ? '#f44336' : riskLevel === 'DANGEROUS' ? '#ff9800' : riskLevel === 'CROWDED' ? '#ffc107' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
            <span className="stat-value">{density.toFixed(2)}</span>
            <span className="stat-label">Density (p/m²)</span>
          </div>
          <div className="stat-box" style={{background: riskLevel === 'CRITICAL' ? '#f44336' : riskLevel === 'DANGEROUS' ? '#ff9800' : riskLevel === 'CROWDED' ? '#ffc107' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
            <span className="stat-value">{riskLevel}</span>
            <span className="stat-label">Risk Level</span>
          </div>
          <div className="stat-box">
            <span className="stat-value">{analytics.peak_hour}:00</span>
            <span className="stat-label">Peak Hour</span>
          </div>
          <div className="stat-box">
            <span className="stat-value">{analytics.peak_count || 0}</span>
            <span className="stat-label">Peak Count</span>
          </div>
          <div className="stat-box">
            <span className="stat-value">{analytics.avg_count?.toFixed(1)}</span>
            <span className="stat-label">Avg Count</span>
          </div>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="panel live-feed">
          <h2>📹 Live Camera Feed</h2>
          <div className="controls">
            <button onClick={startCamera} disabled={isStreaming || isProcessing || !isModelReady}>
              {!isModelReady ? '⏳ Loading Model...' : '▶ Start Camera'}
            </button>
            <button onClick={stopCamera} disabled={!isStreaming && !isProcessing}>⏹ Stop</button>
            <label className="upload-btn">
              📁 Upload Image/Video
              <input type="file" accept="image/*,video/*" onChange={uploadFile} style={{display: 'none'}} disabled={!isModelReady} />
            </label>
            <label>Coverage Area (m²): 
              <input type="number" value={coverageArea} onChange={(e) => setCoverageArea(+e.target.value)} min="10" max="500" />
            </label>
          </div>
          <div className="video-wrapper">
            <video ref={videoRef} autoPlay muted />
            <canvas ref={canvasRef} />
          </div>
          <div className="location-info">
            <p>📍 {detailedAddress}</p>
            {liveLocationUrl && <a href={liveLocationUrl} target="_blank">View Map</a>}
          </div>
        </div>

        <div className="panel analytics">
          <h2>📊 Analytics Panel</h2>
          
          <div className="chart-section">
            <h3>📈 Live Crowd Trend</h3>
            <div className="simple-line-chart">
              <svg width="100%" height="150" viewBox="0 0 400 150">
                <defs>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{stopColor: '#667eea', stopOpacity: 1}} />
                    <stop offset="100%" style={{stopColor: '#764ba2', stopOpacity: 1}} />
                  </linearGradient>
                </defs>
                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map(i => (
                  <line key={i} x1="0" y1={i * 30} x2="400" y2={i * 30} stroke="#eee" strokeWidth="1" />
                ))}
                {/* Line chart */}
                <polyline
                  fill="none"
                  stroke="url(#lineGradient)"
                  strokeWidth="3"
                  points={analytics.trend.map((count, i) => {
                    const x = (i / (analytics.trend.length - 1)) * 400
                    const y = 140 - (count * 8)
                    return `${x},${y}`
                  }).join(' ')}
                />
                {/* Data points */}
                {analytics.trend.map((count, i) => {
                  const x = (i / (analytics.trend.length - 1)) * 400
                  const y = 140 - (count * 8)
                  return (
                    <circle key={i} cx={x} cy={y} r="4" fill={count / coverageArea > 4 ? '#f44' : '#667eea'} />
                  )
                })}
              </svg>
              <div className="chart-labels">
                <span>⬅️ Past</span>
                <span className="current-label">Current: {personCount} people</span>
                <span>Now ➡️</span>
              </div>
            </div>
          </div>

          <div className="chart-section">
            <h3>🕐 Hourly Crowd Pattern (Today)</h3>
            <div className="hourly-bars">
              {Object.entries(analytics.hourly).sort((a, b) => a[0] - b[0]).map(([hour, avg]) => (
                <div key={hour} className="hour-item">
                  <div className="hour-label">{hour}:00</div>
                  <div className="hour-bar-container">
                    <div 
                      className="hour-bar-fill" 
                      style={{ width: `${(avg / 15) * 100}%` }}
                    >
                      <span className="bar-value">{Math.round(avg)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="chart-section">
            <h3>⏰ Peak Time Detection</h3>
            <div className="peak-time-box">
              <div className="peak-info">
                <strong>Peak Time:</strong> {analytics.peak_time_range?.start} - {analytics.peak_time_range?.end}
              </div>
              <div className="peak-info">
                <strong>Average Count:</strong> {analytics.peak_time_range?.avg} people
              </div>
            </div>
          </div>

          <div className="chart-section">
            <h3>📋 Daily Report</h3>
            {dailyReport && (
              <div className="daily-report-box">
                <div className="report-row">
                  <span>Date:</span>
                  <strong>{dailyReport.date}</strong>
                </div>
                <div className="report-row">
                  <span>Peak Crowd:</span>
                  <strong>{dailyReport.peak_crowd} people</strong>
                </div>
                <div className="report-row">
                  <span>Average Crowd:</span>
                  <strong>{dailyReport.avg_crowd} people</strong>
                </div>
                <div className="report-row">
                  <span>Total Alerts:</span>
                  <strong className="alert-count">{dailyReport.total_alerts}</strong>
                </div>
              </div>
            )}
            <button className="report-btn" onClick={() => socketRef.current?.emit('get_weekly_report')}>📊 View Weekly Report</button>
          </div>

          {weeklyReport.length > 0 && (
            <div className="chart-section">
              <h3>📅 Weekly Summary</h3>
              <div className="weekly-grid">
                {weeklyReport.map((day, i) => (
                  <div key={i} className="week-day">
                    <div className="day-date">{day.date.substring(5)}</div>
                    <div className="day-stat">Peak: {day.peak_crowd}</div>
                    <div className="day-stat">Avg: {day.avg_crowd}</div>
                    <div className="day-stat alert-stat">Alerts: {day.total_alerts}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="chart-section">
            <h3>Crowd Trends (Last 50 frames)</h3>
            <div className="trend-chart">
              {analytics.trend.map((count, i) => (
                <div key={i} className="bar" style={{ height: `${count * 10}px`, background: count / coverageArea > 4 ? '#f44' : '#4af' }} />
              ))}
            </div>
          </div>

          <div className="chart-section">
            <h3>Peak Hours</h3>
            <div className="hourly-chart">
              {Object.entries(analytics.hourly).map(([hour, avg]) => (
                <div key={hour} className="hour-bar">
                  <div className="bar-fill" style={{ width: `${(avg / 10) * 100}%` }} />
                  <span>{hour}:00 - {avg.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="chart-section">
            <h3>🗺️ Heatmap</h3>
            <canvas ref={heatmapRef} width="400" height="300" />
          </div>
        </div>

        <div className="panel alert-history">
          <h2>🚨 Alert History</h2>
          <div className="alert-table">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Location</th>
                  <th>Count</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {alertHistory.slice().reverse().map((alert, i) => (
                  <tr key={i} className={alert.status.toLowerCase()}>
                    <td>{alert.time}</td>
                    <td>{alert.location}</td>
                    <td>{alert.count} ({alert.density} p/m²)</td>
                    <td><span className={`badge ${alert.status.toLowerCase()}`}>{alert.status}</span></td>
                    <td>{alert.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
