# BrowserBox Deployment Guide for NULL VOID RBI

## Overview

This guide shows you how to deploy BrowserBox for true Remote Browser Isolation (RBI) with NULL VOID. BrowserBox provides real-time browser streaming with full interaction capabilities.

## 🚀 Quick Start Options

### Option 1: Docker (Recommended)

The fastest way to get BrowserBox running:

```bash
# Pull and run BrowserBox
docker run -d \
  --name nullvoid-browserbox \
  -p 8080:8080 \
  -p 8443:8443 \
  --restart unless-stopped \
  ghcr.io/browserbox/browserbox:latest

# Access at: ws://localhost:8080
```

### Option 2: Local Development

For development and testing:

```bash
# Install BrowserBox globally
npm install -g @browserbox/browserbox

# Start BrowserBox server
browserbox --port 8080 --host 0.0.0.0

# Or with custom configuration
browserbox --port 8080 --host 0.0.0.0 --token your-secret-token
```

### Option 3: Heroku One-Click Deploy

1. Visit: https://github.com/BrowserBox/BrowserBox
2. Click "Deploy to Heroku" button
3. Configure environment variables
4. Deploy and get your WebSocket URL

### Option 4: Manual Installation

```bash
# Clone BrowserBox repository
git clone https://github.com/BrowserBox/BrowserBox.git
cd BrowserBox

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in your BrowserBox directory:

```env
# Server Configuration
PORT=8080
HOST=0.0.0.0
TOKEN=your-secret-token-here

# Security Settings
BLOCK_ADS=true
BLOCK_TRACKERS=true
BLOCK_MALWARE=true
ENFORCE_HTTPS=true

# Performance Settings
MAX_SESSIONS=10
SESSION_TIMEOUT=3600000

# NULL VOID Integration
CORS_ORIGIN=chrome-extension://*
ALLOW_EXTENSIONS=true
```

### BrowserBox Configuration File

Create `browserbox.config.js`:

```javascript
module.exports = {
  port: 8080,
  host: '0.0.0.0',
  token: process.env.TOKEN || 'nullvoid-secret',
  
  // Security settings
  security: {
    blockAds: true,
    blockTrackers: true,
    blockMalware: true,
    enforceHTTPS: true,
    allowedOrigins: ['chrome-extension://*']
  },
  
  // Performance settings
  performance: {
    maxSessions: 10,
    sessionTimeout: 60 * 60 * 1000, // 1 hour
    memoryLimit: '2GB'
  },
  
  // Browser settings
  browser: {
    headless: false, // Set to true for production
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--remote-debugging-port=9222'
    ]
  }
};
```

## 🌐 Cloud Deployment

### AWS EC2 Deployment

```bash
# Launch EC2 instance (Ubuntu 20.04 LTS)
# Security Group: Allow ports 8080, 8443, 22

# Connect to instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install Docker
sudo apt update
sudo apt install docker.io -y
sudo systemctl start docker
sudo systemctl enable docker

# Run BrowserBox
sudo docker run -d \
  --name browserbox \
  -p 8080:8080 \
  -p 8443:8443 \
  --restart unless-stopped \
  ghcr.io/browserbox/browserbox:latest

# Your WebSocket URL: ws://your-ec2-ip:8080
```

### Google Cloud Platform

```bash
# Create VM instance
gcloud compute instances create browserbox-vm \
  --image-family=ubuntu-2004-lts \
  --image-project=ubuntu-os-cloud \
  --machine-type=e2-medium \
  --tags=browserbox-server

# Create firewall rule
gcloud compute firewall-rules create allow-browserbox \
  --allow tcp:8080,tcp:8443 \
  --source-ranges 0.0.0.0/0 \
  --target-tags browserbox-server

# SSH and install
gcloud compute ssh browserbox-vm
# ... follow Docker installation steps above
```

### DigitalOcean Droplet

```bash
# Create droplet with Docker pre-installed
# Choose Ubuntu 20.04 with Docker

# SSH to droplet
ssh root@your-droplet-ip

