# Docker Commands - Quick Reference

## 🎯 DockerHub Info
- **Username**: `rjrohan`
- **Backend Image**: `rjrohan/crowd-detection-backend:latest`
- **Frontend Image**: `rjrohan/crowd-detection-frontend:latest`

---

## 🚀 Complete Deployment (Copy & Paste)

### Option 1: Using Batch Script (Windows)
```cmd
docker-deploy.bat
```
Then select option **11** for complete build and push.

### Option 2: Manual Commands

```bash
# 1. Login to DockerHub
docker login
# Username: rjrohan
# Password: [enter your password]

# 2. Build Backend
cd backend
docker build -t rjrohan/crowd-detection-backend:latest .
cd ..

# 3. Build Frontend
cd frontend
docker build -t rjrohan/crowd-detection-frontend:latest .
cd ..

# 4. Push Backend
docker push rjrohan/crowd-detection-backend:latest

# 5. Push Frontend
docker push rjrohan/crowd-detection-frontend:latest

# 6. Verify on DockerHub
# Visit: https://hub.docker.com/u/rjrohan
```

---

## 📦 Build Commands

### Build Backend Only
```bash
cd backend
docker build -t rjrohan/crowd-detection-backend:latest .
cd ..
```

### Build Frontend Only
```bash
cd frontend
docker build -t rjrohan/crowd-detection-frontend:latest .
cd ..
```

### Build Both with Docker Compose
```bash
docker-compose build
```

### Build with No Cache (Fresh Build)
```bash
docker-compose build --no-cache
```

---

## 📤 Push Commands

### Push Backend
```bash
docker push rjrohan/crowd-detection-backend:latest
```

### Push Frontend
```bash
docker push rjrohan/crowd-detection-frontend:latest
```

### Push Both
```bash
docker push rjrohan/crowd-detection-backend:latest && docker push rjrohan/crowd-detection-frontend:latest
```

---

## ▶️ Run Commands

### Start All Services
```bash
docker-compose up -d
```

### Start with Build
```bash
docker-compose up -d --build
```

### View Logs
```bash
docker-compose logs -f
```

### Stop All Services
```bash
docker-compose down
```

---

## 🔍 Verification Commands

### Check Images
```bash
docker images | findstr rjrohan
```

### Check Running Containers
```bash
docker ps
```

### Check Container Logs
```bash
docker logs crowd-detection-backend
docker logs crowd-detection-frontend
docker logs crowd-detection-mongodb
```

### Test Services
```bash
# Test backend
curl http://localhost:5000

# Test frontend
curl http://localhost:80

# Open in browser
start http://localhost
```

---

## 🧹 Cleanup Commands

### Stop Services
```bash
docker-compose stop
```

### Remove Containers
```bash
docker-compose down
```

### Remove with Volumes
```bash
docker-compose down -v
```

### Remove Images
```bash
docker rmi rjrohan/crowd-detection-backend:latest
docker rmi rjrohan/crowd-detection-frontend:latest
```

---

## 📋 Step-by-Step Checklist

- [ ] 1. Login to DockerHub (`docker login`)
- [ ] 2. Build backend image
- [ ] 3. Build frontend image
- [ ] 4. Test locally with docker-compose
- [ ] 5. Push backend to DockerHub
- [ ] 6. Push frontend to DockerHub
- [ ] 7. Verify images on DockerHub website
- [ ] 8. Test pulling and running on another machine

---

## 🌐 After Pushing to DockerHub

Anyone can now pull and run your images:

```bash
# Pull images
docker pull rjrohan/crowd-detection-backend:latest
docker pull rjrohan/crowd-detection-frontend:latest

# Run with docker-compose
docker-compose up -d
```

---

## 📊 Image Sizes (Approximate)

- **Backend**: ~2.5 GB (PyTorch + YOLO model)
- **Frontend**: ~50 MB (Nginx + React build)
- **MongoDB**: ~700 MB (Official image)

**Total**: ~3.25 GB

---

## ⚡ Quick Start for New Users

1. **Clone repository**
```bash
git clone https://github.com/yourusername/crowd-detection.git
cd crowd-detection
```

2. **Create .env file**
```bash
copy .env.example .env
```

3. **Run**
```bash
docker-compose up -d
```

4. **Access**
- Frontend: http://localhost
- Backend: http://localhost:5000

---

## 🎯 Production Deployment

### On AWS/Azure/GCP Server

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone and run
git clone https://github.com/yourusername/crowd-detection.git
cd crowd-detection
docker-compose up -d
```

---

## 📞 Support

If you encounter issues:
1. Check logs: `docker-compose logs -f`
2. Verify images: `docker images`
3. Check containers: `docker ps -a`
4. Restart: `docker-compose restart`

---

## ✅ Success Indicators

After deployment, you should see:
- ✅ 3 containers running (backend, frontend, mongodb)
- ✅ Frontend accessible at http://localhost
- ✅ Backend responding at http://localhost:5000
- ✅ Camera detection working in real-time
- ✅ Images visible on DockerHub

**Your images will be public at:**
- https://hub.docker.com/r/rjrohan/crowd-detection-backend
- https://hub.docker.com/r/rjrohan/crowd-detection-frontend
