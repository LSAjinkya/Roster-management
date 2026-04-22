#!/bin/bash
# Deployment script for Roster Management App
set -e

APP_DIR=/opt/roster-app
echo '[1/4] Pulling latest from GitHub...'
cd $APP_DIR
git pull origin main

echo '[2/4] Installing dependencies...'
npm install --production=false

echo '[3/4] Building app...'
npm run build

echo '[4/4] Reloading Nginx...'
systemctl reload nginx

echo 'Deployment complete!'
echo "App URL: http://45.120.138.243"
