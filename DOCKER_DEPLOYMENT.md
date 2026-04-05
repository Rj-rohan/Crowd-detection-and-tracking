# Docker Deployment Guide

## 📦 DockerHub Repository
**Username**: `rjrohan`

**Images**:
- `rjrohan/crowd-detection-backend:latest`
- `rjrohan/crowd-detection-frontend:latest`

---

## 🚀 Quick Start Commands

### Step 1: Login to DockerHub
```bash
docker login
# Username: rjrohan
# Password: [your-dockerhub-password]
```

### Step 2: Build Images
```bash
# Build backend
cd backend
docker build -t rjrohan/crowd-detection-backend:latest .
cd ..

# Build frontend
cd frontend
docker build -t rjrohan/crowd-detection-frontend:latest .
cd ..
```

### Step 3: Push to DockerHub
```bash
# Push backend
docker push rjrohan/crowd-detection-backend:latest

# Push frontend
docker push rjrohan/crowd-detection-frontend:latest
```

### Step 4: Run with Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

---

## 📋 Detailed Commands

### Build Commands

#### Backend
```bash
cd backend
docker build -t rjrohan/crowd-detection-backend:latest .
docker build -t rjrohan/crowd-detection-backend:v1.0 .
cd ..
```

#### Frontend
```bash
cd frontend
docker build -t rjrohan/crowd-detection-frontend:latest .
docker build -t rjrohan/crowd-detection-frontend:v1.0 .
cd ..
```

#### Build All at Once
```bash
docker-compose build
```

---

### Push Commands

#### Push Backend
```bash
docker push rjrohan/crowd-detection-backend:latest
docker push rjrohan/crowd-detection-backend:v1.0
```

#### Frontend
```bash
docker push rjrohan/crowd-detection-frontend:latest
docker push rjrohan/crowd-detection-frontend:v1.0
```

#### Tag and Push
```bash
# Tag with version
docker tag rjrohan/crowd-detection-backend:latest rjrohan/crowd-detection-backend:v1.0
docker tag rjrohan/crowd-detection-frontend:latest rjrohan/crowd-detection-frontend:v1.0

# Push all tags
docker push rjrohan/crowd-detection-backend --all-tags
docker push rjrohan/crowd-detection-frontend --all-tags
```

---

### Run Commands

#### Using Docker Compose (Recommended)
```bash
# Start all services
docker-compose up -d

# Start with build
docker-compose up -d --build

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb

# Stop services
docker-compose stop

# Remove containers
docker-compose down

# Remove with volumes
docker-compose down -v
```

#### Using Docker Run (Manual)
```bash
# Create network
docker network create crowd-network

# Run MongoDB
docker run -d \
  --name crowd-mongodb \
  --network crowd-network \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=changeme123 \
  -v mongodb_data:/data/db \
  mongo:6.0

# Run Backend
docker run -d \
  --name crowd-backend \
  --network crowd-network \
  -p 5000:5000 \
  -e MONGO_URI=mongodb://admin:changeme123@crowd-mongodb:27017/crowd_detection?authSource=admin \
  -v $(pwd)/backend/yolov8x.pt:/app/yolov8x.pt:ro \
  rjrohan/crowd-detection-backend:latest

# Run Frontend
docker run -d \
  --name crowd-frontend \
  --network crowd-network \
  -p 80:80 \
  rjrohan/crowd-detection-frontend:latest
```

---

## 🔍 Verification Commands

### Check Running Containers
```bash
docker ps
docker-compose ps
```

### Check Images
```bash
docker images | grep rjrohan
```

### Check Logs
```bash
# All logs
docker-compose logs

# Specific service
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mongodb

# Follow logs
docker-compose logs -f backend
```

### Health Checks
```bash
# Backend health
curl http://localhost:5000

# Frontend health
curl http://localhost:80

# MongoDB health
docker exec crowd-detection-mongodb mongosh --eval "db.adminCommand('ping')"
```

---

## 🧹 Cleanup Commands

### Stop and Remove
```bash
# Stop all
docker-compose stop

# Remove containers
docker-compose down

# Remove with volumes
docker-compose down -v

# Remove images
docker rmi rjrohan/crowd-detection-backend:latest
docker rmi rjrohan/crowd-detection-frontend:latest
```

### Prune System
```bash
# Remove unused containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a
```

---

## 📊 Image Information

### Backend Image
- **Base**: `python:3.11-slim`
- **Size**: ~2.5 GB (with PyTorch + YOLO)
- **Port**: 5000
- **Health Check**: HTTP ping

### Frontend Image
- **Base**: `nginx:alpine`
- **Size**: ~50 MB (multi-stage build)
- **Port**: 80
- **Health Check**: HTTP wget

### MongoDB Image
- **Base**: `mongo:6.0`
- **Size**: ~700 MB
- **Port**: 27017
- **Health Check**: mongosh ping

---

## 🌐 Access URLs

After deployment:
- **Frontend**: http://localhost
- **Backend API**: http://localhost:5000
- **MongoDB**: mongodb://localhost:27017

---

## 🔐 Environment Variables

Create `.env` file in root:
```env
# MongoDB
MONGO_PASSWORD=your_secure_password

# Twilio (Optional)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WHATSAPP_TO=whatsapp:+1234567890
```

---

## 🚀 Production Deployment

### On Cloud Server (AWS/Azure/GCP)

1. **Install Docker**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

2. **Install Docker Compose**
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

3. **Clone Repository**
```bash
git clone https://github.com/yourusername/crowd-detection.git
cd crowd-detection
```

4. **Configure Environment**
```bash
cp .env.example .env
nano .env  # Edit with your values
```

5. **Deploy**
```bash
docker-compose up -d
```

6. **Monitor**
```bash
docker-compose logs -f
```

---

## 📝 Troubleshooting

### Backend Not Starting
```bash
# Check logs
docker logs crowd-detection-backend

# Check if YOLO model exists
docker exec crowd-detection-backend ls -lh /app/yolov8x.pt

# Restart
docker-compose restart backend
```

### Frontend Not Loading
```bash
# Check nginx config
docker exec crowd-detection-frontend nginx -t

# Check logs
docker logs crowd-detection-frontend

# Restart
docker-compose restart frontend
```

### MongoDB Connection Issues
```bash
# Check MongoDB status
docker exec crowd-detection-mongodb mongosh --eval "db.adminCommand('ping')"

# Check connection string
docker exec crowd-detection-backend env | grep MONGO_URI

# Restart
docker-compose restart mongodb
```

---

## 🎯 Next Steps

1. ✅ Build images locally
2. ✅ Test with docker-compose
3. ✅ Push to DockerHub
4. ✅ Deploy on production server
5. ✅ Configure domain and SSL
6. ✅ Set up monitoring
7. ✅ Configure backups

---

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [DockerHub](https://hub.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
