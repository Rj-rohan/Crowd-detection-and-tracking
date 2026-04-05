# AWS EC2 Deployment Guide

## 🎯 Overview
Deploy Crowd Detection System on AWS EC2 with Docker.

---

## 📋 Prerequisites

- AWS Account
- DockerHub images pushed:
  - `rjrohan/crowd-detection-backend:latest`
  - `rjrohan/crowd-detection-frontend:latest`

---

## 🚀 Step-by-Step Deployment

### Step 1: Launch EC2 Instance

#### 1.1 Go to AWS Console
- Login to https://console.aws.amazon.com
- Navigate to **EC2 Dashboard**
- Click **Launch Instance**

#### 1.2 Configure Instance

**Name**: `crowd-detection-server`

**AMI (Operating System)**:
- Choose: **Ubuntu Server 22.04 LTS (Free Tier)**
- Architecture: 64-bit (x86)

**Instance Type**:
- Recommended: **t3.large** (2 vCPU, 8 GB RAM)
- Minimum: **t3.medium** (2 vCPU, 4 GB RAM)
- Free Tier: **t2.micro** (1 vCPU, 1 GB RAM) - Will be slow

**Key Pair**:
- Create new key pair
- Name: `crowd-detection-key`
- Type: RSA
- Format: `.pem` (for Mac/Linux) or `.ppk` (for Windows/PuTTY)
- **Download and save securely!**

**Network Settings**:
- Create security group: `crowd-detection-sg`
- Allow:
  - ✅ SSH (Port 22) - Your IP
  - ✅ HTTP (Port 80) - Anywhere (0.0.0.0/0)
  - ✅ HTTPS (Port 443) - Anywhere (0.0.0.0/0)
  - ✅ Custom TCP (Port 5000) - Anywhere (0.0.0.0/0) - Backend API

**Storage**:
- Size: **30 GB** (minimum for Docker images)
- Type: gp3 (General Purpose SSD)

#### 1.3 Launch Instance
- Click **Launch Instance**
- Wait for instance to be **Running**
- Note the **Public IPv4 address**

---

### Step 2: Connect to EC2 Instance

#### Option A: Using SSH (Mac/Linux/Windows PowerShell)

```bash
# Set key permissions (Mac/Linux only)
chmod 400 crowd-detection-key.pem

# Connect to instance
ssh -i crowd-detection-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

#### Option B: Using PuTTY (Windows)

1. Open PuTTY
2. Host Name: `ubuntu@YOUR_EC2_PUBLIC_IP`
3. Connection > SSH > Auth > Browse for `.ppk` file
4. Click **Open**

#### Option C: Using EC2 Instance Connect (Browser)

1. Go to EC2 Dashboard
2. Select your instance
3. Click **Connect**
4. Choose **EC2 Instance Connect**
5. Click **Connect**

---

### Step 3: Install Docker & Docker Compose

Once connected to EC2, run these commands:

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group (no need for sudo)
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version

# Logout and login again for group changes
exit
```

**Reconnect to EC2** after exit.

---

### Step 4: Setup Application

```bash
# Create project directory
mkdir -p ~/crowd-detection
cd ~/crowd-detection

# Create docker-compose.yml
nano docker-compose.yml
```

**Paste this content:**

```yaml
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
      - TWILIO_ACCOUNT_SID=disabled
      - TWILIO_AUTH_TOKEN=disabled
      - TWILIO_WHATSAPP_FROM=disabled
      - TWILIO_WHATSAPP_TO=disabled
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
```

**Save**: Press `Ctrl+X`, then `Y`, then `Enter`

---

### Step 5: Create Environment File (Optional)

```bash
# Create .env file for sensitive data
nano .env
```

**Paste:**
```env
MONGO_PASSWORD=SecurePassword123!
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WHATSAPP_TO=whatsapp:+1234567890
```

**Save**: `Ctrl+X`, `Y`, `Enter`

---

### Step 6: Deploy Application

```bash
# Pull images from DockerHub
docker-compose pull

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

**Expected Output:**
```
✔ Container crowd-mongodb   Started
✔ Container crowd-backend    Started
✔ Container crowd-frontend   Started
```

---

### Step 7: Verify Deployment

```bash
# Check if services are running
docker ps

# Test backend
curl http://localhost:5000

