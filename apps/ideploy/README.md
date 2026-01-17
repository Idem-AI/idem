# 🚀 iDeploy - AI-Powered Application Deployment Platform

**Professional-grade deployment platform with advanced security and firewall management**

[\![Laravel](https://img.shields.io/badge/Laravel-11-ff2d20.svg)](https://laravel.com)
[\![Livewire](https://img.shields.io/badge/Livewire-3-fb70a9.svg)](https://livewire.laravel.com)
[\![CrowdSec](https://img.shields.io/badge/CrowdSec-1.6-00a2ff.svg)](https://crowdsec.net)

## ✨ Features

### 🏗️ Application Deployment
- **One-click deployment** with automatic environment setup
- **Multi-environment support** (development, staging, production)
- **Git integration** with automatic builds and deployments
- **Health monitoring** and uptime tracking

### 🛡️ Advanced Security & Firewall
- **CrowdSec integration** for real-time threat detection
- **Traefik reverse proxy** with automatic SSL
- **IP blocking and rate limiting** 
- **Traffic analytics** with real-time metrics
- **Custom firewall rules** with visual editor

### 📊 Monitoring & Analytics  
- **Real-time metrics** with 30-second refresh
- **Traffic analysis** and security events
- **Performance monitoring** and alerts
- **Resource usage tracking**

## 🏛️ Architecture

### Core Components
- **Laravel Backend** - API and business logic
- **Livewire Frontend** - Interactive UI components  
- **CrowdSec Engine** - Security and threat detection
- **Traefik Proxy** - Load balancing and SSL termination
- **Traffic Logger** - Real-time metrics collection

### Security Stack
```
Application → Traefik → CrowdSec → Traffic Logger → Server
```

## 🚦 Quick Start

### 1. Environment Setup
```bash
cp .env.example .env
php artisan key:generate
php artisan migrate
```

### 2. Deploy Application
1. Navigate to **Configuration** → **Deployments**
2. Click **Deploy** button
3. Monitor deployment progress
4. Access deployed application

### 3. Enable Firewall
1. Go to **Security** section
2. Click **Enable Firewall** 
3. Create custom rules as needed
4. Monitor security events

## 🔧 Configuration

### Required Environment Variables
```env
APP_NAME="iDeploy"
APP_ENV=production
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=ideploy
DB_USERNAME=
DB_PASSWORD=
```

### Firewall Settings
- **Default ban duration**: 30 days
- **Update interval**: 5 seconds
- **Log level**: DEBUG (production: INFO)

## 📚 User Guide

### Application Management
- **Deploy**: Create new application deployments
- **Monitor**: Track application health and performance
- **Scale**: Manage resources and scaling

### Security Management  
- **Firewall Rules**: Create IP blocks, rate limits, geo-blocking
- **Analytics**: View traffic patterns and security events
- **Alerts**: Configure notifications for security incidents

## 🔗 Navigation

### Quick Access Buttons
- **← Back to Deployment** - Return to main deployment dashboard
- **Security** - Access firewall and security settings  
- **Analytics** - View traffic and performance metrics
- **Configuration** - Manage application settings

## 📖 API Documentation

### Firewall Rules API
```php
// Create IP block rule
POST /api/firewall/rules
{
  "name": "Block Suspicious IP",
  "conditions": [{"field": "ip_address", "operator": "equals", "value": "1.2.3.4"}],
  "action": "block"
}
```

### Metrics API  
```php
// Get real-time metrics
GET /api/metrics/{app_id}?hours=1
```

## 🛠️ Development

### Local Development
```bash
php artisan serve
npm run dev
php artisan queue:work
```

### Testing
```bash
php artisan test
php artisan test --filter=Firewall
```

## 🔐 Security

### Threat Detection
- **Real-time IP reputation** checking
- **Behavioral analysis** for anomaly detection
- **Community threat intelligence** via CrowdSec
- **Custom rule engine** for business-specific threats

### Compliance
- **GDPR compliant** data handling
- **SOC 2 compatible** security controls
- **Industry best practices** implementation

## 📞 Support

- **Documentation**: [Internal Wiki]
- **Issues**: Create GitHub issues for bug reports
- **Security**: Email security@company.com for vulnerabilities

---

**Built with ❤️ by the iDem AI Team**
