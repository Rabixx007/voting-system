#!/bin/bash

echo "🚀 Setting up Voting System..."

# Step 1: Backend setup
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Step 2: Compile contracts
echo "🔨 Compiling smart contracts..."
npx hardhat compile

# Step 3: Start local blockchain (in background)
echo "⛓️  Starting local blockchain..."
npx hardhat node > /dev/null 2>&1 &
NODE_PID=$!
sleep 5

# Step 4: Deploy contracts
echo "📤 Deploying contracts..."
npx hardhat run scripts/deploy.js --network localhost

# Step 5: Generate ABI files for frontend
echo "📄 Generating ABI files..."
cp artifacts/contracts/Voting.sol/Voting.json ../frontend/src/contracts/VotingABI.json
cp artifacts/contracts/VotingFactory.sol/VotingFactory.json ../frontend/src/contracts/VotingFactoryABI.json

# Step 6: Copy contract addresses
echo "📍 Copying contract addresses..."
cp contracts.json ../frontend/src/contracts/contracts.json

# Step 7: Frontend setup
echo "🎨 Setting up frontend..."
cd ../frontend
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the application:"
echo "1. Keep this terminal running (blockchain node)"
echo "2. Open a new terminal and run:"
echo "   cd voting-system/backend && npx hardhat node"
echo "3. In another terminal:"
echo "   cd voting-system/frontend && npm start"
echo ""
echo "📝 Important: Import the following private key into MetaMask:"
echo "Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
echo "Network URL: http://localhost:8545"
echo "Chain ID: 31337"
