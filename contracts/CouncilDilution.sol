//SPDX-License-Identifier: Unlicense
pragma solidity ^0.5.16;

import "hardhat/console.sol";
import "./Owned.sol";

contract CouncilDilution is Owned {
    /* SCCP configurable values */

    //@notice How many seats the council should have
    uint public numOfSeats;

    uint public proposalPeriod;

    string public latestElectionHash;

    struct ElectionLog {
        string proposalHash;
        mapping(address => uint256) votesForMember;
        mapping(address => bool) councilMembers;
    }

    struct ProposalLog {
        string proposalHash;
        uint start;
        uint end;
        bool exist;
    }

    struct DilutionReceipt {
        bool exist;
        string proposalHash;
        address memberDiluted;
        uint totalDilutionValue;
        address[] dilutors;
        mapping(address => uint) voterDilutions;
    }

    mapping(string => ElectionLog) electionHashToLog;
    //@notice Given a voter and a council member, check their weight
    mapping(address => mapping(address => uint256)) latestDelegatedVoteWeight;
    mapping(address => uint256) latestVotingWeight;

    mapping(string => ProposalLog) proposalHashToLog;
    //@notice Given a proposal hash and a council member, check if they have been diluted
    mapping(string => mapping(address => DilutionReceipt)) proposalHashToDilution;

    event ElectionLogged(
        string electionHash,
        address[] nominatedCouncilMembers,
        address[] voters,
        address[] nomineesVotedFor,
        uint256[] assignedVoteWeights
    );

    event ProposalLogged(string proposalHash, uint start, uint end);

    event DilutionCreated(string proposalHash, address memberDiluted, uint totalDilutionValue);

    event DilutionReverted(string proposalHash, address memberDiluted, uint totalDilutionValue);

    event SeatsModified(uint previousNumberOfSeats, uint newNumberOfSeats);

    event ProposalPeriodModified(uint previousProposalPeriod, uint newProposalPeriod);

    constructor(uint256 _numOfSeats) public Owned(msg.sender) {
        numOfSeats = _numOfSeats;
        proposalPeriod = 3 days;
    }

    //@notice
    function logElection(
        string memory electionHash,
        address[] memory nominatedCouncilMembers,
        address[] memory voters,
        address[] memory nomineesVotedFor,
        uint256[] memory assignedVoteWeights
    ) public returns (string memory) {
        require(nominatedCouncilMembers.length == numOfSeats - 1, "invalid number of council members");
        require(voters.length > 0, "empty voters array provided");
        require(nomineesVotedFor.length > 0, "empty nomineesVotedFor array provided");
        require(assignedVoteWeights.length > 0, "empty assignedVoteWeights array provided");

        ElectionLog memory newElectionLog = ElectionLog(electionHash);

        electionHashToLog[electionHash] = newElectionLog;

        for (uint256 i = 0; i < voters.length; i++) {
            latestDelegatedVoteWeight[voters[i]][nomineesVotedFor[i]] = assignedVoteWeights[i];
            latestVotingWeight[nomineesVotedFor[i]] = assignedVoteWeights[i];
        }

        for (uint256 j = 0; j < nominatedCouncilMembers.length; j++) {
            electionHashToLog[electionHash].votesForMember[nominatedCouncilMembers[j]] = latestVotingWeight[
                nominatedCouncilMembers[j]
            ];
            electionHashToLog[electionHash].councilMembers[nominatedCouncilMembers[j]] = true;
        }

        latestElectionHash = electionHash;

        emit ElectionLogged(electionHash, nominatedCouncilMembers, voters, nomineesVotedFor, assignedVoteWeights);

        return electionHash;
    }

    function logProposal(
        string memory proposalHash,
        uint start,
        uint end
    ) public returns (string memory) {
        ProposalLog memory newProposalLog = ProposalLog(proposalHash, start, end, true);

        proposalHashToLog[proposalHash] = newProposalLog;

        emit ProposalLogged(proposalHash, start, end);

        return proposalHash;
    }

    function dilute(string memory proposalHash, address memberToDilute) public {
        require(msg.sender != address(0), "sender must be a valid address");
        require(memberToDilute != address(0), "member to dilute must be a valid address");
        require(
            electionHashToLog[latestElectionHash].councilMembers[memberToDilute],
            "member to dilute must be a nominated council member"
        );
        require(proposalHashToLog[proposalHash].exist, "proposal does not exist");
        require(
            latestDelegatedVoteWeight[msg.sender][memberToDilute] > 0,
            "sender has not delegated voting weight for member"
        );
        require(block.timestamp > proposalHashToLog[proposalHash].start, "proposal voting has not started");
        require(block.timestamp < proposalHashToLog[proposalHash].end, "proposal voting has ended");

        if (proposalHashToDilution[proposalHash][memberToDilute].exist) {
            DilutionReceipt storage receipt = proposalHashToDilution[proposalHash][memberToDilute];
            receipt.dilutors.push(msg.sender);
            receipt.voterDilutions[msg.sender] = latestVotingWeight[msg.sender];

            receipt.totalDilutionValue = receipt.totalDilutionValue + latestVotingWeight[msg.sender];

            emit DilutionCreated(proposalHash, receipt.memberDiluted, receipt.totalDilutionValue);
        } else {
            address[] memory dilutors;
            DilutionReceipt memory newDilutionReceipt = DilutionReceipt(true, proposalHash, memberToDilute, 0, dilutors);

            proposalHashToDilution[proposalHash][memberToDilute] = newDilutionReceipt;

            proposalHashToDilution[proposalHash][memberToDilute].dilutors.push(msg.sender);
            proposalHashToDilution[proposalHash][memberToDilute].voterDilutions[msg.sender] = latestVotingWeight[msg.sender];

            proposalHashToDilution[proposalHash][memberToDilute].totalDilutionValue = latestVotingWeight[msg.sender];

            emit DilutionCreated(proposalHash, newDilutionReceipt.memberDiluted, newDilutionReceipt.totalDilutionValue);
        }
    }

    function invalidateDilution(string memory proposalHash, address memberToUndilute) public {
        require(msg.sender != address(0), "sender must be a valid address");
        require(memberToUndilute != address(0), "member to undilute must be a valid address");
        require(proposalHashToLog[proposalHash].exist, "proposal does not exist");
        require(
            proposalHashToDilution[proposalHash][memberToUndilute].totalDilutionValue > 0,
            "dilution receipt does not exist for this member and proposal hash"
        );

        DilutionReceipt storage receipt = proposalHashToDilution[proposalHash][memberToUndilute];

        uint originalDilutionValue = receipt.voterDilutions[msg.sender];

        for (uint i = 0; i < receipt.dilutors.length; i++) {
            if (receipt.dilutors[i] == msg.sender) {
                delete receipt.dilutors[i];
                break;
            }
        }
        receipt.voterDilutions[msg.sender] = 0;
        receipt.totalDilutionValue = receipt.totalDilutionValue - originalDilutionValue;

        emit DilutionReverted(proposalHash, receipt.memberDiluted, receipt.totalDilutionValue);
    }

    // Views
    function getDilutedWeightForProposal(string memory proposalHash, address councilMember) public view returns (uint) {
        require(proposalHashToLog[proposalHash].exist, "proposal does not exist");
        require(
            electionHashToLog[latestElectionHash].councilMembers[councilMember],
            "address must be a nominated council member"
        );

        uint originalWeight = electionHashToLog[latestElectionHash].votesForMember[councilMember];
        uint penaltyValue = proposalHashToDilution[proposalHash][councilMember].totalDilutionValue;

        return (originalWeight / penaltyValue) / originalWeight;
    }

    // Restricted functions

    function modifySeats(uint _numOfSeats) public onlyOwner() {
        require(_numOfSeats > 0, "number of seats must be greater than zero");
        uint oldNumOfSeats = numOfSeats;
        numOfSeats = _numOfSeats;

        emit SeatsModified(oldNumOfSeats, numOfSeats);
    }

    function modifyProposalPeriod(uint _proposalPeriod) public onlyOwner() {
        uint oldProposalPeriod = proposalPeriod;
        proposalPeriod = _proposalPeriod;

        emit SeatsModified(oldProposalPeriod, proposalPeriod);
    }
}
