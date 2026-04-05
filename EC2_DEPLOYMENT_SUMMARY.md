# EC2 Deployment Summary

## 🎯 Deployment Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS EC2 DEPLOYMENT                        │
└─────────────────────────────────────────────────────────────┘

Step 1: Launch EC2 Instance
├── AMI: Ubuntu 22.04 LTS
├── Instance: t3.medium (2 vCPU, 4 GB RAM)
├── Storage: 30 GB
├── Security Group: Ports 22, 80, 5000
└── Key Pair: Download .pem file

Step 2: Connect to Instance
└── ssh -i key.pem ubuntu@PUBLIC_IP

Step 3: Install Docker
├── curl -fsSL https://get.docker.com | sh
├── sudo usermod -aG docker ubuntu
└── Logout & Login

Step 4: Install Docker Compose
└── sudo curl -L "..." -o /usr/local/bin/docker-compose

Step 5: Create docker-compose.yml
└── nano docker-compose.yml (paste config)

Step 6: Deploy
├── docker-compose pull
└── docker-compose up -d

Step 7: Access
└── http://YOUR_EC2_PUBLIC_IP

✅ DONE!
```

---

## 💻 Instance Recommendations

### For Testing/Development
```
Instance: t2.micro (Free Tier)
- vCPU: 1
- RAM: 1 GB
- Cost: FREE (first year)
- Performance: Slow, but works
```

### For Production (Recommended)
```
Instance: t3.medium
- vCPU: 2
- RAM: 4 GB
- Cost: ~$30/month
- Performance: Good for 10-50 concurrent users
```

### For High Traffic
```
Instance: t3.large
- vCPU: 2
- RAM: 8 GB
- Cost: ~$60/month
- Performance: Handles 50-200 concurrent users
```

---

## 🔒 Security Group Configuration

| Type | Protocol | Port | Source | Purpose |
|------|----------|------|--------|---------|
| SSH | TCP | 22 | My IP | Remote access |
| HTTP | TCP | 80 | 0.0.0.0/0 | Frontend |
| Custom TCP | TCP | 5000 | 0.0.0.0/0 | Backend API |
| HTTPS | TCP | 443 | 0.0.0.0/0 | SSL (optional) |

---

## 📦 What Gets Deployed

```
EC2 Instance
├── Docker Engine
├── Docker Compose
└── Containers:
    ├── MongoDB (Database)
    │   └── Port: 27017
    ├── Backend (Flask + YOLO)
    │   └── Port: 5000
    └── Frontend (React + Nginx)
        └── Port: 80
```

---

## 🌐 Access Points

After deployment:

```
Frontend (User Interface):
http://YOUR_EC2_PUBLIC_IP

Backend API:
http://YOUR_EC2_PUBLIC_IP:5000

MongoDB:
mongodb://YOUR_EC2_PUBLIC_IP:27017
(Internal only, not exposed)
```

---

## ⏱️ Deployment Timeline

| Step | Time | Description |
|------|------|-------------|
| Launch EC2 | 2 min | Create instance |
| Connect | 1 min | SSH connection |
| Install Docker | 3 min | Download & install |
| Install Compose | 1 min | Download binary |
| Create Config | 2 min | docker-compose.yml |
| Pull Images | 5-10 min | Download from DockerHub |
| Start Services | 2 min | Container startup |
| **Total** | **15-20 min** | Complete deployment |

---

## 💰 Monthly Cost Breakdown

### t3.medium (Recommended)

```
EC2 Instance (t3.medium):     $30.00
Storage (30 GB):              $ 3.00
Data Transfer (100 GB):       $ 9.00
Elastic IP (optional):        $ 3.60
─────────────────────────────────────
Total:                        $45.60/month
```

### Cost Optimization Tips:
- Use Reserved Instances (save 40%)
- Stop instance when not in use
- Use Spot Instances (save 70%, but can be interrupted)

---

## 🚀 Quick Deploy Commands

### Complete One-Liner (After SSH)

```bash
# Install everything and deploy
curl -fsSL https://get.docker.com | sudo sh && \
sudo usermod -aG docker ubuntu && \
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && \
sudo chmod +x /usr/local/bin/docker-compose && \
echo "Logout and login, then run deployment script"
```

After logout/login:

```bash
# Deploy application
mkdir ~/crowd-detection && cd ~/crowd-detection && \
wget https://raw.githubusercontent.com/YOUR_REPO/docker-compose.yml && \
docker-compose up -d
```

---

## 📊 Performance Expectations

### t2.micro (1 GB RAM)
- Concurrent Users: 1-5
- Detection Speed: Slow (2-3 FPS)
- Suitable For: Testing only

### t3.small (2 GB RAM)
- Concurrent Users: 5-10
- Detection Speed: Medium (5-7 FPS)
- Suitable For: Small deployments

### t3.medium (4 GB RAM) ⭐
- Concurrent Users: 10-50
- Detection Speed: Good (8-10 FPS)
- Suitable For: Production

### t3.large (8 GB RAM)
- Concurrent Users: 50-200
- Detection Speed: Fast (10+ FPS)
- Suitable For: High traffic

---

## 🔍 Health Check Commands

```bash
# Check all services
docker-compose ps

