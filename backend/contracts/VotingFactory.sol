// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Voting.sol";

contract VotingFactory {
    address[] public elections;
    mapping(address => address[]) public userElections;
    
    event ElectionCreated(address indexed electionAddress, address indexed creator, string title);
    
    function createElection(
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime,
        string[] memory _candidateNames
    ) external returns (address) {
        Voting newElection = new Voting(
            _title,
            _description,
            _startTime,
            _endTime,
            _candidateNames
        );
        
        address electionAddress = address(newElection);
        elections.push(electionAddress);
        userElections[msg.sender].push(electionAddress);
        
        emit ElectionCreated(electionAddress, msg.sender, _title);
        
        return electionAddress;
    }
    
    function getElections() external view returns (address[] memory) {
        return elections;
    }
    
    function getUserElections(address _user) external view returns (address[] memory) {
        return userElections[_user];
    }
    
    function getElectionCount() external view returns (uint256) {
        return elections.length;
    }
}
