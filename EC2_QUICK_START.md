# EC2 Deployment - Quick Commands

## 🚀 One-Command Deployment

Copy and paste this entire block after connecting to EC2:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh && \
sudo sh get-docker.sh && \
sudo usermod -aG docker ubuntu && \
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && \
sudo chmod +x /usr/local/bin/docker-compose && \
echo "Docker installed! Please logout and login again."
```

After logout/login:

```bash
# Create and deploy application
mkdir -p ~/crowd-detection && cd ~/crowd-detection && \
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: crowd-mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: SecurePassword123!
      MONGO_INITDB_DATABASE: crowd_detection
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    networks:
      - crowd-network

  backend:
    image: rjrohan/crowd-detection-backend:latest
    container_name: crowd-backend
    restart: unless-stopped
    environment:
      - MONGO_URI=mongodb://admin:SecurePassword123!@mongodb:27017/crowd_detection?authSource=admin
      - FLASK_ENV=production
    ports:
      - "5000:5000"
    depends_on:
      - mongodb
    networks:
      - crowd-network

  frontend:
    image: rjrohan/crowd-detection-frontend:latest
    container_name: crowd-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - crowd-network

networks:
  crowd-network:
    driver: bridge

volumes:
  mongodb_data:
EOF

docker-compose up -d && \
echo "Deployment complete! Access at http://$(curl -s ifconfig.me)"
```

---

## 📋 Step-by-Step Commands

### 1. Connect to EC2
```bash
ssh -i crowd-detection-key.pem ubuntu@YOUR_EC2_IP
```

### 2. Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
```

### 3. Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 4. Logout and Login
```bash
exit
ssh -i crowd-detection-key.pem ubuntu@YOUR_EC2_IP
```

### 5. Create Project
```bash
mkdir -p ~/crowd-detection
cd ~/crowd-detection
```

### 6. Create docker-compose.yml
```bash
nano docker-compose.yml
# Paste the docker-compose content
# Save: Ctrl+X, Y, Enter
```

### 7. Deploy
```bash
docker-compose up -d
```

### 8. Check Status
```bash
docker-compose ps
docker-compose logs -f
```

---

## 🔍 Verification Commands

```bash
# Check containers
docker ps

# Test backend
curl http://localhost:5000

# Test frontend
curl http://localhost:80

# Get public IP
curl ifconfig.me

# View logs
docker logs crowd-backend
docker logs crowd-frontend
```

---

## 🛠️ Management Commands

```bash
# Start
docker-compose start

# Stop
docker-compose stop

# Restart
docker-compose restart

# Update
docker-compose pull
docker-compose up -d

# Remove
docker-compose down

# Remove with data
docker-compose down -v
```

---

## 📊 Monitoring

```bash
# Resource usage
docker stats

# Disk usage
df -h

# Container logs
docker-compose logs -f backend

# System info
docker info
```

---

## 🔄 Update Application

```bash
cd ~/crowd-detection
docker-compose pull
docker-compose up -d
docker image prune -a -f
```

---

## 🚨 Quick Fixes

### Restart Everything
```bash
docker-compose restart
```

### Clean and Restart
```bash
docker-compose down
docker-compose up -d
```

### Check Logs for Errors
```bash
docker-compose logs --tail=50
```

### Free Up Space
```bash
docker system prune -a -f
```

---

## 🌐 Access URLs

After deployment:
- **Frontend**: `http://YOUR_EC2_PUBLIC_IP`
- **Backend**: `http://YOUR_EC2_PUBLIC_IP:5000`

Get your IP:
```bash
curl ifconfig.me
```

---

## 💡 Pro Tips

1. **Always use screen/tmux for long operations**
```bash
sudo apt-get install screen -y
screen -S deploy
# Your commands here
# Detach: Ctrl+A, D
# Reattach: screen -r deploy
```

2. **Monitor logs in real-time**
```bash
docker-compose logs -f --tail=100
```

3. **Check resource usage**
```bash
docker stats --no-stream
```

4. **Backup before updates**
```bash
docker exec crowd-mongodb mongodump --out /data/backup
```

---

## ✅ Success Checklist

- [ ] Connected to EC2
- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] docker-compose.yml created
- [ ] Services started
- [ ] All containers running
- [ ] Frontend accessible
- [ ] Backend responding

**Done? Access your app at `http://YOUR_EC2_IP`** 🎉
