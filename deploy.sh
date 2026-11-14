cat > ~/deploy.sh << 'EOF'
#!/bin/bash
set -e
cd ~/aravind-frontend-lovable
git pull
npm install
npm run build
sudo rsync -a --delete dist/ /var/www/aravindpillai.com/
echo "Deployed ✔"
EOF
chmod +x ~/deploy.sh