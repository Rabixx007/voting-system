// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Voting {
    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }
    
    struct Voter {
        bool hasVoted;
        uint256 votedCandidateId;
    }
    
    struct Election {
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        bool resultsPublished;
        address creator;
        uint256 totalVotes;
    }
    
    address public admin;
    Election public election;
    mapping(uint256 => Candidate) public candidates;
    mapping(address => Voter) public voters;
    uint256 public candidatesCount;
    
    event Voted(address indexed voter, uint256 candidateId);
    event ElectionCreated(string title, uint256 startTime, uint256 endTime);
    event ResultsPublished(uint256 totalVotes);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this");
        _;
    }
    
    modifier electionActive() {
        require(block.timestamp >= election.startTime, "Election not started");
        require(block.timestamp <= election.endTime, "Election ended");
        require(election.isActive, "Election is inactive");
        _;
    }
    
    constructor(
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime,
        string[] memory _candidateNames
    ) {
        require(_startTime > block.timestamp, "Start time must be in future");
        require(_endTime > _startTime, "End time must be after start time");
        require(_candidateNames.length >= 2, "At least 2 candidates required");
        
        admin = msg.sender;
        
        election = Election({
            title: _title,
            description: _description,
            startTime: _startTime,
            endTime: _endTime,
            isActive: true,
            resultsPublished: false,
            creator: msg.sender,
            totalVotes: 0
        });
        
        for (uint256 i = 0; i < _candidateNames.length; i++) {
            candidatesCount++;
            candidates[candidatesCount] = Candidate({
                id: candidatesCount,
                name: _candidateNames[i],
                voteCount: 0
            });
        }
        
        emit ElectionCreated(_title, _startTime, _endTime);
    }
    
    function vote(uint256 _candidateId) external electionActive {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate");
        require(!voters[msg.sender].hasVoted, "Already voted");
        
        voters[msg.sender].hasVoted = true;
        voters[msg.sender].votedCandidateId = _candidateId;
        candidates[_candidateId].voteCount++;
        election.totalVotes++;
        
        emit Voted(msg.sender, _candidateId);
    }
    
    function publishResults() external onlyAdmin {
        require(!election.resultsPublished, "Results already published");
        require(block.timestamp > election.endTime, "Election not ended");
        
        election.resultsPublished = true;
        election.isActive = false;
        
        emit ResultsPublished(election.totalVotes);
    }
    
    function getCandidate(uint256 _id) external view returns (Candidate memory) {
        return candidates[_id];
    }
    
    function getVoter(address _voter) external view returns (Voter memory) {
        return voters[_voter];
    }
    
    function getElectionDetails() external view returns (Election memory) {
        return election;
    }
    
    function getAllCandidates() external view returns (Candidate[] memory) {
        Candidate[] memory allCandidates = new Candidate[](candidatesCount);
        for (uint256 i = 1; i <= candidatesCount; i++) {
            allCandidates[i - 1] = candidates[i];
        }
        return allCandidates;
    }
}
