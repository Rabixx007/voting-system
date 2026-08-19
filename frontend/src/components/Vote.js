import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getVotingContract, getUserAddress } from '../utils/web3';

const Vote = ({ electionAddress }) => {
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [electionDetails, setElectionDetails] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [voterInfo, setVoterInfo] = useState(null);

  useEffect(() => {
    if (electionAddress) {
      loadElectionData();
    }
  }, [electionAddress]);

  const loadElectionData = async () => {
    try {
      setLoading(true);
      const contract = getVotingContract(electionAddress);
      
      // Load election details
      const election = await contract.getElectionDetails();
      setElectionDetails({
        title: election.title,
        description: election.description,
        startTime: new Date(election.startTime.toNumber() * 1000),
        endTime: new Date(election.endTime.toNumber() * 1000),
        totalVotes: election.totalVotes.toNumber(),
        isActive: election.isActive,
        resultsPublished: election.resultsPublished
      });
      
      // Load candidates
      const candidateCount = await contract.candidatesCount();
      const candidateList = [];
      
      for (let i = 1; i <= candidateCount.toNumber(); i++) {
        const candidate = await contract.getCandidate(i);
        candidateList.push({
          id: candidate.id.toNumber(),
          name: candidate.name,
          voteCount: candidate.voteCount.toNumber()
        });
      }
      
      setCandidates(candidateList);
      
      // Check if user has voted
      const userAddress = getUserAddress();
      if (userAddress) {
        const voter = await contract.getVoter(userAddress);
        setHasVoted(voter.hasVoted);
        setVoterInfo(voter);
      }
      
      setError('');
    } catch (err) {
      console.error('Error loading election:', err);
      setError('Failed to load election data');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async () => {
    if (!selectedCandidate) {
      setError('Please select a candidate');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      const contract = getVotingContract(electionAddress);
      
      // Check if election is active
      const now = Math.floor(Date.now() / 1000);
      if (now < electionDetails.startTime.getTime() / 1000) {
        setError('Election has not started yet');
        return;
      }
      
      if (now > electionDetails.endTime.getTime() / 1000) {
        setError('Election has ended');
        return;
      }
      
      // Submit vote
      const tx = await contract.vote(selectedCandidate);
      await tx.wait();
      
      setSuccess('Vote submitted successfully!');
      setHasVoted(true);
      await loadElectionData();
    } catch (err) {
      console.error('Error voting:', err);
      setError(err.message || 'Failed to submit vote');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishResults = async () => {
    try {
      setLoading(true);
      const contract = getVotingContract(electionAddress);
      const tx = await contract.publishResults();
      await tx.wait();
      
      setSuccess('Results published successfully!');
      await loadElectionData();
    } catch (err) {
      console.error('Error publishing results:', err);
      setError(err.message || 'Failed to publish results');
    }
  };

  if (loading && !electionDetails) {
    return <div className="loading">Loading election data...</div>;
  }

  const isElectionActive = electionDetails?.isActive && 
    new Date() >= electionDetails.startTime && 
    new Date() <= electionDetails.endTime;

  return (
    <div className="vote-container">
      <h2>{electionDetails?.title}</h2>
      <p className="description">{electionDetails?.description}</p>
      
      <div className="election-info">
        <div>Start: {electionDetails?.startTime.toLocaleString()}</div>
        <div>End: {electionDetails?.endTime.toLocaleString()}</div>
        <div>Total Votes: {electionDetails?.totalVotes}</div>
        <div>Status: {isElectionActive ? '🟢 Active' : '🔴 Ended'}</div>
        {hasVoted && <div className="voted-badge">✓ You have voted</div>}
      </div>
      
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
      
      {isElectionActive && !hasVoted && (
        <div className="candidates-list">
          <h3>Select a Candidate</h3>
          {candidates.map((candidate) => (
            <div 
              key={candidate.id}
              className={`candidate-card ${selectedCandidate === candidate.id ? 'selected' : ''}`}
              onClick={() => setSelectedCandidate(candidate.id)}
            >
              <div className="candidate-info">
                <span className="candidate-name">{candidate.name}</span>
                <span className="candidate-votes">Votes: {candidate.voteCount}</span>
              </div>
              <input 
                type="radio" 
                checked={selectedCandidate === candidate.id}
                onChange={() => setSelectedCandidate(candidate.id)}
              />
            </div>
          ))}
          
          <button 
            onClick={handleVote}
            disabled={loading || !selectedCandidate}
            className="vote-button"
          >
            {loading ? 'Submitting...' : 'Submit Vote'}
          </button>
        </div>
      )}
      
      {!isElectionActive && electionDetails?.resultsPublished && (
        <div className="results-container">
          <h3>Final Results</h3>
          {candidates.map((candidate) => (
            <div key={candidate.id} className="result-item">
              <span className="result-name">{candidate.name}</span>
              <span className="result-votes">
                {candidate.voteCount} votes 
                ({electionDetails.totalVotes > 0 
                  ? ((candidate.voteCount / electionDetails.totalVotes) * 100).toFixed(1)
                  : 0}%)
              </span>
              <div className="result-bar">
                <div 
                  className="result-fill" 
                  style={{ 
                    width: electionDetails.totalVotes > 0 
                      ? `${(candidate.voteCount / electionDetails.totalVotes) * 100}%` 
                      : '0%' 
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      
      {!isElectionActive && !electionDetails?.resultsPublished && (
        <div className="admin-actions">
          <button onClick={handlePublishResults} className="publish-button">
            Publish Results
          </button>
        </div>
      )}
    </div>
  );
};

export default Vote;