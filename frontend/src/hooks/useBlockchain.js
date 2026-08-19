import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { connectWallet, getVotingFactory } from '../utils/web3';

export const useBlockchain = () => {
  const [account, setAccount] = useState(null);
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    initBlockchain();
  }, []);

  const initBlockchain = async () => {
    try {
      const { address } = await connectWallet();
      setAccount(address);
      await loadElections();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadElections = async () => {
    try {
      const factory = getVotingFactory();
      const electionAddresses = await factory.getElections();
      
      // Load details for each election
      const electionData = await Promise.all(
        electionAddresses.map(async (address) => {
          try {
            const contract = new ethers.Contract(
              address,
              ['function getElectionDetails() external view returns (tuple(string title, string description, uint256 startTime, uint256 endTime, bool isActive, bool resultsPublished, address creator, uint256 totalVotes))'],
              factory.signer
            );
            const details = await contract.getElectionDetails();
            return {
              address,
              title: details.title,
              description: details.description,
              startTime: new Date(details.startTime.toNumber() * 1000),
              endTime: new Date(details.endTime.toNumber() * 1000),
              isActive: details.isActive,
              totalVotes: details.totalVotes.toNumber()
            };
          } catch (err) {
            console.error(`Error loading election ${address}:`, err);
            return null;
          }
        })
      );
      
      setElections(electionData.filter(e => e !== null));
    } catch (err) {
      console.error('Error loading elections:', err);
      setError('Failed to load elections');
    }
  };

  const createElection = async (title, description, startTime, endTime, candidates) => {
    try {
      const factory = getVotingFactory();
      const tx = await factory.createElection(
        title,
        description,
        Math.floor(startTime.getTime() / 1000),
        Math.floor(endTime.getTime() / 1000),
        candidates
      );
      await tx.wait();
      await loadElections();
      return { success: true };
    } catch (err) {
      console.error('Error creating election:', err);
      return { success: false, error: err.message };
    }
  };

  return {
    account,
    elections,
    loading,
    error,
    createElection,
    loadElections,
    connectWallet: initBlockchain
  };
};