# Test frontend
curl http://localhost:80

# Check logs
docker logs crowd-backend
docker logs crowd-frontend
docker logs crowd-mongodb
```

---

### Step 8: Access Application

Open browser and visit:
```
http://YOUR_EC2_PUBLIC_IP
```

**Example**: `http://54.123.45.67`

You should see the Crowd Detection interface!

---

## 🔒 Security Configuration

### Update Security Group

1. Go to **EC2 Dashboard** > **Security Groups**
2. Select `crowd-detection-sg`
3. Edit **Inbound Rules**:

| Type | Port | Source | Description |
|------|------|--------|-------------|
| SSH | 22 | My IP | SSH access |
| HTTP | 80 | 0.0.0.0/0 | Frontend |
| Custom TCP | 5000 | 0.0.0.0/0 | Backend API |

---

## 🌐 Setup Domain (Optional)

### Step 1: Get Domain
- Buy domain from Route 53, GoDaddy, Namecheap, etc.

### Step 2: Point to EC2
- Create **A Record**
- Point to EC2 Public IP
- Example: `crowd.yourdomain.com` → `54.123.45.67`

### Step 3: Install SSL Certificate

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d crowd.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

---

## 📊 Monitoring Commands

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Check resource usage
docker stats

# Restart services
docker-compose restart

# Stop services
docker-compose stop

# Start services
docker-compose start

# Update images
docker-compose pull
docker-compose up -d
```

---

## 🔄 Update Deployment

When you push new images to DockerHub:

```bash
cd ~/crowd-detection

# Pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d

# Remove old images
docker image prune -a
```

---

## 💾 Backup MongoDB

```bash
# Create backup
docker exec crowd-mongodb mongodump --out /data/backup

# Copy to host
docker cp crowd-mongodb:/data/backup ./mongodb-backup

# Download to local (from your computer)
scp -i crowd-detection-key.pem -r ubuntu@YOUR_EC2_IP:~/crowd-detection/mongodb-backup ./
```

---

## 🚨 Troubleshooting

### Issue 1: Cannot Connect to EC2
```bash
# Check security group allows your IP
# Check instance is running
# Verify key file permissions: chmod 400 key.pem
```

### Issue 2: Docker Not Found
```bash
# Logout and login again after docker installation
exit
ssh -i crowd-detection-key.pem ubuntu@YOUR_EC2_IP
```

### Issue 3: Services Not Starting
```bash
# Check logs
docker-compose logs

# Check disk space
df -h

# Restart Docker
sudo systemctl restart docker
docker-compose up -d
```

### Issue 4: Out of Memory
```bash
# Upgrade to larger instance (t3.medium or t3.large)
# Or add swap space:
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 💰 Cost Estimation

### EC2 Instance Costs (US East)

| Instance Type | vCPU | RAM | Cost/Month | Recommended For |
|--------------|------|-----|------------|-----------------|
| t2.micro | 1 | 1 GB | $8.50 | Testing only |
| t3.small | 2 | 2 GB | $15 | Light usage |
| t3.medium | 2 | 4 GB | $30 | Production |
| t3.large | 2 | 8 GB | $60 | High traffic |

**Additional Costs:**
- Storage (30 GB): ~$3/month
- Data Transfer: ~$0.09/GB
- Elastic IP (optional): $3.60/month

**Total Estimated**: $35-65/month for production

---

## 🎯 Production Checklist

- [ ] EC2 instance launched
- [ ] Security group configured
- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] Application deployed
- [ ] Services running
- [ ] Frontend accessible
- [ ] Backend responding
- [ ] MongoDB connected
- [ ] Domain configured (optional)
- [ ] SSL certificate installed (optional)
- [ ] Monitoring setup
- [ ] Backup configured

---

## 📞 Quick Commands Reference

```bash
# SSH to EC2
ssh -i crowd-detection-key.pem ubuntu@YOUR_EC2_IP

# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Update
docker-compose pull && docker-compose up -d

# Check status
docker-compose ps
```

---

## 🎉 Success!

Your Crowd Detection System is now live on AWS EC2!

**Access**: `http://YOUR_EC2_PUBLIC_IP`

**Next Steps**:
1. Test camera detection
2. Configure WhatsApp alerts
3. Set up domain and SSL
4. Configure monitoring
5. Set up automated backups
