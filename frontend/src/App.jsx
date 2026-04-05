import { useState, useRef, useEffect } from 'react'
import io from 'socket.io-client'
import './App.css'

function App() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [personCount, setPersonCount] = useState(0)
  const [status, setStatus] = useState('Not connected')
  const [detections, setDetections] = useState([])
  const [threshold, setThreshold] = useState(5)
  const [alerts, setAlerts] = useState([])
  const [reports, setReports] = useState([])
  const [location, setLocation] = useState('Unknown Location')
  const [detailedAddress, setDetailedAddress] = useState('Fetching address...')
  const [liveLocationUrl, setLiveLocationUrl] = useState('')
  const [whatsappStatus, setWhatsappStatus] = useState('')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const crowdMapRef = useRef(null)
  const socketRef = useRef(null)

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io('http://localhost:5000')
    
    socketRef.current.on('connect', () => {
      setStatus('Connected to server')
      console.log('Connected!')
    })
    
    socketRef.current.on('detection_result', (data) => {
      console.log('Detection result:', data)
      setPersonCount(data.count)
      setDetections(data.detections)
      setStatus(`Detected ${data.count} persons`)
      drawDetections(data.detections)
      drawCrowdMap(data.detections)
      checkThreshold(data.count)
    })
    
    socketRef.current.on('report_sent', (data) => {
      if (data.success) {
        console.log('WhatsApp report sent successfully')
        if (data.type === 'manual_report') {
          setWhatsappStatus('✅ Manual report sent to WhatsApp!')
        } else {
          setWhatsappStatus('✅ Report sent to WhatsApp!')
        }
        setTimeout(() => setWhatsappStatus(''), 5000)
      } else {
        console.error('Failed to send WhatsApp report:', data.error)
        setWhatsappStatus('❌ Failed to send WhatsApp report')
        setTimeout(() => setWhatsappStatus(''), 5000)
      }
    })
    
    socketRef.current.on('alert_sent', (data) => {
      if (data.success) {
        if (data.type === 'auto_report') {
          setWhatsappStatus(`🚨 Auto-report sent! Count: ${data.count}/${data.threshold}`)
        } else {
          setWhatsappStatus('🚨 Alert sent to WhatsApp!')
        }
        setTimeout(() => setWhatsappStatus(''), 8000)
      } else {
        setWhatsappStatus('❌ Failed to send WhatsApp alert')
        setTimeout(() => setWhatsappStatus(''), 5000)
      }
    })

    // Get location
    getLocationWithPermission()

    return () => socketRef.current?.disconnect()
  }, [])
  
  const getLocationWithPermission = () => {
    if (!navigator.geolocation) {
      setLocation('Geolocation not supported')
      setDetailedAddress('Geolocation not supported')
      return
    }
    
    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords
        console.log(`Location accuracy: ${accuracy} meters`)
        
        setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
        setLiveLocationUrl(`https://www.google.com/maps?q=${latitude},${longitude}`)
        
        await getDetailedAddress(latitude, longitude)
      },
      (error) => {
        console.log('Location error:', error.message)
        setLocation('Location access failed')
        setDetailedAddress(`Error: ${error.message}`)
      },
      options
    )
  }
  
  const getDetailedAddress = async (lat, lon) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1&accept-language=en`,
        {
          headers: {
            'User-Agent': 'CrowdDetectionApp/1.0'
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        const addr = data.address
        
        const addressParts = [
          addr.house_number,
          addr.road,
          addr.hamlet || addr.village,
          addr.town || addr.city,
          addr.county,
          addr.state,
          addr.postcode,
          addr.country
        ].filter(Boolean)
        
        const formattedAddress = addressParts.join(', ')
        setDetailedAddress(formattedAddress || data.display_name)
        
        console.log('Address components:', addr)
      } else {
        setDetailedAddress(`Coordinates: ${lat.toFixed(6)}, ${lon.toFixed(6)}`)
      }
    } catch (error) {
      console.log('Geocoding error:', error)
      setDetailedAddress(`Location: ${lat.toFixed(6)}, ${lon.toFixed(6)}`)
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } 
      })
      videoRef.current.srcObject = stream
      setIsStreaming(true)
      setStatus('🎥 Camera started - Real-time detection active')
      
      // Wait for video to be ready, then start continuous detection
      videoRef.current.onloadedmetadata = () => {
        console.log('Camera ready, starting real-time detection...')
        startRealTimeDetection()
      }
      
    } catch (err) {
      setStatus('Camera error: ' + err.message)
    }
  }

  const startRealTimeDetection = () => {
    const video = videoRef.current
    if (!video || !isStreaming) return
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    // Capture and send frames continuously
    const captureFrame = () => {
      if (!isStreaming || !video.srcObject) {
        console.log('Detection stopped')
        return
      }
      
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      ctx.drawImage(video, 0, 0)
      
      const frameData = canvas.toDataURL('image/jpeg', 0.7)
      socketRef.current?.emit('video_frame', { 
        frame: frameData,
        source_type: 'camera'
      })
      
      setStatus(`🔴 LIVE - Detecting... (${personCount} people)`)
      
      // Continue capturing at ~10 FPS for real-time detection
      setTimeout(captureFrame, 100)
    }
    
    // Start the continuous loop
    captureFrame()
  }

  const drawDetections = (detections) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    canvas.width = video.offsetWidth
    canvas.height = video.offsetHeight
    
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const scaleX = canvas.width / (video.videoWidth || 640)
    const scaleY = canvas.height / (video.videoHeight || 480)

    detections.forEach((detection) => {
      const [x1, y1, x2, y2] = detection.bbox
      
      const sx1 = x1 * scaleX
      const sy1 = y1 * scaleY
      const sx2 = x2 * scaleX
      const sy2 = y2 * scaleY
      
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 3
      ctx.strokeRect(sx1, sy1, sx2 - sx1, sy2 - sy1)
      
      ctx.fillStyle = '#00ff00'
      ctx.fillRect(sx1, sy1 - 30, 80, 25)
      
      ctx.fillStyle = '#000000'
      ctx.font = 'bold 16px Arial'
      ctx.fillText(`ID: ${detection.id}`, sx1 + 5, sy1 - 10)
    })
  }

  const checkThreshold = (count) => {
    if (count >= threshold) {
      const alert = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        count: count,
        threshold: threshold,
        message: `High crowd density detected: ${count} people (threshold: ${threshold})`
      }
      setAlerts(prev => [alert, ...prev.slice(0, 4)])
      
      // Send WhatsApp report automatically
      setWhatsappStatus('📤 Sending automatic WhatsApp report...')
      socketRef.current?.emit('threshold_alert', {
        count: count,
        threshold: threshold,
        detections: detections,
        location: {
          address: detailedAddress,
          maps_url: liveLocationUrl
        }
      })
    }
  }

  const generateReport = () => {
    const canvas = crowdMapRef.current
    const snapshot = canvas ? canvas.toDataURL() : null
    
    const report = {
      id: Date.now(),
      timestamp: new Date().toLocaleString(),
      location: location,
      detailedAddress: detailedAddress,
      liveLocationUrl: liveLocationUrl,
      densityCount: personCount,
      threshold: threshold,
      snapshot: snapshot,
      detections: detections.length
    }
    
    setReports(prev => [report, ...prev.slice(0, 9)])
    generatePDF(report)
    
    // Send manual report via WhatsApp
    setWhatsappStatus('📤 Sending manual report to WhatsApp...')
    socketRef.current?.emit('send_report', {
      report: report
    })
  }
  
  const generatePDF = (report) => {
    const video = videoRef.current
    const cameraCanvas = document.createElement('canvas')
    const cameraCtx = cameraCanvas.getContext('2d')
    
    if (video) {
      cameraCanvas.width = video.videoWidth || 640
      cameraCanvas.height = video.videoHeight || 480
      cameraCtx.drawImage(video, 0, 0)
      
      const scaleX = cameraCanvas.width / 640
      const scaleY = cameraCanvas.height / 480
      
      detections.forEach((detection) => {
        const [x1, y1, x2, y2] = detection.bbox
        const sx1 = x1 * scaleX
        const sy1 = y1 * scaleY
        const sx2 = x2 * scaleX
        const sy2 = y2 * scaleY
        
        cameraCtx.strokeStyle = '#00ff00'
        cameraCtx.lineWidth = 3
        cameraCtx.strokeRect(sx1, sy1, sx2 - sx1, sy2 - sy1)
        
        cameraCtx.fillStyle = '#00ff00'
        cameraCtx.font = 'bold 16px Arial'
        cameraCtx.fillText(`ID: ${detection.id}`, sx1, sy1 - 10)
      })
    }
    
    const cameraSnapshot = video ? cameraCanvas.toDataURL() : null
    const densitySnapshot = report.snapshot
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Crowd Detection Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
          .info { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .alert { background: #ffebee; border: 2px solid #f44336; padding: 10px; margin: 10px 0; }
          .images { display: flex; gap: 20px; justify-content: center; margin: 20px 0; }
          .image-container { text-align: center; }
          img { max-width: 400px; border: 2px solid #ccc; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎥 CROWD DETECTION REPORT</h1>
        </div>
        
        <div class="info">
          <h3>📊 Report Details</h3>
          <p><strong>Timestamp:</strong> ${report.timestamp}</p>
          <p><strong>GPS Coordinates:</strong> ${report.location}</p>
          <p><strong>Address:</strong> ${report.detailedAddress}</p>
          <p><strong>Live Location:</strong> <a href="${report.liveLocationUrl}" target="_blank" style="color: #007bff; text-decoration: none;">🗺️ Track This Location</a></p>
          <p><strong>People Count:</strong> ${report.densityCount}</p>
          <p><strong>Threshold:</strong> ${report.threshold}</p>
          <p><strong>Individual IDs:</strong> ${detections.map(d => d.id).join(', ')}</p>
        </div>
        
        ${report.densityCount >= report.threshold ? 
          '<div class="alert"><h3>🚨 ALERT: THRESHOLD EXCEEDED</h3><p>High crowd density detected!</p></div>' : 
          '<div style="background: #d4edda; padding: 10px; border: 2px solid #28a745;"><h3>✅ Normal Density</h3></div>'
        }
        
        <div class="images">
          ${cameraSnapshot ? `
            <div class="image-container">
              <h3>📹 Camera View</h3>
              <img src="${cameraSnapshot}" alt="Camera Snapshot" />
            </div>
          ` : ''}
          
          ${densitySnapshot ? `
            <div class="image-container">
              <h3>🗺️ Crowd Density Map</h3>
              <img src="${densitySnapshot}" alt="Density Map" />
            </div>
          ` : ''}
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #666;">
          <p>Generated by Crowd Detection System</p>
        </div>
      </body>
      </html>
    `
    
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `crowd-report-${Date.now()}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    alert('📄 Report with images downloaded successfully!')
  }

  const drawCrowdMap = (detections) => {
    const canvas = crowdMapRef.current
    if (!canvas || !detections || detections.length === 0) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 320, 240)
    
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 1
    for (let i = 0; i <= 320; i += 40) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, 240)
      ctx.stroke()
    }
    for (let i = 0; i <= 240; i += 30) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(320, i)
      ctx.stroke()
    }
    
    ctx.strokeStyle = detections.length >= threshold ? '#ff0000' : '#333'
    ctx.lineWidth = detections.length >= threshold ? 4 : 2
    ctx.strokeRect(0, 0, 320, 240)
    
    detections.forEach((detection) => {
      if (!detection.bbox || detection.bbox.length !== 4) return
      
      const [x1, y1, x2, y2] = detection.bbox
      
      // Validate coordinates
      if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return
      
      const centerX = (x1 + x2) / 2
      const centerY = (y1 + y2) / 2
      
      const mapX = (centerX / 640) * 320
      const mapY = (centerY / 480) * 240
      
      // Validate map coordinates
      if (isNaN(mapX) || isNaN(mapY)) return
      
      ctx.fillStyle = detections.length >= threshold ? '#ff0000' : '#ff6600'
      ctx.beginPath()
      ctx.arc(mapX, mapY, 8, 0, 2 * Math.PI)
      ctx.fill()
      
      ctx.fillStyle = '#000'
      ctx.font = '12px Arial'
      ctx.fillText(detection.id.toString(), mapX - 5, mapY + 4)
    })
    
    ctx.fillStyle = detections.length >= threshold ? '#ff0000' : '#333'
    ctx.font = 'bold 14px Arial'
    ctx.fillText('Crowd Density Map', 10, 20)
    
    if (detections.length >= threshold) {
      ctx.fillStyle = '#ff0000'
      ctx.font = 'bold 12px Arial'
      ctx.fillText(`ALERT: ${detections.length}/${threshold}`, 10, 230)
    }
  }

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject
    stream?.getTracks().forEach(track => track.stop())
    setIsStreaming(false)
    setPersonCount(0)
    setDetections([])
    setStatus('⏸️ Camera stopped - Detection inactive')
    
    // Clear canvases
    const canvas = canvasRef.current
    const crowdCanvas = crowdMapRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    if (crowdCanvas) {
      const ctx = crowdCanvas.getContext('2d')
      ctx.clearRect(0, 0, 320, 240)
    }
    
    // Reset socket to stop receiving detections
    socketRef.current?.emit('reset_counter')
  }

  return (
    <div className="app">
      <h1>Crowd Detection Test</h1>
      
      <div className="controls">
        <button onClick={startCamera} disabled={isStreaming}>
          Start Camera
        </button>
        <button onClick={stopCamera} disabled={!isStreaming}>
          Stop Camera
        </button>
      </div>

      <div className={`stats ${isStreaming ? 'live' : ''}`}>
        <h2>
          {isStreaming && <span className="live-indicator"></span>}
          Status: {status}
        </h2>
        <h2>People Count: {personCount}</h2>
        <div className="location-info">
          <div><strong>GPS:</strong> {location}</div>
          <div><strong>Address:</strong> {detailedAddress}</div>
          {liveLocationUrl && (
            <div>
              <a href={liveLocationUrl} target="_blank" rel="noopener noreferrer" style={{color: '#007bff', textDecoration: 'none'}}>
                🗺️ View on Google Maps
              </a>
            </div>
          )}
        </div>
        
        {whatsappStatus && (
          <div className="whatsapp-status">
            {whatsappStatus}
          </div>
        )}
        <div className="threshold-control">
          <label>Threshold: </label>
          <input 
            type="number" 
            value={threshold} 
            onChange={(e) => setThreshold(parseInt(e.target.value) || 1)}
            min="1" 
            max="50"
          />
          <button onClick={generateReport}>📄 Generate Report with Images</button>
          <button onClick={getLocationWithPermission} style={{marginLeft: '10px', padding: '8px 15px', background: '#17a2b8', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer'}}>
            📍 Refresh Location
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="alerts">
          <h3>🚨 Alerts</h3>
          {alerts.map(alert => (
            <div key={alert.id} className="alert">
              {alert.timestamp}: {alert.message}
            </div>
          ))}
        </div>
      )}

      {reports.length > 0 && (
        <div className="reports">
          <h3>📊 Reports</h3>
          {reports.slice(0, 3).map(report => (
            <div key={report.id} className="report">
              <strong>{report.timestamp}</strong> - {report.location}: {report.densityCount} people
            </div>
          ))}
        </div>
      )}

      <div className="video-container">
        <video ref={videoRef} autoPlay muted width="640" height="480" />
        <canvas ref={canvasRef} />
      </div>
      
      <div className="crowd-map">
        <h3>Crowd Density Map</h3>
        <canvas 
          ref={crowdMapRef} 
          width="320" 
          height="240"
          style={{border: '2px solid red', background: 'lightblue'}}
        />
      </div>
    </div>
  )
}

export default App