# Run BrowserBox
docker run -d \
  --name browserbox \
  -p 8080:8080 \
  -p 8443:8443 \
  --restart unless-stopped \
  ghcr.io/browserbox/browserbox:latest
```

## 🔗 Integration with NULL VOID

### Update BrowserBox Endpoints

Edit `src/browserbox-rbi.js` in your NULL VOID extension:

```javascript
// Update endpoints with your deployment URLs
endpoints: {
  singapore: 'ws://your-singapore-server:8080',
  usa: 'ws://your-usa-server:8080',
  uk: 'ws://your-uk-server:8080',
  europe: 'ws://your-europe-server:8080',
  japan: 'ws://your-japan-server:8080',
  // Local development
  local: 'ws://localhost:8080'
}
```

### Test Connection

1. Start your BrowserBox server
2. Open NULL VOID extension
3. Click "Disposable Browser Start"
4. Check browser console for connection logs

## 🛡️ Security Configuration

### SSL/TLS Setup (Production)

```bash
# Install Certbot
sudo apt install certbot -y

# Get SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Update BrowserBox to use HTTPS
docker run -d \
  --name browserbox-ssl \
  -p 8443:8443 \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  --restart unless-stopped \
  ghcr.io/browserbox/browserbox:latest \
  --ssl-cert /etc/letsencrypt/live/your-domain.com/fullchain.pem \
  --ssl-key /etc/letsencrypt/live/your-domain.com/privkey.pem
```

### Firewall Configuration

```bash
# Ubuntu UFW
sudo ufw allow 8080/tcp
sudo ufw allow 8443/tcp
sudo ufw enable

# CentOS/RHEL Firewalld
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=8443/tcp
sudo firewall-cmd --reload
```

## 📊 Monitoring & Logging

### Docker Logs

```bash
# View BrowserBox logs
docker logs -f browserbox

# View logs with timestamps
docker logs -t browserbox
```

### Health Check

```bash
# Check if BrowserBox is running
curl -I http://localhost:8080/health

# WebSocket connection test
wscat -c ws://localhost:8080
```

### Performance Monitoring

```bash
# Monitor resource usage
docker stats browserbox

# System monitoring
htop
iotop
```

## 🔧 Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check if port is open
   netstat -tlnp | grep 8080
   
   # Check firewall
   sudo ufw status
   ```

2. **WebSocket Connection Failed**
   ```bash
   # Check BrowserBox logs
   docker logs browserbox
   
   # Test WebSocket manually
   wscat -c ws://localhost:8080
   ```

3. **High Memory Usage**
   ```bash
   # Limit Docker memory
   docker run --memory=2g browserbox
   
   # Monitor memory usage
   docker stats
   ```

### Debug Mode

```bash
# Run BrowserBox in debug mode
docker run -it \
  -p 8080:8080 \
  -e DEBUG=* \
  ghcr.io/browserbox/browserbox:latest
```

## 🚀 Production Deployment Checklist

- [ ] SSL/TLS certificates configured
- [ ] Firewall rules properly set
- [ ] Resource limits configured
- [ ] Monitoring and logging enabled
- [ ] Backup strategy in place
- [ ] Auto-restart configured
- [ ] Health checks implemented
- [ ] Load balancing (if multiple instances)

## 📈 Scaling

### Multiple Instances

```bash
# Run multiple BrowserBox instances
for i in {1..3}; do
  docker run -d \
    --name browserbox-$i \
    -p $((8080+$i)):8080 \
    ghcr.io/browserbox/browserbox:latest
done
```

### Load Balancer (Nginx)

```nginx
upstream browserbox {
    server localhost:8081;
    server localhost:8082;
    server localhost:8083;
}

server {
    listen 8080;
    location / {
        proxy_pass http://browserbox;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## 🎯 Next Steps

1. Deploy BrowserBox using your preferred method
2. Update NULL VOID extension endpoints
3. Test the connection
4. Configure security settings
5. Set up monitoring
6. Deploy to production

Your NULL VOID extension will now have true Remote Browser Isolation powered by BrowserBox! 🎉