#!/bin/bash

# Install backend dependencies
echo "Setting up backend..."
cd backend
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @nomiclabs/hardhat-ethers ethers dotenv
npm install @openzeppelin/contracts

# Install frontend dependencies
echo "Setting up frontend..."
cd ../frontend
npm install react react-dom react-scripts ethers @metamask/providers axios react-router-dom web3

# Create .env files
echo "Creating environment files..."
cd ../backend
cat > .env << EOL
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
SEPOLIA_URL=
ETHERSCAN_API_KEY=
REPORT_GAS=true
EOL

# Start local blockchain
echo "Starting local blockchain..."
npx hardhat node &

# Wait for node to start
sleep 5

# Deploy contracts
echo "Deploying contracts..."
npx hardhat run scripts/deploy.js --network localhost

# Start frontend
echo "Starting frontend..."
cd ../frontend
npm start

echo "Setup complete! Access the application at http://localhost:3000"