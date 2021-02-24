//SPDX-License-Identifier: Unlicense
pragma solidity ^0.5.16;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CouncilDilution is Ownable {
    /* SCCP configurable values */

    //@notice How many seats the council should have
    uint public numOfSeats;

    uint public proposalPeriod;

    string public latestElectionHash;

    struct ElectionLog {
        string proposalHash;
        address[] councilMembers;
        mapping(address => uint256) votesForMember;
    }

    struct ProposalLog {
        string proposalHash;
        uint start;
        uint end;
    }

    struct DilutionReceipt {
        string proposalHash;
        address memberDiluted;
        address[] dilutors;
        mapping(address => uint) voterDilutions;
        uint totalDilutionValue;
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

    event DilutionCreated(string proposalHash, DilutionReceipt receipt);

    event DilutionReverted(string proposalHash, DilutionReceipt receipt);

    event SeatsModified(uint previousNumberOfSeats, uint newNumberOfSeats);

    event ProposalPeriodModified(uint previousProposalPeriod, uint newProposalPeriod);

    constructor(uint256 _numOfSeats) public {
        numOfSeats = _numOfSeats;
        proposalPeriod = 3 days;
        transferOwnership(msg.sender);
    }

    //@notice
    function logElection(
        string memory electionHash,
        address[] memory nominatedCouncilMembers,
        address[] memory voters,
        address[] memory nomineesVotedFor,
        uint256[] memory assignedVoteWeights
    ) public returns (string memory) {
        require(nominatedCouncilMembers.length == _numOfSeats - 1, "invalid number of council members");
        require(voters.length > 0, "empty voters array provided");
        require(nomineesVotedFor.length > 0, "empty nomineesVotedFor array provided");
        require(assignedVoteWeights.length > 0, "empty assignedVoteWeights array provided");

        ElectionLog memory newElectionLog = ElectionLog(proposalHash, nominatedCouncilMembers);

        electionHashToLog[electionHash] = newElectionLog;

        for (uint256 i = 0; i < voters.length; i++) {
            latestDelegatedVoteWeight[voters[i]][nomineesVotedFor[i]] = assignedVoteWeights[i];
            latestVotingWeight[nomineesVotedFor[i]] = assignedVoteWeights[i];
        }

        for (uint256 j = 0; j < nominatedCouncilMembers.length; j++) {
            electionHashToLog[electionHash].votesForMember[nominatedCouncilMembers[j]] = latestVotingWeight[
                nominatedCouncilMembers[j]
            ];
        }

        latestElectionHash = electionHash;

        emit ElectionLogged(electionHash, nominatedCouncilMembers, voters, nomineesVotedFor, assignedVoteWeights);

        return electionHash;
    }

    function logProposal(
        string memory proposalHash,
        uint start,
        uint end
    ) returns (string memory) {
        ProposalLog newProposalLog = ProposalLog(proposalHash, start, end);

        proposalHashToLog[proposalHash] = newProposalLog;

        emit ProposalLogged(proposalHash, start, end);

        return proposalHash;
    }

    function dilute(string memory proposalHash, address memory memberToDilute) public {
        require(msg.sender != address(0), "sender must be a valid address");
        require(memberToDilute != address(0), "member to dilute must be a valid address");
        require(
            electionHashToLog[latestElectionHash].votesForMember[memberToDilute],
            "member to dilute must be a nominated council member"
        );
        require(proposalHashToLog[proposalHash], "proposal does not exist");
        require(latestDelegatedVoteWeight[msg.sender][memberToDilute], "sender has not delegated voting weight for member");
        require(block.now > proposalHashToLog[proposalHash].start, "proposal voting has not started");
        require(block.now < proposalHashToLog[proposalHash].end, "proposal voting has ended");

        if (proposalHashToDilution[proposalHash][memberToDilute]) {
            DilutionReceipt receipt = proposalHashToDilution[proposalHash][memberToDilute];
            receipt.dilutors.push(msg.sender);
            receipt.voterDilutions[msg.sender] = latestVotingWeight[msg.sender];

            receipt.totalDilutionValue = receipt.totalDilutionValue + latestVotingWeight[msg.sender];

            emit DilutionCreated(proposalHash, receipt);
        } else {
            DilutionReceipt memory newDilutionReceipt = DilutionReceipt(proposalHash, memberToDilute);
            proposalHashToDilution[proposalHash][memberToDilute] = newDilutionReceipt;
            proposalHashToDilution[proposalHash][memberToDilute].dilutors.push(msg.sender);
            proposalHashToDilution[proposalHash][memberToDilute].voterDilutions[msg.sender] = latestVotingWeight[msg.sender];

            receipt.totalDilutionValue = latestVotingWeight[msg.sender];

            emit DilutionCreated(proposalHash, newDilutionReceipt);
        }
    }

    function invalidateDilution(string memory proposalHash, address memory memberToUndilute) public {
        require(msg.sender != address(0), "sender must be a valid address");
        require(memberToUndilute != address(0), "member to undilute must be a valid address");
        require(proposalHashToLog[proposalHash], "proposal does not exist");
        require(
            proposalHashToDilution[proposalHash][memberToDilute],
            "dilution receipt does not exist for this member and proposal hash"
        );

        DilutionReceipt receipt = proposalHashToDilution[proposalHash][memberToDilute];

        uint originalDilutionValue = receipt.voterDilutions[msg.sender];

        delete receipt.dilutors[msg.sender];
        receipt.voterDilutions[msg.sender] = 0;
        receipt.totalDilutionValue = receipt.totalDilutionValue - originalDilutionValue;

        emit DilutionReverted(proposalHash, receipt);
    }

    // Views
    function getDilutedWeightForProposal(string memory proposalHash, address councilMember) view returns (uint) {
        require(proposalHashToLog[proposalHash], "proposal does not exist");
        require(
            electionHashToLog[latestElectionHash].votesForMember[councilMember],
            "address must be a nominated council member"
        );

        uint originalWeight = electionHashToLog[latestElectionHash].votesForMember[councilMember];
        uint penaltyValue = proposalHashToDilution[proposalHash][memberToDilute].totalDilutionValue;

        return (originalWeight / penaltyValue) / originalWeight;
    }

    // Restricted functions

    function modifySeats(uint _numOfSeats) public onlyOwner() returns (bool) {
        require(numberOfSeats > 0, "number of seats must be greater than zero");
        uint oldNumOfSeats = currentNumOfSeats;
        numOfSeats = _numOfSeats;

        emit SeatsModified(oldNumOfSeats, numOfSeats);
    }

    function modifyProposalPeriod(uint _proposalPeriod) {
        uint oldProposalPeriod = proposalPeriod;
        proposalPeriod = _proposalPeriod;

        emit SeatsModified(oldProposalPeriod, proposalPeriod);
    }
}
