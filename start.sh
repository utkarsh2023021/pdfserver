#!/bin/bash
# Start Flask app
pm2 start python app.py --name "flask-app"

# Start Node.js app
pm2 start node index.js --name "node-app"

# Ensure pm2 runs on restart and save the configuration
pm2 startup
pm2 save