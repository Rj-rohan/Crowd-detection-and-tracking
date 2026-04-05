# Project Structure

```
Crowd/
├── backend/                    # Flask API + YOLO Detection
│   ├── app.py                 # Main application
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile            # Backend container config
│   ├── .dockerignore         # Docker ignore rules
│   ├── .env                  # Environment variables
│   └── yolov8x.pt           # YOLO model (accurate)
│
├── frontend/                  # React + Vite UI
│   ├── src/
│   │   ├── App.jsx           # Main app component
│   │   ├── Dashboard.jsx     # Analytics dashboard
│   │   └── MultiCamera.jsx   # Multi-source detection
│   ├── Dockerfile            # Frontend container config
│   ├── nginx.conf            # Nginx configuration
│   ├── package.json          # Node dependencies
│   └── vite.config.js        # Vite configuration
│
├── mongodb/                   # Database initialization
│   └── init-mongo.js         # MongoDB setup script
│
├── scripts/                   # Utility scripts
│   ├── backup-db.sh          # Database backup
│   └── restore-db.sh         # Database restore
│
├── docker-compose.yml         # Multi-container orchestration
├── .env                       # Root environment variables
├── .env.example              # Environment template
├── README.md                 # Project documentation
└── DEPLOYMENT.md             # Deployment guide
```

## Key Files

- **docker-compose.yml**: Orchestrates MongoDB, Backend, and Frontend
- **backend/app.py**: Flask + SocketIO + YOLO detection logic
- **frontend/src/App.jsx**: Main UI with camera/image/video detection
- **mongodb/init-mongo.js**: Database initialization with collections

## Quick Start

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker logs crowd-detection-backend
docker logs crowd-detection-frontend
docker logs crowd-detection-mongodb
```
