# Hostinger VPS Deployment Guide

## 1. Install Node.js on VPS
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
```

## 2. Install PostgreSQL
```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE USER salonuser WITH PASSWORD 'yourpassword';"
sudo -u postgres psql -c "CREATE DATABASE beauty_salon OWNER salonuser;"
```

## 3. Upload the project
```bash
# From your Mac:
scp -r "/Users/mariosaade/Desktop/BEAUTY SALON/salon-app" root@YOUR_VPS_IP:/var/www/salon-app
```

## 4. Set environment variables on VPS
```bash
cd /var/www/salon-app
cp .env.local .env
nano .env
```
Fill in:
```
DATABASE_URL="postgresql://salonuser:yourpassword@localhost:5432/beauty_salon"
ANTHROPIC_API_KEY="sk-ant-..."
WHATSAPP_PHONE_NUMBER_ID="your-id"
WHATSAPP_ACCESS_TOKEN="your-token"
WHATSAPP_VERIFY_TOKEN="any-random-string"
CRON_SECRET="any-random-string"
```

## 5. Install, migrate, seed
```bash
npm install
npx prisma migrate deploy
npm run db:seed
```
Default admin login: **admin@salon.com / admin123** — change immediately after login.

## 6. Build & run with PM2
```bash
npm install -g pm2
npm run build
pm2 start npm --name "salon" -- start
pm2 save && pm2 startup
```

## 7. Nginx reverse proxy
```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/salon
```
Paste:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/salon /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 8. SSL (free)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 9. WhatsApp Setup
1. Go to **Meta Developer Portal** → Create App → WhatsApp
2. Get your **Phone Number ID** and **Access Token**
3. Set Webhook URL: `https://yourdomain.com/api/whatsapp`
4. Verify Token: use the same value as `WHATSAPP_VERIFY_TOKEN` in .env
5. Subscribe to `messages` webhook field

## 10. Reminders cron (every 15 min)
```bash
crontab -e
# Add:
*/15 * * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.com/api/reminders
```

## Access
- **Public site:** https://yourdomain.com
- **Admin:** https://yourdomain.com/admin → login: admin@salon.com / admin123
- **Staff login:** create staff users from Admin → Staff page
