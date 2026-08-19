import { ethers } from 'ethers';

let provider;
let signer;
let userAddress = null;

// Contract ABIs and addresses
import VotingABI from '../contracts/VotingABI.json';
import VotingFactoryABI from '../contracts/VotingFactoryABI.json';
import contractAddresses from '../contracts/contracts.json';

export const connectWallet = async () => {
  if (!window.ethereum) {
    throw new Error('Please install MetaMask!');
  }
  
  try {
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    
    // Switch to local network if needed
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x7A69' }] // 31337 in hex
      });
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x7A69',
            chainName: 'Hardhat Local',
            rpcUrls: ['http://127.0.0.1:8545'],
            nativeCurrency: {
              name: 'ETH',
              symbol: 'ETH',
              decimals: 18
            }
          }]
        });
      }
    }
    
    return { address: userAddress, provider, signer };
  } catch (error) {
    console.error('Error connecting wallet:', error);
    throw error;
  }
};

export const getVotingFactory = () => {
  if (!provider || !signer) {
    throw new Error('Please connect wallet first');
  }
  
  return new ethers.Contract(
    contractAddresses.votingFactory,
    VotingFactoryABI,
    signer
  );
};

export const getVotingContract = (address) => {
  if (!provider || !signer) {
    throw new Error('Please connect wallet first');
  }
  
  return new ethers.Contract(
    address,
    VotingABI,
    signer
  );
};

export const getProvider = () => provider;
export const getSigner = () => signer;
export const getUserAddress = () => userAddress;

// Listen for account changes
export const setupAccountListener = (callback) => {
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length > 0) {
        userAddress = accounts[0];
        callback(accounts[0]);
      } else {
        userAddress = null;
        callback(null);
      }
    });
    
    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    });
  }
};