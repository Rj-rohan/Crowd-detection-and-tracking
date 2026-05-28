import { useState, useRef, useEffect } from 'react'
import './Dashboard.css'

function Dashboard() {
  const [personCount, setPersonCount]     = useState(0)  // kept for report generation
  const [behaviour, setBehaviour]         = useState({ label: 'UNKNOWN', conf: 0 })
  const [videoMode, setVideoMode]          = useState(false)
  const [videoStatus, setVideoStatus]      = useState('')
  const [detections, setDetections]       = useState([])  // kept for report generation
  const [riskLevel]                       = useState('CLEAR')  // display via DOM ref
  const [analytics, setAnalytics]         = useState({ hourly:{}, trend:[], peak_hour:0, avg_count:0, peak_count:0, peak_time_range:{} })
  const [alertHistory, setAlertHistory]   = useState([])
  const [dailyReport, setDailyReport]     = useState(null)
  const [weeklyReport, setWeeklyReport]   = useState([])
  const [detailedAddress, setDetailedAddress] = useState('Locating...')
  const [liveLocationUrl, setLiveLocationUrl] = useState('')
  const [connected, setConnected]         = useState(false)
  const [whatsappStatus, setWhatsappStatus] = useState('')
  const [time, setTime]                   = useState(new Date().toLocaleTimeString())
  const [threshold, setThreshold]         = useState(10)
  const [paused, setPaused]               = useState(false)
  const [cameraOn, setCameraOn]            = useState(false)

  const canvasRef    = useRef(null)
  const overlayRef   = useRef(null)
  const heatmapRef   = useRef(null)
  const videoWsRef   = useRef(null)
  const fileInputRef = useRef(null)
  const cameraWsRef  = useRef(null)
  const dataWsRef    = useRef(null)
  const pausedRef    = useRef(false)
  const cameraOnRef  = useRef(false)
  const fpsRef       = useRef({ count: 0, last: performance.now() })
  const thresholdRef       = useRef(10)
  const lastAlertSentRef   = useRef(0)
  const detailedAddressRef = useRef('Locating...')
  const liveLocationUrlRef = useRef('')
  // Live value refs for report generation (updated every frame)
  const liveCountRef      = useRef(0)
  const liveDetectionsRef = useRef([])
  const liveBehaviourRef  = useRef({ label: 'UNKNOWN', conf: 0 })
  // DOM refs for per-frame updates (avoids React re-renders)
  const countDomRef  = useRef(null)  // trend chart footer
  const countStatRef  = useRef(null)  // stat bar count
  const fpsDomRef    = useRef(null)
  const riskDomRef   = useRef(null)
  const riskDom2Ref  = useRef(null)  // stat bar risk
  const riskBarRef   = useRef(null)
  const riskCountRef = useRef(null)
  const detListRef   = useRef(null)
  const detHeaderRef = useRef(null)

  useEffect(() => { thresholdRef.current = threshold }, [threshold])
  useEffect(() => { cameraOnRef.current = cameraOn }, [cameraOn])
  useEffect(() => { detailedAddressRef.current = detailedAddress }, [detailedAddress])
  useEffect(() => { liveLocationUrlRef.current = liveLocationUrl }, [liveLocationUrl])

  useEffect(() => {
    const tick = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)
    connectData()
    getLocation()
    return () => {
      clearInterval(tick)
      cameraWsRef.current?.close()
      dataWsRef.current?.close()
    }
  }, [])

  // ── Camera WebSocket ──────────────────────────────────────────────────────
  const startCamera = () => {
    setCameraOn(true)
    connectCamera()
  }

  const stopCamera = () => {
    setCameraOn(false)
    cameraWsRef.current?.close()
    cameraWsRef.current = null
    setConnected(false)
    if (fpsDomRef.current) fpsDomRef.current.textContent = 'OFFLINE'
  }

  const connectCamera = () => {
    const ws = new WebSocket('ws://localhost:5000/ws')
    cameraWsRef.current = ws

    ws.onopen  = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      // only auto-reconnect if camera is still supposed to be on
      if (cameraOnRef.current) setTimeout(connectCamera, 3000)
    }
    ws.onerror = () => setConnected(false)

    ws.onmessage = (e) => {
      if (pausedRef.current) return
      const data = JSON.parse(e.data)

      // FPS counter
      fpsRef.current.count++
      const now = performance.now()
      if (now - fpsRef.current.last >= 1000) {
        const f = fpsRef.current.count
        if (fpsDomRef.current) fpsDomRef.current.textContent = `LIVE · ${f} FPS`
        fpsRef.current.count = 0
        fpsRef.current.last  = now
      }

      const dets  = data.detections || []
      const count = data.count || 0

      // ── Keep live refs in sync for report generation ──
      liveCountRef.current      = count
      liveDetectionsRef.current = dets

      // ── Direct DOM updates (no React re-render) ──
      if (countDomRef.current)  countDomRef.current.textContent  = count
      if (countStatRef.current) countStatRef.current.textContent = count
      if (detHeaderRef.current) detHeaderRef.current.textContent = `👥 Active Detections (${count})`

      const r = count === 0 ? 'CLEAR'
        : count < thresholdRef.current * 0.4  ? 'LOW'
        : count < thresholdRef.current * 0.75 ? 'MEDIUM'
        : count < thresholdRef.current        ? 'HIGH' : 'CRITICAL'
      const rc = { CLEAR:'#00e5ff', LOW:'#00ff88', MEDIUM:'#ffaa00', HIGH:'#ff6600', CRITICAL:'#ff3c3c' }[r]
      const pct = { CLEAR:0, LOW:20, MEDIUM:50, HIGH:75, CRITICAL:100 }[r]
      if (riskDomRef.current)  { riskDomRef.current.textContent = r; riskDomRef.current.style.color = rc }
      if (riskDom2Ref.current)  { riskDom2Ref.current.textContent = r; riskDom2Ref.current.style.color = rc }
      if (riskBarRef.current)  { riskBarRef.current.style.width = pct+'%'; riskBarRef.current.style.background = rc }
      if (riskCountRef.current) riskCountRef.current.textContent = `${count} / ${thresholdRef.current} threshold`

      // Update detection list directly
      if (detListRef.current) {
        detListRef.current.innerHTML = dets.length === 0
          ? '<div class="dno-data">No detections</div>'
          : dets.map(d => `<div class="ddet-row"><span class="ddet-id">ID ${d.id}</span><div class="ddet-bar-wrap"><div class="ddet-bar" style="width:${d.conf*100}%"></div></div><span class="ddet-pct">${(d.conf*100).toFixed(0)}%</span></div>`).join('')
      }

      // Behaviour update — only update if not UNKNOWN
      if (data.behaviour && data.behaviour !== 'UNKNOWN') {
        const b = { label: data.behaviour, conf: data.behaviour_conf || 0 }
        setBehaviour(b)
        liveBehaviourRef.current = b
      }

      // Draw frame
      const img = new Image()
      img.onload = () => {
        const c = canvasRef.current
        if (!c) return
        c.width  = img.naturalWidth
        c.height = img.naturalHeight
        c.getContext('2d').drawImage(img, 0, 0)
        drawOverlay(dets, img.naturalWidth, img.naturalHeight)
        drawHeatmap(dets, img.naturalWidth, img.naturalHeight)
      }
      img.src = `data:image/jpeg;base64,${data.frame}`

      // Auto alert
      if (count >= thresholdRef.current) {
        const now = Date.now()
        const status = count >= thresholdRef.current * 1.5 ? 'CRITICAL' : 'ALERT'
        // Always add to local alert history for immediate UI feedback
        setAlertHistory(prev => {
          if (prev[0]?.time === new Date().toLocaleTimeString()) return prev
          return [{
            time:     new Date().toLocaleTimeString(),
            count,
            location: 'Live Camera',
            status,
            action:   'Auto detected'
          }, ...prev.slice(0, 29)]
        })
        // Send WhatsApp only once per 60s (frontend cooldown)
        if (now - lastAlertSentRef.current >= 60000) {
          lastAlertSentRef.current = now
          console.log('[ALERT] Sending threshold_alert to backend, count=', count)
          console.log('[ALERT] dataWsRef state=', dataWsRef.current?.readyState)
          const payload = JSON.stringify({
            action:    'threshold_alert',
            count,
            threshold: thresholdRef.current,
            address:   detailedAddressRef.current,
            maps_url:  liveLocationUrlRef.current
          })
          if (dataWsRef.current?.readyState === WebSocket.OPEN) {
            dataWsRef.current.send(payload)
            console.log('[ALERT] Sent successfully')
          } else {
            console.log('[ALERT] dataWs not open, state=', dataWsRef.current?.readyState)
          }
        }
      }
    }
  }

  // ── Data WebSocket ────────────────────────────────────────────────────────
  const connectData = () => {
    const ws = new WebSocket('ws://localhost:5000/ws/data')
    dataWsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'get_analytics' }))
      ws.send(JSON.stringify({ action: 'get_daily' }))
      ws.send(JSON.stringify({ action: 'get_alerts' }))
    }

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'analytics') setAnalytics(msg.data)
      if (msg.type === 'daily')     setDailyReport(msg.data)
      if (msg.type === 'weekly')    setWeeklyReport(msg.data)
      if (msg.type === 'alerts')    setAlertHistory(msg.data)
      if (msg.type === 'alert_sent' || msg.type === 'stampede_sent') {
        setWhatsappStatus(msg.success ? '🚨 WhatsApp alert sent!' : '❌ Alert failed')
        setTimeout(() => setWhatsappStatus(''), 5000)
      }
      if (msg.type === 'report_sent') {
        setWhatsappStatus(msg.success ? '✅ Report sent to WhatsApp!' : '❌ Report failed')
        setTimeout(() => setWhatsappStatus(''), 5000)
      }
    }

    ws.onclose = () => setTimeout(connectData, 3000)

    // Poll every 5s
    const iv = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'get_analytics' }))
        ws.send(JSON.stringify({ action: 'get_daily' }))
        ws.send(JSON.stringify({ action: 'get_alerts' }))
      }
    }, 5000)

    // store interval so we can clear it on close
    ws.addEventListener('close', () => clearInterval(iv))
  }

  // ── Draw overlay (bboxes) ─────────────────────────────────────────────────
  const drawOverlay = (dets, W, H) => {
    const ov = overlayRef.current
    if (!ov) return
    ov.width = W; ov.height = H
    const ctx = ov.getContext('2d')
    ctx.clearRect(0, 0, W, H)
    dets.forEach(d => {
      const { x, y, w, h, id } = d
      ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2
      ctx.strokeRect(x, y, w, h)
      const cs = 14; ctx.lineWidth = 3
      ;[[x,y,cs,cs],[x+w,y,-cs,cs],[x,y+h,cs,-cs],[x+w,y+h,-cs,-cs]].forEach(([bx,by,dx,dy]) => {
        ctx.beginPath(); ctx.moveTo(bx+dx, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by+dy); ctx.stroke()
      })
      ctx.fillStyle = 'rgba(0,229,255,0.92)'; ctx.fillRect(x, y > 24 ? y-24 : y+2, 60, 20)
      ctx.fillStyle = '#000'; ctx.font = 'bold 12px monospace'
      ctx.fillText(`ID ${id}`, x+4, y > 24 ? y-8 : y+16)
    })
  }

  // ── Draw heatmap canvas ───────────────────────────────────────────────────
  const drawHeatmap = (dets, W, H) => {
    const canvas = heatmapRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#0a0e1a'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1a2035'; ctx.lineWidth = 1
    for (let i = 0; i < canvas.width; i += 40)  { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke() }
    for (let i = 0; i < canvas.height; i += 30) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke() }
    dets.forEach(d => {
      const cx = (d.x + d.w/2) / W * canvas.width
      const cy = (d.y + d.h/2) / H * canvas.height
      const g = ctx.createRadialGradient(cx,cy,0,cx,cy,32)
      g.addColorStop(0,'rgba(255,60,60,0.9)'); g.addColorStop(0.5,'rgba(255,120,0,0.4)'); g.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx,cy,32,0,Math.PI*2); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace'; ctx.fillText(d.id, cx-4, cy+4)
    })
  }

  const getLocation = () => {
    navigator.geolocation?.getCurrentPosition(async ({ coords: { latitude: lat, longitude: lon } }) => {
      setLiveLocationUrl(`https://www.google.com/maps?q=${lat},${lon}`)
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1&accept-language=en`, { headers: { 'User-Agent': 'CrowdApp/1.0' } })
        if (r.ok) {
          const d = await r.json(), a = d.address
          setDetailedAddress([a.road, a.town||a.city, a.state, a.country].filter(Boolean).join(', ') || d.display_name)
        }
      } catch { setDetailedAddress(`${lat.toFixed(4)}, ${lon.toFixed(4)}`) }
    }, () => setDetailedAddress('Location unavailable'))
  }

  const handleVideoUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setVideoMode(true)
    setVideoStatus('Uploading...')

    // Stop live camera, don't auto-reconnect
    cameraOnRef.current = false
    cameraWsRef.current?.close()
    cameraWsRef.current = null
    videoWsRef.current?.close()

    const ws = new WebSocket('ws://localhost:5000/ws/video')
    videoWsRef.current = ws

    ws.onopen = () => {
      setVideoStatus('Processing...')
      file.arrayBuffer().then(buf => ws.send(buf))
    }
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.done) { setVideoStatus('Done ✅'); return }

      const dets  = data.detections || []
      const count = data.count || 0

      liveCountRef.current      = count
      liveDetectionsRef.current = dets
      if (countDomRef.current)  countDomRef.current.textContent  = count
      if (countStatRef.current) countStatRef.current.textContent = count
      if (detHeaderRef.current) detHeaderRef.current.textContent = `👥 Active Detections (${count})`
      if (fpsDomRef.current)    fpsDomRef.current.textContent    = `VIDEO · ${count} people`
      if (data.behaviour && data.behaviour !== 'UNKNOWN') {
        const b = { label: data.behaviour, conf: data.behaviour_conf || 0 }
        setBehaviour(b)
        liveBehaviourRef.current = b
      }

      const r = count === 0 ? 'CLEAR'
        : count < thresholdRef.current * 0.4  ? 'LOW'
        : count < thresholdRef.current * 0.75 ? 'MEDIUM'
        : count < thresholdRef.current        ? 'HIGH' : 'CRITICAL'
      const rc = { CLEAR:'#00e5ff', LOW:'#00ff88', MEDIUM:'#ffaa00', HIGH:'#ff6600', CRITICAL:'#ff3c3c' }[r]
      const pct = { CLEAR:0, LOW:20, MEDIUM:50, HIGH:75, CRITICAL:100 }[r]
      if (riskDomRef.current)   { riskDomRef.current.textContent = r; riskDomRef.current.style.color = rc }
      if (riskDom2Ref.current)  { riskDom2Ref.current.textContent = r; riskDom2Ref.current.style.color = rc }
      if (riskBarRef.current)   { riskBarRef.current.style.width = pct+'%'; riskBarRef.current.style.background = rc }
      if (riskCountRef.current)  riskCountRef.current.textContent = `${count} / ${thresholdRef.current} threshold`

      if (detListRef.current) {
        detListRef.current.innerHTML = dets.length === 0
          ? '<div class="dno-data">No detections</div>'
          : dets.map(d => `<div class="ddet-row"><span class="ddet-id">ID ${d.id}</span><div class="ddet-bar-wrap"><div class="ddet-bar" style="width:${d.conf*100}%"></div></div><span class="ddet-pct">${(d.conf*100).toFixed(0)}%</span></div>`).join('')
      }

      const img = new Image()
      img.onload = () => {
        const c = canvasRef.current
        if (!c) return
        c.width = img.naturalWidth; c.height = img.naturalHeight
        c.getContext('2d').drawImage(img, 0, 0)
        drawOverlay(dets, img.naturalWidth, img.naturalHeight)
        drawHeatmap(dets, img.naturalWidth, img.naturalHeight)
      }
      img.src = `data:image/jpeg;base64,${data.frame}`

      // Auto alert for video mode
      if (count >= thresholdRef.current) {
        const now = Date.now()
        const status = count >= thresholdRef.current * 1.5 ? 'CRITICAL' : 'ALERT'
        setAlertHistory(prev => {
          if (prev[0]?.time === new Date().toLocaleTimeString()) return prev
          return [{
            time:     new Date().toLocaleTimeString(),
            count,
            location: 'Video Upload',
            status,
            action:   'Auto detected'
          }, ...prev.slice(0, 29)]
        })
        if (now - lastAlertSentRef.current >= 60000) {
          lastAlertSentRef.current = now
          if (dataWsRef.current?.readyState === WebSocket.OPEN) {
            dataWsRef.current.send(JSON.stringify({
              action:    'threshold_alert',
              count,
              threshold: thresholdRef.current,
              address:   detailedAddressRef.current,
              maps_url:  liveLocationUrlRef.current
            }))
          }
        }
      }
    }
    ws.onclose = () => { setVideoStatus(v => v === 'Processing...' ? 'Stopped' : v) }
    // reset file input so same file can be re-uploaded
    e.target.value = ''
  }

  const stopVideo = () => {
    videoWsRef.current?.close()
    videoWsRef.current = null
    setVideoMode(false)
    setVideoStatus('')
    setBehaviour({ label: 'UNKNOWN', conf: 0 })
    if (fpsDomRef.current) fpsDomRef.current.textContent = cameraOn ? 'LIVE · 0 FPS' : 'OFFLINE'
    if (cameraOn) connectCamera()
  }

  const togglePause = () => {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
  }

  const generateReport = () => {
    // Use live refs — these always have the current frame values
    const count   = liveCountRef.current
    const dets    = liveDetectionsRef.current
    const beh     = liveBehaviourRef.current

    // Merge frame + overlay into one snapshot canvas
    const frameCanvas   = canvasRef.current
    const overlayCanvas = overlayRef.current
    let snap = null
    if (frameCanvas && frameCanvas.width > 0) {
      const merged = document.createElement('canvas')
      merged.width  = frameCanvas.width
      merged.height = frameCanvas.height
      const mctx = merged.getContext('2d')
      mctx.drawImage(frameCanvas, 0, 0)
      if (overlayCanvas) mctx.drawImage(overlayCanvas, 0, 0)
      snap = merged.toDataURL('image/jpeg', 0.9)
    }

    const isAlert = count >= thresholdRef.current
    const detRows = dets.map(d =>
      `<div class="det-row"><span class="det-id">ID ${d.id}</span><span class="det-conf">${(d.conf*100).toFixed(0)}% confidence</span></div>`
    ).join('')

    const html = `<!DOCTYPE html><html><head><title>Crowd Report</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0d1117;color:#e0e6f0;font-family:'Segoe UI',sans-serif;padding:24px}.card{background:#111827;border:1px solid #1e2a3a;border-radius:12px;padding:20px;margin-bottom:16px}h1{color:#00e5ff;font-size:22px;margin-bottom:4px}.sub{color:#6b7280;font-size:13px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1e2a3a;font-size:13px}.row:last-child{border-bottom:none}.row span{color:#6b7280}.alert-box{border:1px solid #ff3c3c;background:#1a0a0a;border-radius:8px;padding:12px;color:#ff6b6b}.ok-box{border:1px solid #00e5ff;background:#0a1a1a;border-radius:8px;padding:12px;color:#00e5ff}img{width:100%;border-radius:8px;margin-top:12px}a{color:#00e5ff}.det-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1e2a3a;font-size:12px}.det-row:last-child{border-bottom:none}.det-id{color:#00e5ff;font-weight:700;font-family:monospace}.det-conf{color:#6b7280}</style></head><body><div class="card"><h1>👁️ CrowdVision AI Report</h1><p class="sub">${new Date().toLocaleString()}</p></div><div class="card"><div class="row"><span>YOLO Count</span><b style="color:#00e5ff">${count}</b></div><div class="row"><span>Behaviour</span><b style="color:${beh.label==='NORMAL'?'#00ff88':'#ff3c3c'}">${beh.label} (${(beh.conf*100).toFixed(1)}%)</b></div><div class="row"><span>Threshold</span><b>${thresholdRef.current}</b></div><div class="row"><span>Address</span><b>${detailedAddress}</b></div><div class="row"><span>Location</span><a href="${liveLocationUrl}" target="_blank">View on Maps</a></div></div><div class="card">${isAlert?'<div class="alert-box">🚨 THRESHOLD EXCEEDED</div>':'<div class="ok-box">✅ Normal Density</div>'}</div>${dets.length>0?`<div class="card"><h3 style="margin-bottom:12px;color:#8b949e">👥 Detected Persons (${count})</h3>${detRows}</div>`:''} ${snap?`<div class="card"><h3 style="margin-bottom:8px;color:#8b949e">📹 Camera Snapshot (with detections)</h3><img src="${snap}"/></div>`:''}</body></html>`

    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    a.download = `crowd-report-${Date.now()}.html`
    a.click()
    dataWsRef.current?.send(JSON.stringify({
      action: 'send_report',
      report: { timestamp: new Date().toLocaleString(), detailedAddress, liveLocationUrl, densityCount: count, threshold: thresholdRef.current }
    }))
  }

  const getWeekly = () => {
    dataWsRef.current?.send(JSON.stringify({ action: 'get_weekly' }))
  }
  const riskColors = { CLEAR:'#00e5ff', LOW:'#00ff88', MEDIUM:'#ffaa00', HIGH:'#ff6600', CRITICAL:'#ff3c3c' }
  const riskPct    = { CLEAR:0, LOW:20, MEDIUM:50, HIGH:75, CRITICAL:100 }
  const rc = riskColors[riskLevel] || '#00e5ff'
  const maxTrend   = Math.max(...(analytics.trend||[1]), 1)
  const maxHourly  = Math.max(...Object.values(analytics.hourly||{0:1}), 1)

  return (
    <div className="dash">

      {/* NAV */}
      <nav className="dnav">
        <div className="dnav-brand"><span>👁️</span><span className="dnav-brand-text">CrowdVision <span className="dnav-ai">AI</span></span></div>
        <div className="dnav-mid">
          <div className="dlive" ref={fpsDomRef}>{cameraOn ? 'LIVE · 0 FPS' : videoMode ? 'VIDEO' : 'OFFLINE'}</div>
        </div>
        <div className="dnav-right">
          <div className={`dconn ${connected?'dconn-on':'dconn-off'}`}><span className="dconn-dot"/>{connected?'Online':'Connecting...'}</div>
          <span className="dtime">{time}</span>
        </div>
      </nav>

      {/* STAT BAR */}
      <div className="dstats">
        {[
          { label:'YOLO Count',  val: <span ref={countStatRef}>0</span>, color: '#00e5ff' },
          { label:'Behaviour',   val: <span style={{color: behaviour.label==='NORMAL'?'#00ff88':behaviour.label==='ABNORMAL'?'#ff3c3c':'#888'}}>{behaviour.label}</span>, color: null },
          { label:'Risk Level',  val: <span ref={riskDom2Ref} style={{color:'#00e5ff'}}>CLEAR</span>, color: null },
          { label:'Peak Hour',   val: `${analytics.peak_hour}:00`,        color:'#00e5ff' },
          { label:'Peak Count',  val: analytics.peak_count||0,            color:'#ffaa00' },
          { label:'Avg Count',   val: (analytics.avg_count||0).toFixed(1),color:'#00ff88' },
        ].map(s => (
          <div key={s.label} className="dstat">
            <div className="dstat-val" style={s.color ? {color:s.color} : {}}>{s.val}</div>
            <div className="dstat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* GRID */}
      <div className="dgrid">

        {/* LEFT */}
        <div className="dcol-left">

          {/* Camera */}
          <div className="dvideo-card">
            <div className="dvideo-header">
              <span>{videoMode ? '🎬 Video Analysis' : '📹 Live Camera Feed'}</span>
              <div className="dvideo-tags">
                <span className="dtag dtag-gray">YOLO11n + UCN</span>
                {videoMode && <span className="dtag dtag-red">{videoStatus}</span>}
                {cameraOn && !videoMode && (
                  <button className={`dtag ${paused?'dtag-red':'dtag-gray'}`} onClick={togglePause} style={{cursor:'pointer',border:'none',background:'none',color:'inherit',font:'inherit'}}>
                    {paused ? '▶ Resume' : '⏸ Pause'}
                  </button>
                )}
              </div>
            </div>
            <div className="dvideo-wrap">
              {/* Frame canvas */}
              <canvas ref={canvasRef} className="dframe-canvas" />
              {/* Bbox overlay */}
              <canvas ref={overlayRef} className="dcanvas" />
              {!cameraOn && !videoMode && (
                <div className="dvideo-idle">
                  <div className="didle-icon">📷</div>
                  <p>Camera is off</p>
                  <p style={{fontSize:'12px',marginTop:'8px',color:'#444'}}>Click "Start Camera" to begin live detection</p>
                </div>
              )}
            </div>
            <div className="dvideo-footer">
              <span>Confidence: 0.40</span>
              <span>Behaviour: <span style={{color: behaviour.label==='NORMAL'?'#00ff88':behaviour.label==='ABNORMAL'?'#ff3c3c':'#888'}}>{behaviour.label}</span></span>
              <span>UCN: {(behaviour.conf*100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Risk */}
          <div className="drisk-card">
            <div className="drisk-top">
              <span className="drisk-label">Risk Level</span>
              <span className="drisk-val" ref={riskDomRef} style={{color:'#00e5ff'}}>CLEAR</span>
            </div>
            <div className="drisk-track"><div className="drisk-fill" ref={riskBarRef} style={{width:'0%',background:'#00e5ff'}}/></div>
            <div className="drisk-counts" ref={riskCountRef}>0 / {threshold} threshold</div>
          </div>

          {/* Analytics */}
          <div className="danalytics-row">
            <div className="dpanel">
              <div className="dpanel-hd">📈 Live Trend</div>
              <div className="dchart-body">
                <svg width="100%" height="160" viewBox="0 0 400 160" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.35"/>
                      <stop offset="100%" stopColor="#00e5ff" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  {analytics.trend?.length > 1 && <>
                    <polygon fill="url(#tg)" points={analytics.trend.map((c,i)=>`${(i/(analytics.trend.length-1))*400},${150-(c/maxTrend)*140}`).join(' ')+` 400,150 0,150`}/>
                    <polyline fill="none" stroke="#00e5ff" strokeWidth="2.5"
                      points={analytics.trend.map((c,i)=>`${(i/(analytics.trend.length-1))*400},${150-(c/maxTrend)*140}`).join(' ')}/>
                  </>}
                </svg>
                <div className="dchart-foot">
                  <span>← Past</span>
                  <span style={{color:'#00e5ff',fontWeight:700}}>Now: <span ref={countDomRef}>0</span></span>
                  <span>Now →</span>
                </div>
              </div>
            </div>

            <div className="dpanel">
              <div className="dpanel-hd">🕐 Hourly Pattern</div>
              <div className="dhourly">
                {Object.entries(analytics.hourly||{}).sort((a,b)=>+a[0]-+b[0]).map(([h,avg])=>(
                  <div key={h} className="dhour-row">
                    <span className="dhour-lbl">{h}:00</span>
                    <div className="dhour-track"><div className="dhour-fill" style={{width:`${(avg/maxHourly)*100}%`}}/></div>
                    <span className="dhour-val">{Math.round(avg)}</span>
                  </div>
                ))}
                {!Object.keys(analytics.hourly||{}).length && <div className="dno-data">No data yet</div>}
              </div>
            </div>
          </div>

          {/* Peak + Daily */}
          <div className="dpanel-row">
            <div className="dpanel dpanel-half">
              <div className="dpanel-hd">⏰ Peak Time</div>
              <div className="dpeak">
                <div className="dpeak-time">{analytics.peak_time_range?.start||'--'} – {analytics.peak_time_range?.end||'--'}</div>
                <div className="dpeak-avg">Avg: {analytics.peak_time_range?.avg||0} people</div>
              </div>
            </div>
            <div className="dpanel dpanel-half">
              <div className="dpanel-hd">📋 Today</div>
              {dailyReport
                ? <div className="ddaily">
                    <div className="ddaily-row"><span>Peak</span><b>{dailyReport.peak_crowd}</b></div>
                    <div className="ddaily-row"><span>Avg</span><b>{dailyReport.avg_crowd}</b></div>
                    <div className="ddaily-row"><span>Alerts</span><b style={{color:'#ff3c3c'}}>{dailyReport.total_alerts}</b></div>
                  </div>
                : <div className="dno-data">Loading...</div>}
            </div>
          </div>

          {/* Heatmap canvas */}
          <div className="dpanel">
            <div className="dpanel-hd">🗺️ Detection Heatmap</div>
            <canvas ref={heatmapRef} width="800" height="300" className="dhmap-canvas"/>
          </div>

          {/* Weekly Report */}
          {weeklyReport.length > 0 && (
            <div className="dpanel">
              <div className="dpanel-hd">📅 Weekly Summary</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'8px',padding:'14px'}}>
                {weeklyReport.map((d,i) => (
                  <div key={i} style={{background:'var(--bg3)',borderRadius:'8px',padding:'10px',textAlign:'center',border:'1px solid var(--border)'}}>
                    <div style={{fontSize:'10px',color:'var(--cyan)',fontWeight:700,marginBottom:'6px'}}>{d.date?.slice(5)}</div>
                    <div style={{fontSize:'11px',color:'var(--text2)'}}>Peak: <b style={{color:'var(--text)'}}>{d.peak_crowd}</b></div>
                    <div style={{fontSize:'11px',color:'var(--text2)'}}>Avg: <b style={{color:'var(--text)'}}>{d.avg_crowd}</b></div>
                    <div style={{fontSize:'11px',color:'var(--red)'}}>Alerts: <b>{d.total_alerts}</b></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Behaviour Panel */}
          <div className="dpanel">
            <div className="dpanel-hd">🧠 Behaviour Analysis (UCN Model)</div>
            <div style={{padding:'16px',textAlign:'center'}}>
              <div style={{fontSize:'32px',fontWeight:700,color:behaviour.label==='NORMAL'?'#00ff88':behaviour.label==='ABNORMAL'?'#ff3c3c':'#888',marginBottom:'8px'}}>
                {behaviour.label==='NORMAL'?'✅':behaviour.label==='ABNORMAL'?'🚨':'❓'} {behaviour.label}
              </div>
              <div style={{color:'#6b7280',fontSize:'13px'}}>Confidence: {(behaviour.conf*100).toFixed(1)}%</div>
              <div style={{marginTop:'12px',background:'#1a2035',borderRadius:'8px',height:'8px',overflow:'hidden'}}>
                <div style={{height:'100%',width:`${behaviour.conf*100}%`,background:behaviour.label==='NORMAL'?'#00ff88':'#ff3c3c',transition:'width 0.3s'}}/>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="dcol-right">

          {/* Controls */}
          <div className="dcontrols">
            <div className="dthresh">
              <span>Alert Threshold</span>
              <input type="number" value={threshold} min="1" max="500"
                onChange={e=>setThreshold(parseInt(e.target.value)||1)}/>
            </div>
            {!cameraOn && !videoMode && <button className="dbtn dbtn-start" onClick={startCamera}>📷 Start Camera</button>}
            {cameraOn  && !videoMode && <button className="dbtn" style={{background:'#2a1a1a',color:'#ff3c3c',border:'1px solid #ff3c3c'}} onClick={stopCamera}>⏹ Stop Camera</button>}
            <button className="dbtn dbtn-start" onClick={generateReport}>📄 Report</button>
            <button className="dbtn dbtn-upload" onClick={getWeekly}>📅 Weekly</button>
            {!videoMode && <button className="dbtn" style={{background:'#1a2a4a',color:'#00e5ff',border:'1px solid #00e5ff'}} onClick={() => fileInputRef.current?.click()}>🎬 Upload Video</button>}
            <input ref={fileInputRef} type="file" accept="video/*" style={{display:'none'}} onChange={handleVideoUpload}/>
            {videoMode && <button className="dbtn" style={{background:'#2a1a1a',color:'#ff3c3c',border:'1px solid #ff3c3c'}} onClick={stopVideo}>⏹ Stop Video</button>}
            {whatsappStatus && <span className="dwa">{whatsappStatus}</span>}
          </div>

          {/* Location */}
          <div className="dloc">
            <span className="dloc-icon">📍</span>
            <div className="dloc-text">
              <div className="dloc-addr">{detailedAddress}</div>
              {liveLocationUrl && <a href={liveLocationUrl} target="_blank" rel="noopener noreferrer" className="dloc-link">View on Google Maps →</a>}
            </div>
            <button className="dloc-btn" onClick={getLocation}>↻</button>
          </div>

          <div className="dpanel">
            <div className="dpanel-hd" ref={detHeaderRef}>👥 Active Detections (0)</div>
            <div className="ddet-list" ref={detListRef}>
              <div className="dno-data">No detections</div>
            </div>
          </div>

          {/* Alerts */}
          <div className="dpanel dpanel-grow">
            <div className="dpanel-hd">🚨 Alert History</div>
            <div className="dalert-list">
              {alertHistory.length===0
                ? <div className="dno-data">No alerts yet</div>
                : alertHistory.slice(0,30).map((a,i)=>(
                  <div key={i} className={`dalert-row dalert-${a.status?.toLowerCase()}`}>
                    <div className="dalert-top">
                      <span className="dalert-time">{a.time}</span>
                      <span className={`dalert-badge dalert-badge-${a.status?.toLowerCase()}`}>{a.status}</span>
                    </div>
                    <div className="dalert-info">{a.count} people · {a.location}</div>
                  </div>
                ))
              }
            </div>
          </div>

          {/* System */}
          <div className="dpanel">
            <div className="dpanel-hd">⚙️ System Info</div>
            {[
              ['Detection',  'YOLO11n'],
              ['Behaviour',  'UCN Model'],
              ['Dataset',    'UCN (Normal/Abnormal)'],
              ['Confidence', '0.40'],
              ['Threshold',  threshold],
            ].map(([k,v])=>(
              <div key={k} className="dsys-row"><span className="dsys-k">{k}</span><span className="dsys-v">{v}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
