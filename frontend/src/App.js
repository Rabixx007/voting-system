import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import AdminDashboard from './components/AdminDashboard';
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import contractData from './contracts/contracts.json';
import VotingFactoryABI from './contracts/VotingFactoryABI.json';
import VotingABI from './contracts/VotingABI.json';

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [factory, setFactory] = useState(null);
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedElection, setSelectedElection] = useState(null);
  const [showElectionDetail, setShowElectionDetail] = useState(false);
  const [selectedElectionData, setSelectedElectionData] = useState(null);
  const [electionMetadata, setElectionMetadata] = useState([]);
  // Auth state
  const [authToken, setAuthToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    candidates: ['', '', ''],
    startTime: '',
    endTime: ''
  });

  const connectWallet = async () => {
    // 🔒 Check if user is logged in
    if (!user || !authToken) {
      setMessage('❌ Please login first before connecting wallet.');
      return;
    }

    // ✅ Check if the connected wallet matches the registered one
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const connectedAddress = accounts[0].toLowerCase();

    if (connectedAddress !== user.walletAddress.toLowerCase()) {
      setMessage(`❌ Wallet mismatch. You registered with ${user.walletAddress}, but connected ${connectedAddress}.`);
      return;
    }
    try {
      setLoading(true);
      if (!window.ethereum) {
        setMessage('Please install MetaMask!');
        return;
      }

      // Force MetaMask to show account selection
      // First, disconnect any existing connection
      await window.ethereum.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }]
      }).catch(() => { });

      // Now request accounts - this will force the popup
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      // Continue with existing code...
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setAccount(address);
      setProvider(provider);
      setSigner(signer);

      const abi = VotingFactoryABI.abi || VotingFactoryABI;
      const factoryContract = new ethers.Contract(
        contractData.votingFactory,
        abi,
        signer
      );
      setFactory(factoryContract);

      setMessage(`✅ Connected: ${address.slice(0, 6)}...${address.slice(-4)}`);
      await loadElections(factoryContract);
      await fetchElectionMetadata();
    } catch (error) {
      console.error('Connection error:', error);
      setMessage('❌ Failed to connect wallet: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  // Add this function to fetch from backend
  const fetchElectionsFromAPI = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/elections');
      const data = await response.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.error('API fetch error:', error);
      return [];
    }
  };
  const loadElections = async (factoryContract) => {
    try {
      const contract = factoryContract || factory;
      if (!contract) return;
      let addresses = [];
      try {
        addresses = await contract.getElections();
      } catch (e) {
        console.log('No elections yet or error:', e);
      }
      setElections(addresses || []);
    } catch (error) {
      console.error('Error loading elections:', error);
      setElections([]);
    }
  };
  const createElection = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage('Creating election...');

      const candidates = formData.candidates.filter(c => c.trim() !== '');
      if (candidates.length < 2) {
        setMessage('❌ Please enter at least 2 candidates');
        setLoading(false);
        return;
      }
      if (!formData.title.trim()) {
        setMessage('❌ Please enter a title');
        setLoading(false);
        return;
      }
      if (!formData.startTime || !formData.endTime) {
        setMessage('❌ Please set start and end times');
        setLoading(false);
        return;
      }

      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const endTime = Math.floor(new Date(formData.endTime).getTime() / 1000);
      if (startTime <= Math.floor(Date.now() / 1000)) {
        setMessage('❌ Start time must be in the future');
        setLoading(false);
        return;
      }
      if (endTime <= startTime) {
        setMessage('❌ End time must be after start time');
        setLoading(false);
        return;
      }
      if (!factory) {
        setMessage('❌ Factory contract not initialized');
        setLoading(false);
        return;
      }

      const tx = await factory.createElection(
        formData.title,
        formData.description,
        startTime,
        endTime,
        candidates
      );
      setMessage('⏳ Waiting for confirmation...');
      const receipt = await tx.wait();

      // Get election address from event
      const electionCreatedEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === 'ElectionCreated'
      );
      const electionAddress = electionCreatedEvent ? electionCreatedEvent.args[0] : null;
      if (!electionAddress) {
        setMessage('❌ Failed to get election address');
        setLoading(false);
        return;
      }

      // Save metadata to backend
      try {
        const response = await fetch('http://localhost:5000/api/elections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractAddress: electionAddress,
            title: formData.title,
            description: formData.description,
            category: 'general',
            startTime: new Date(startTime * 1000).toISOString(),
            endTime: new Date(endTime * 1000).toISOString(),
            creatorAddress: account,
          })
        });
        const result = await response.json();
        if (result.success) {
          setMessage('✅ Election created and saved to backend!');
        } else {
          setMessage('⚠️ Election created on chain but metadata not saved');
        }
      } catch (error) {
        console.error('Failed to save metadata:', error);
        setMessage('⚠️ Election created but metadata not saved');
      }

      setShowCreateForm(false);
      setFormData({ title: '', description: '', candidates: ['', '', ''], startTime: '', endTime: '' });
      await loadElections();
      await fetchElectionMetadata();
    } catch (error) {
      console.error(error);
      let msg = error.message;
      if (error.code === 'ACTION_REJECTED') msg = 'Transaction rejected';
      else if (error.code === 'INSUFFICIENT_FUNDS') msg = 'Insufficient funds';
      setMessage('❌ ' + msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchElectionMetadata = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/elections');
      const data = await response.json();
      if (data.success) {
        setElectionMetadata(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch metadata:', error);
    }
  };

  const handleViewElection = (electionAddress) => {
    // Store the selected election address
    setSelectedElection(electionAddress);
    setShowElectionDetail(true);
    // Load election details
    loadElectionDetails(electionAddress);
  };

  const loadElectionDetails = async (electionAddress) => {
    try {
      setLoading(true);
      // Get the election contract
      const abi = VotingABI.abi || VotingABI;
      const electionContract = new ethers.Contract(
        electionAddress,
        abi,
        signer
      );

      // Get election details
      const details = await electionContract.getElectionDetails();
      console.log('Election details:', details);

      // Get all candidates
      const candidateCount = await electionContract.candidatesCount();
      const candidatesList = [];
      for (let i = 1; i <= candidateCount; i++) {
        const candidate = await electionContract.getCandidate(i);
        candidatesList.push({
          id: candidate.id.toString(),
          name: candidate.name,
          voteCount: candidate.voteCount.toString()
        });
      }

      setSelectedElectionData({
        address: electionAddress,
        contract: electionContract,
        details: details,
        candidates: candidatesList
      });

      setMessage('✅ Election details loaded!');
    } catch (error) {
      console.error('Error loading election:', error);
      setMessage('❌ Failed to load election: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const castVote = async (candidateId) => {
    try {
      setLoading(true);
      setMessage('Voting...');

      const tx = await selectedElectionData.contract.vote(candidateId);
      await tx.wait();

      setMessage('✅ Vote cast successfully!');
      // Reload election details to update vote counts
      await loadElectionDetails(selectedElectionData.address);
    } catch (error) {
      console.error('Error voting:', error);
      let errorMessage = error.message;
      if (error.message && error.message.includes('Already voted')) {
        errorMessage = 'You have already voted in this election!';
      } else if (error.code === 'ACTION_REJECTED') {
        errorMessage = 'Transaction was rejected by user';
      }
      setMessage('❌ Failed to vote: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  //   return (
  //     <div style={{ padding: '20px', fontFamily: 'Arial', maxWidth: '1200px', margin: '0 auto' }}>
  //       <h1>🗳️ Blockchain Voting System</h1>

  //       <div style={{
  //         backgroundColor: '#f5f5f5',
  //         padding: '20px',
  //         borderRadius: '10px',
  //         marginBottom: '20px'
  //       }}>
  //         {account ? (
  //           <div>
  //             <p>✅ Connected: <strong>{account.slice(0, 6)}...{account.slice(-4)}</strong></p>

  //             <button
  //               onClick={() => loadElections()}
  //               style={{
  //                 padding: '8px 16px',
  //                 backgroundColor: '#2196F3',
  //                 color: 'white',
  //                 border: 'none',
  //                 borderRadius: '5px',
  //                 cursor: 'pointer',
  //                 marginRight: '10px'
  //               }}
  //             >
  //               Refresh Elections
  //             </button>
  //             <button
  //               onClick={() => setShowCreateForm(!showCreateForm)}
  //               style={{
  //                 padding: '8px 16px',
  //                 backgroundColor: '#4CAF50',
  //                 color: 'white',
  //                 border: 'none',
  //                 borderRadius: '5px',
  //                 cursor: 'pointer'
  //               }}
  //             >
  //               + Create Election
  //             </button>
  //           </div>
  //         ) : (
  //           <button
  //             onClick={connectWallet}
  //             disabled={loading}
  //             style={{
  //               padding: '12px 24px',
  //               fontSize: '16px',
  //               backgroundColor: '#4CAF50',
  //               color: 'white',
  //               border: 'none',
  //               borderRadius: '5px',
  //               cursor: 'pointer'
  //             }}
  //           >
  //             {loading ? 'Connecting...' : 'Connect MetaMask'}
  //           </button>
  //         )}
  //       </div>

  //       {message && (
  //         <div style={{
  //           padding: '12px',
  //           backgroundColor: message.includes('✅') ? '#d4edda' : message.includes('❌') ? '#f8d7da' : '#fff3cd',
  //           borderRadius: '5px',
  //           marginBottom: '20px',
  //           color: message.includes('✅') ? '#155724' : message.includes('❌') ? '#721c24' : '#856404'
  //         }}>
  //           {message}
  //         </div>
  //       )}

  //       {showCreateForm && account && (
  //         <div style={{
  //           backgroundColor: '#e3f2fd',
  //           padding: '20px',
  //           borderRadius: '10px',
  //           marginBottom: '20px'
  //         }}>
  //           <h3>Create New Election</h3>
  //           <form onSubmit={createElection}>
  //             <div style={{ marginBottom: '10px' }}>
  //               <input
  //                 type="text"
  //                 placeholder="Election Title"
  //                 value={formData.title}
  //                 onChange={(e) => setFormData({ ...formData, title: e.target.value })}
  //                 required
  //                 style={{ width: '100%', padding: '8px', fontSize: '16px' }}
  //               />
  //             </div>
  //             <div style={{ marginBottom: '10px' }}>
  //               <textarea
  //                 placeholder="Description"
  //                 value={formData.description}
  //                 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
  //                 style={{ width: '100%', padding: '8px', fontSize: '16px' }}
  //               />
  //             </div>
  //             <div style={{ marginBottom: '10px' }}>
  //               <h4>Candidates (minimum 2)</h4>
  //               {formData.candidates.map((candidate, index) => (
  //                 <input
  //                   key={index}
  //                   type="text"
  //                   placeholder={`Candidate ${index + 1}`}
  //                   value={candidate}
  //                   onChange={(e) => {
  //                     const newCandidates = [...formData.candidates];
  //                     newCandidates[index] = e.target.value;
  //                     setFormData({ ...formData, candidates: newCandidates });
  //                   }}
  //                   style={{ width: '100%', padding: '8px', fontSize: '16px', marginBottom: '5px' }}
  //                 />
  //               ))}
  //               <button
  //                 type="button"
  //                 onClick={() => setFormData({ ...formData, candidates: [...formData.candidates, ''] })}
  //                 style={{
  //                   padding: '5px 10px',
  //                   backgroundColor: '#2196F3',
  //                   color: 'white',
  //                   border: 'none',
  //                   borderRadius: '3px',
  //                   cursor: 'pointer',
  //                   marginTop: '5px'
  //                 }}
  //               >
  //                 + Add Candidate
  //               </button>
  //             </div>
  //             <div style={{ marginBottom: '10px' }}>
  //               <label>Start Time: </label>
  //               <input
  //                 type="datetime-local"
  //                 value={formData.startTime}
  //                 onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
  //                 required
  //                 style={{ padding: '8px', fontSize: '16px' }}
  //               />
  //             </div>
  //             <div style={{ marginBottom: '10px' }}>
  //               <label>End Time: </label>
  //               <input
  //                 type="datetime-local"
  //                 value={formData.endTime}
  //                 onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
  //                 required
  //                 style={{ padding: '8px', fontSize: '16px' }}
  //               />
  //             </div>
  //             <button
  //               type="submit"
  //               disabled={loading}
  //               style={{
  //                 padding: '10px 20px',
  //                 backgroundColor: '#4CAF50',
  //                 color: 'white',
  //                 border: 'none',
  //                 borderRadius: '5px',
  //                 cursor: 'pointer',
  //                 fontSize: '16px'
  //               }}
  //             >
  //               {loading ? 'Creating...' : 'Create Election'}
  //             </button>
  //             <button
  //               type="button"
  //               onClick={() => setShowCreateForm(false)}
  //               style={{
  //                 padding: '10px 20px',
  //                 backgroundColor: '#f44336',
  //                 color: 'white',
  //                 border: 'none',
  //                 borderRadius: '5px',
  //                 cursor: 'pointer',
  //                 marginLeft: '10px',
  //                 fontSize: '16px'
  //               }}
  //             >
  //               Cancel
  //             </button>
  //           </form>
  //         </div>
  //       )}

  //       <div>
  //         <h2>Elections ({elections.length})</h2>
  //         {electionMetadata.length === 0 ? (
  //           <p>No elections created yet. Click "Create Election" to start!</p>
  //         ) : (
  //           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
  //             {electionMetadata.map((election) => (
  //               <div key={election.id} style={{
  //                 backgroundColor: '#fff',
  //                 padding: '15px',
  //                 borderRadius: '10px',
  //                 border: '1px solid #ddd',
  //                 boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  //               }}>
  //                 <h4>{election.title}</h4>
  //                 <p style={{ fontSize: '14px', color: '#666' }}>{election.description}</p>
  //                 <p><strong>Starts:</strong> {new Date(election.startTime).toLocaleString()}</p>
  //                 <p><strong>Ends:</strong> {new Date(election.endTime).toLocaleString()}</p>
  //                 <p style={{ fontSize: '12px', color: '#999' }}>
  //                   Contract: {election.contractAddress.slice(0, 6)}...{election.contractAddress.slice(-4)}
  //                 </p>
  //                 <div style={{ marginTop: '10px' }}>
  //                   <button
  //                     onClick={() => handleViewElection(election.contractAddress)}
  //                     style={{
  //                       padding: '6px 12px',
  //                       backgroundColor: '#4CAF50',
  //                       color: 'white',
  //                       border: 'none',
  //                       borderRadius: '3px',
  //                       cursor: 'pointer',
  //                       marginRight: '5px'
  //                     }}
  //                   >
  //                     View & Vote
  //                   </button>
  //                   <button
  //                     onClick={() => {
  //                       const url = `${window.location.origin}/election/${election.contractAddress}`;
  //                       navigator.clipboard.writeText(url);
  //                       alert('Election link copied to clipboard!');
  //                     }}
  //                     style={{
  //                       padding: '6px 12px',
  //                       backgroundColor: '#2196F3',
  //                       color: 'white',
  //                       border: 'none',
  //                       borderRadius: '3px',
  //                       cursor: 'pointer'
  //                     }}
  //                   >
  //                     🔗 Copy Link
  //                   </button>
  //                 </div>
  //               </div>
  //             ))}
  //           </div>
  //         )}
  //       </div>
  //       {showElectionDetail && selectedElectionData && (
  //         <div style={{
  //           marginTop: '20px',
  //           padding: '20px',
  //           backgroundColor: '#f0f0f0',
  //           borderRadius: '10px',
  //           border: '2px solid #4CAF50'
  //         }}>
  //           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  //             <h3>🗳️ Election Details</h3>
  //             <button
  //               onClick={() => {
  //                 setShowElectionDetail(false);
  //                 setSelectedElectionData(null);
  //               }}
  //               style={{
  //                 padding: '8px 16px',
  //                 backgroundColor: '#f44336',
  //                 color: 'white',
  //                 border: 'none',
  //                 borderRadius: '5px',
  //                 cursor: 'pointer'
  //               }}
  //             >
  //               Close
  //             </button>
  //           </div>

  //           <p><strong>Title:</strong> {selectedElectionData.details.title}</p>
  //           <p><strong>Description:</strong> {selectedElectionData.details.description}</p>
  //           <p><strong>Status:</strong> {
  //             selectedElectionData.details.isActive ? '🟢 Active' : '🔴 Ended'
  //           }</p>
  //           <p><strong>Total Votes:</strong> {selectedElectionData.details.totalVotes.toString()}</p>

  //           <h4>Candidates</h4>
  //           {selectedElectionData.candidates.map((candidate) => (
  //             <div key={candidate.id} style={{
  //               backgroundColor: 'white',
  //               padding: '10px',
  //               marginBottom: '10px',
  //               borderRadius: '5px',
  //               display: 'flex',
  //               justifyContent: 'space-between',
  //               alignItems: 'center'
  //             }}>
  //               <span><strong>{candidate.name}</strong> - Votes: {candidate.voteCount}</span>
  //               <button
  //                 onClick={() => castVote(candidate.id)}
  //                 disabled={!selectedElectionData.details.isActive}
  //                 style={{
  //                   padding: '6px 12px',
  //                   backgroundColor: '#4CAF50',
  //                   color: 'white',
  //                   border: 'none',
  //                   borderRadius: '3px',
  //                   cursor: selectedElectionData.details.isActive ? 'pointer' : 'not-allowed',
  //                   opacity: selectedElectionData.details.isActive ? 1 : 0.5
  //                 }}
  //               >
  //                 Vote for {candidate.name}
  //               </button>
  //             </div>
  //           ))}
  //           {/* PUBLISH RESULTS BUTTON */}
  //           {selectedElectionData && selectedElectionData.details.creator === account && (
  //             <button
  //               onClick={async () => {
  //                 try {
  //                   setLoading(true);
  //                   const tx = await selectedElectionData.contract.publishResults();
  //                   await tx.wait();
  //                   setMessage('✅ Results published!');
  //                   await loadElectionDetails(selectedElectionData.address);
  //                 } catch (error) {
  //                   console.error('Error publishing results:', error);
  //                   setMessage('❌ Failed to publish results: ' + error.message);
  //                 } finally {
  //                   setLoading(false);
  //                 }
  //               }}
  //               style={{
  //                 padding: '10px 20px',
  //                 backgroundColor: '#ff9800',
  //                 color: 'white',
  //                 border: 'none',
  //                 borderRadius: '5px',
  //                 cursor: 'pointer',
  //                 marginTop: '15px'
  //               }}
  //             >
  //               📊 Publish Results
  //             </button>
  //           )}
  //         </div>
  //       )}
  //     </div>
  //   );
  // }

  // export default App;


  return (
    <BrowserRouter>
      <div style={{ padding: '20px', fontFamily: 'Arial', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Navigation Bar */}
        <nav style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
          <Link to="/">🏠 Home</Link>
          {user ? (
            <>
              {user.isAdmin && <Link to="/dashboard">📊 Dashboard</Link>}
              <span>👤 {user.username}</span>
              <button
                onClick={() => {
                  // Clear auth
                  localStorage.clear();
                  setUser(null);
                  setAuthToken(null);

                  // 🔥 Clear blockchain state (reset everything)
                  setAccount(null);
                  setElections([]);
                  setElectionMetadata([]);
                  setSelectedElectionData(null);
                  setShowElectionDetail(false);
                  setShowCreateForm(false);
                  setFormData({
                    title: '',
                    description: '',
                    candidates: ['', '', ''],
                    startTime: '',
                    endTime: ''
                  });
                  setMessage('');
                  // ... any other state you have
                }}
                style={{ padding: '5px 10px', cursor: 'pointer' }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>

        <Routes>
          {/* Home route: YOUR EXISTING VOTING UI */}
          <Route path="/" element={
            // ************ PASTE YOUR ENTIRE ORIGINAL JSX HERE ************
            // This is the content that was previously in your return.
            // Copy everything from <h1>🗳️ Blockchain Voting System</h1> down to the final </div>.
            // DO NOT change any of the logic – just paste it inside this element.
            <div style={{ padding: '20px', fontFamily: 'Arial', maxWidth: '1200px', margin: '0 auto' }}>
              <h1>🗳️ Blockchain Voting System</h1>

              <div style={{
                backgroundColor: '#f5f5f5',
                padding: '20px',
                borderRadius: '10px',
                marginBottom: '20px'
              }}>
                {/* === AUTHENTICATION GATE === */}
                {user && authToken ? (
                  // ✅ Logged in – show wallet UI
                  account ? (
                    <div>
                      <p>✅ Connected: <strong>{account.slice(0, 6)}...{account.slice(-4)}</strong></p>

                      <button
                        onClick={() => loadElections()}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          marginRight: '10px'
                        }}
                      >
                        Refresh Elections
                      </button>
                      <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: 'pointer'
                        }}
                      >
                        + Create Election
                      </button>
                    </div>
                  ) : (
                    // Not connected yet – show connect button
                    <button
                      onClick={connectWallet}
                      disabled={loading}
                      style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      {loading ? 'Connecting...' : 'Connect MetaMask'}
                    </button>
                  )
                ) : (
                  // ❌ Not logged in – show login message
                  <p style={{ margin: '10px 0' }}>
                    Please <Link to="/login">login</Link> to connect your wallet and vote.
                  </p>
                )}
              </div>

              {message && (
                <div style={{
                  padding: '12px',
                  backgroundColor: message.includes('✅') ? '#d4edda' : message.includes('❌') ? '#f8d7da' : '#fff3cd',
                  borderRadius: '5px',
                  marginBottom: '20px',
                  color: message.includes('✅') ? '#155724' : message.includes('❌') ? '#721c24' : '#856404'
                }}>
                  {message}
                </div>
              )}

              {showCreateForm && account && (
                <div style={{
                  backgroundColor: '#e3f2fd',
                  padding: '20px',
                  borderRadius: '10px',
                  marginBottom: '20px'
                }}>
                  <h3>Create New Election</h3>
                  <form onSubmit={createElection}>
                    <div style={{ marginBottom: '10px' }}>
                      <input
                        type="text"
                        placeholder="Election Title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                        style={{ width: '100%', padding: '8px', fontSize: '16px' }}
                      />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <textarea
                        placeholder="Description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        style={{ width: '100%', padding: '8px', fontSize: '16px' }}
                      />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <h4>Candidates (minimum 2)</h4>
                      {formData.candidates.map((candidate, index) => (
                        <input
                          key={index}
                          type="text"
                          placeholder={`Candidate ${index + 1}`}
                          value={candidate}
                          onChange={(e) => {
                            const newCandidates = [...formData.candidates];
                            newCandidates[index] = e.target.value;
                            setFormData({ ...formData, candidates: newCandidates });
                          }}
                          style={{ width: '100%', padding: '8px', fontSize: '16px', marginBottom: '5px' }}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, candidates: [...formData.candidates, ''] })}
                        style={{
                          padding: '5px 10px',
                          backgroundColor: '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          marginTop: '5px'
                        }}
                      >
                        + Add Candidate
                      </button>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label>Start Time: </label>
                      <input
                        type="datetime-local"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        required
                        style={{ padding: '8px', fontSize: '16px' }}
                      />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label>End Time: </label>
                      <input
                        type="datetime-local"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        required
                        style={{ padding: '8px', fontSize: '16px' }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '16px'
                      }}
                    >
                      {loading ? 'Creating...' : 'Create Election'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        marginLeft: '10px',
                        fontSize: '16px'
                      }}
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              )}

              <div>
                <h2>Elections ({elections.length})</h2>
                {electionMetadata.length === 0 ? (
                  <p>No elections created yet. Click "Create Election" to start!</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {electionMetadata.map((election) => (
                      <div key={election.id} style={{
                        backgroundColor: '#fff',
                        padding: '15px',
                        borderRadius: '10px',
                        border: '1px solid #ddd',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        <h4>{election.title}</h4>
                        <p style={{ fontSize: '14px', color: '#666' }}>{election.description}</p>
                        <p><strong>Starts:</strong> {new Date(election.startTime).toLocaleString()}</p>
                        <p><strong>Ends:</strong> {new Date(election.endTime).toLocaleString()}</p>
                        <p style={{ fontSize: '12px', color: '#999' }}>
                          Contract: {election.contractAddress.slice(0, 6)}...{election.contractAddress.slice(-4)}
                        </p>
                        <div style={{ marginTop: '10px' }}>
                          <button
                            onClick={() => handleViewElection(election.contractAddress)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#4CAF50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              marginRight: '5px'
                            }}
                          >
                            View & Vote
                          </button>
                          <button
                            onClick={() => {
                              const url = `${window.location.origin}/election/${election.contractAddress}`;
                              navigator.clipboard.writeText(url);
                              alert('Election link copied to clipboard!');
                            }}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#2196F3',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          >
                            🔗 Copy Link
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {showElectionDetail && selectedElectionData && (
                <div style={{
                  marginTop: '20px',
                  padding: '20px',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '10px',
                  border: '2px solid #4CAF50'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>🗳️ Election Details</h3>
                    <button
                      onClick={() => {
                        setShowElectionDetail(false);
                        setSelectedElectionData(null);
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      Close
                    </button>
                  </div>

                  <p><strong>Title:</strong> {selectedElectionData.details.title}</p>
                  <p><strong>Description:</strong> {selectedElectionData.details.description}</p>
                  <p><strong>Status:</strong> {
                    selectedElectionData.details.isActive ? '🟢 Active' : '🔴 Ended'
                  }</p>
                  <p><strong>Total Votes:</strong> {selectedElectionData.details.totalVotes.toString()}</p>

                  <h4>Candidates</h4>
                  {selectedElectionData.candidates.map((candidate) => (
                    <div key={candidate.id} style={{
                      backgroundColor: 'white',
                      padding: '10px',
                      marginBottom: '10px',
                      borderRadius: '5px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span><strong>{candidate.name}</strong> - Votes: {candidate.voteCount}</span>
                      <button
                        onClick={() => castVote(candidate.id)}
                        disabled={!selectedElectionData.details.isActive}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: selectedElectionData.details.isActive ? 'pointer' : 'not-allowed',
                          opacity: selectedElectionData.details.isActive ? 1 : 0.5
                        }}
                      >
                        Vote for {candidate.name}
                      </button>
                    </div>
                  ))}
                  {/* PUBLISH RESULTS BUTTON */}
                  {selectedElectionData && selectedElectionData.details.creator === account && (
                    <button
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const tx = await selectedElectionData.contract.publishResults();
                          await tx.wait();
                          setMessage('✅ Results published!');
                          await loadElectionDetails(selectedElectionData.address);
                        } catch (error) {
                          console.error('Error publishing results:', error);
                          setMessage('❌ Failed to publish results: ' + error.message);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#ff9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        marginTop: '15px'
                      }}
                    >
                      📊 Publish Results
                    </button>
                  )}
                </div>
              )}
            </div>
          } />

          {/* <Route path="/login" element={<Login setAuthToken={setAuthToken} setUser={setUser} />} />
          <Route path="/register" element={<Register setAuthToken={setAuthToken} setUser={setUser} />} />
          <Route path="/dashboard" element={
            user?.isAdmin ? <AdminDashboard /> : <Navigate to="/" />
          } /> */}

          <Route path="/login" element={<Login setAuthToken={setAuthToken} setUser={setUser} />} />
          <Route path="/register" element={<Register setAuthToken={setAuthToken} setUser={setUser} />} />
          <Route path="/dashboard" element={
            user?.isAdmin ? <AdminDashboard /> : <Navigate to="/" />
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
export default App;
