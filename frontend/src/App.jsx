import { useState, useRef, useEffect } from 'react'
import io from 'socket.io-client'
import './App.css'

function App() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [personCount, setPersonCount] = useState(0)
  const [status, setStatus] = useState('Not connected')
  const [detections, setDetections] = useState([])
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const crowdMapRef = useRef(null)
  const socketRef = useRef(null)

  useEffect(() => {
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
    })

    return () => socketRef.current?.disconnect()
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      videoRef.current.srcObject = stream
      setIsStreaming(true)
      setStatus('Camera started')
      
      // Simple test - send one frame after 3 seconds
      setTimeout(() => {
        sendTestFrame()
      }, 3000)
      
    } catch (err) {
      setStatus('Camera error: ' + err.message)
    }
  }

  const sendTestFrame = () => {
    const video = videoRef.current
    if (!video) return
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    ctx.drawImage(video, 0, 0)
    
    const frameData = canvas.toDataURL('image/jpeg', 0.8)
    socketRef.current?.emit('video_frame', { frame: frameData })
    
    setStatus('Frame sent to server')
    console.log('Test frame sent!')
    
    // Send another frame in 3 seconds
    setTimeout(sendTestFrame, 3000)
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
      
      // Draw green bounding box
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 3
      ctx.strokeRect(sx1, sy1, sx2 - sx1, sy2 - sy1)
      
      // Draw ID label with background
      ctx.fillStyle = '#00ff00'
      ctx.fillRect(sx1, sy1 - 30, 80, 25)
      
      ctx.fillStyle = '#000000'
      ctx.font = 'bold 16px Arial'
      ctx.fillText(`ID: ${detection.id}`, sx1 + 5, sy1 - 10)
    })
  }

  const drawCrowdMap = (detections) => {
    const canvas = crowdMapRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 320, 240)
    
    // Draw background grid
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
    
    // Draw border
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, 320, 240)
    
    // Draw person dots
    detections.forEach((detection) => {
      const [x1, y1, x2, y2] = detection.bbox
      const centerX = (x1 + x2) / 2
      const centerY = (y1 + y2) / 2
      
      // Scale to map size (640x480 -> 320x240)
      const mapX = (centerX / 640) * 320
      const mapY = (centerY / 480) * 240
      
      // Draw person dot
      ctx.fillStyle = '#ff0000'
      ctx.beginPath()
      ctx.arc(mapX, mapY, 8, 0, 2 * Math.PI)
      ctx.fill()
      
      // Draw ID
      ctx.fillStyle = '#000'
      ctx.font = '12px Arial'
      ctx.fillText(detection.id.toString(), mapX - 5, mapY + 4)
    })
    
    // Add labels
    ctx.fillStyle = '#333'
    ctx.font = 'bold 14px Arial'
    ctx.fillText('Crowd Density Map', 10, 20)
  }

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject
    stream?.getTracks().forEach(track => track.stop())
    setIsStreaming(false)
    setPersonCount(0)
    setDetections([])
    setStatus('Camera stopped')
    
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

      <div className="stats">
        <h2>Status: {status}</h2>
        <h2>People Count: {personCount}</h2>
      </div>



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