#!/bin/bash

echo "=========================================="
echo "🚀 CHARCOAL MARKETPLACE SETUP"
echo "=========================================="

set -e

# =========================
# PROJECT CHECK
# =========================

echo "🔍 Checking project..."

if [ ! -f "package.json" ]; then
    echo "❌ package.json not found."
    echo "Please run this script from the Charcoal-Marketplace folder."
    exit 1
fi

echo "✅ Project detected."

# =========================
# INSTALL DEPENDENCIES
# =========================

echo ""
echo "📦 Installing Node.js dependencies..."

npm install

echo "✅ Dependencies installed."

# =========================
# CHECK REQUIRED FOLDERS
# =========================

echo ""
echo "📁 Checking project folders..."

mkdir -p config
mkdir -p routes
mkdir -p uploads

echo "✅ Required folders ready."

# =========================
# CHECK DATABASE CONFIG
# =========================

echo ""
echo "🗄️ Checking database configuration..."

if [ ! -f "config/db.js" ]; then
    echo "❌ config/db.js not found."
    echo "Please create config/db.js before starting the server."
    exit 1
fi

echo "✅ config/db.js found."

# =========================
# CHECK ENVIRONMENT FILE
# =========================

echo ""
echo "🔐 Checking environment configuration..."

if [ -f ".env" ]; then
    echo "✅ .env file found."
else
    echo "⚠️ .env file not found."
    echo ""
    echo "For local development, create a .env file."
    echo "For Render production, use Render Environment Variables."
    echo ""
fi

# =========================
# CHECK SERVER
# =========================

echo ""
echo "🖥️ Checking server.js..."

if [ ! -f "server.js" ]; then
    echo "❌ server.js not found."
    exit 1
fi

echo "✅ server.js found."

# =========================
# CHECK ROUTES
# =========================

echo ""
echo "🛣️ Checking routes..."

ROUTES=(
    "admin.routes.js"
    "auth.routes.js"
    "product.routes.js"
    "orders.routes.js"
    "payment.routes.js"
    "notifications.routes.js"
)

for route in "${ROUTES[@]}"
do
    if [ -f "routes/$route" ]; then
        echo "✅ $route"
    else
        echo "⚠️ Missing: routes/$route"
    fi
done

# =========================
# START SERVER
# =========================

echo ""
echo "=========================================="
echo "🎉 SETUP COMPLETE"
echo "=========================================="

echo ""
echo "🚀 Starting Charcoal Marketplace..."
echo ""

node server.js