# Expected output:
NAME              STATUS
crowd-mongodb     Up (healthy)
crowd-backend     Up (healthy)
crowd-frontend    Up (healthy)

# Test endpoints
curl http://localhost:5000  # Backend
curl http://localhost:80    # Frontend

# Check logs
docker-compose logs --tail=20
```

---

## 🛠️ Troubleshooting Guide

### Issue: Cannot connect to EC2
**Solution:**
```bash
# Check security group allows your IP
# Verify instance is running
# Check key file permissions
chmod 400 crowd-detection-key.pem
```

### Issue: Docker command not found
**Solution:**
```bash
# Logout and login after docker installation
exit
ssh -i key.pem ubuntu@YOUR_EC2_IP
```

### Issue: Out of memory
**Solution:**
```bash
# Add swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Issue: Services not starting
**Solution:**
```bash
# Check logs
docker-compose logs

# Restart services
docker-compose restart

# Clean restart
docker-compose down
docker-compose up -d
```

---

## 📚 Documentation Files

- **EC2_DEPLOYMENT.md** - Complete detailed guide
- **EC2_QUICK_START.md** - Quick commands reference
- **EC2_DEPLOYMENT_SUMMARY.md** - This file (overview)

---

## ✅ Pre-Deployment Checklist

- [ ] AWS account created
- [ ] DockerHub images pushed
  - [ ] rjrohan/crowd-detection-backend:latest
  - [ ] rjrohan/crowd-detection-frontend:latest
- [ ] EC2 instance launched
- [ ] Security group configured
- [ ] Key pair downloaded
- [ ] Can SSH to instance

## ✅ Post-Deployment Checklist

- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] docker-compose.yml created
- [ ] Services running
- [ ] Frontend accessible
- [ ] Backend responding
- [ ] Camera detection working
- [ ] MongoDB connected

---

## 🎉 Success!

Once deployed, your application will be accessible at:

```
http://YOUR_EC2_PUBLIC_IP
```

**Example**: `http://54.123.45.67`

---

## 🔄 Next Steps After Deployment

1. **Configure Domain** (Optional)
   - Buy domain
   - Point A record to EC2 IP
   - Install SSL certificate

2. **Setup Monitoring**
   - CloudWatch for EC2 metrics
   - Application logs
   - Uptime monitoring

3. **Configure Backups**
   - MongoDB backups
   - Snapshot EC2 volume
   - Automated backup scripts

4. **Enable Auto-Scaling** (Advanced)
   - Load balancer
   - Auto-scaling group
   - Multiple instances

5. **Production Hardening**
   - Change default passwords
   - Enable firewall
   - Regular security updates
   - SSL/TLS encryption

---

## 📞 Quick Reference

```bash
# SSH to EC2
ssh -i crowd-detection-key.pem ubuntu@YOUR_EC2_IP

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Update
docker-compose pull && docker-compose up -d

# Stop
docker-compose down
```

---

**Ready to deploy? Follow EC2_QUICK_START.md for fastest deployment!** 🚀
