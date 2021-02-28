//SPDX-License-Identifier: Unlicense
pragma solidity ^0.5.16;

import "hardhat/console.sol";
import "./Owned.sol";

/// @title A contract that allows for the dilution of Spartan Council voting weights
/// @author @andytcf
/// @notice This is intended to be used on the Optimistic L2 network
contract CouncilDilution is Owned {
    /* SCCP configurable values */

    // @notice How many seats there currently are on the Spartan Council
    uint public numOfSeats;

    // @notice The length of a proposal (SCCP/SIP) voting period
    uint public proposalPeriod;

    /* Global variables */

    // @notice The ipfs hash of the latest Spartan Council election proposal
    string public latestElectionHash;

    struct ElectionLog {
        // @notice The ipfs hash of a particular Spartan Council election proposal
        string electionHash;
        // @notice A mapping of the votes allocated to each of the Spartan Council members
        mapping(address => uint256) votesForMember;
        // @notice A mapping to check whether an address was an elected Council member in this election
        mapping(address => bool) councilMembers;
        // @notice The timestamp which the election log was stored
        uint created;
        bool exist;
    }

    struct ProposalLog {
        // @notice The ipfs hash of a particular SCCP/SIP proposal
        string proposalHash;
        //  @notice The timestamp which the voting period begins
        uint start;
        // @notice The timestamp which the voting period of the proposal ends
        uint end;
        // @notice A boolean value to check whether a proposal log exists
        bool exist;
    }

    struct DilutionReceipt {
        // @notice The ipfs hash of the proposal which the dilution happened on
        string proposalHash;
        // @notice The address of the council member diluted
        address memberDiluted;
        // @notice The total amount in which the council member was diluted by
        uint totalDilutionValue;
        // @notice A list of dilutors
        address[] dilutors;
        // @notice A mapping to show the value of dilution per dilutor
        mapping(address => uint) voterDilutions;
        // @notice A flag value to check whether a dilution exist
        bool exist;
    }

    // @notice Given a election hash, return the ElectionLog struct associated
    mapping(string => ElectionLog) electionHashToLog;

    // @notice Given a voter address and a council member address, return the delegated vote weight for the most recent Spartan Council election
    mapping(address => mapping(address => uint256)) public latestDelegatedVoteWeight;

    // @notice Given a council member address, return the total delegated vote weight for the most recent Spartan Council election
    mapping(address => uint256) public latestVotingWeight;

    // @notice Given a proposal hash (SCCP/SIP), return the ProposalLog struct associated
    mapping(string => ProposalLog) proposalHashToLog;

    // @notice Given a proposal hash and a council member, return the DilutionReceipt if it exists
    mapping(string => mapping(address => DilutionReceipt)) proposalHashToMemberDilution;

    /* Events */

    // @notice An event emitted when a new ElectionLog is created
    event ElectionLogged(
        string electionHash,
        address[] nominatedCouncilMembers,
        address[] voters,
        address[] nomineesVotedFor,
        uint256[] assignedVoteWeights
    );

    // @notice An event emitted when a new ProposalLog is created
    event ProposalLogged(string proposalHash, uint start, uint end);

    // @notice An event emitted when a new DilutionReceipt is created
    event DilutionCreated(string proposalHash, address memberDiluted, uint totalDilutionValue);

    // @notice An event emitted when a DilutionReceipt is modified
    event DilutionModified(string proposalHash, address memberDiluted, uint totalDilutionValue);

    // @notice An event emitted when the number of council seats is modified
    event SeatsModified(uint previousNumberOfSeats, uint newNumberOfSeats);

    // @notice An event emitted when the proposal period is modified
    event ProposalPeriodModified(uint previousProposalPeriod, uint newProposalPeriod);

    /* */

    // @notice Initialises the contract with a X number of council seats and a proposal period of 3 days
    constructor(uint256 _numOfSeats) public Owned(msg.sender) {
        numOfSeats = _numOfSeats;
        proposalPeriod = 3 days;
    }

    /* Mutative Functions */

    // @notice A function to create a new ElectionLog, this is called to record the result of a Spartan Council election
    // @param electionHash The ipfs hash of the Spartan Council election proposal to log
    // @param nominatedCouncilMembers The array of the successful Spartan Council nominees addresses, must be the same length as the numOfSeats
    // @param voters An ordered array of all the voter's addresses corresponding to `nomineesVotedFor`, `assignedVoteWeights`
    // @param nomineesVotedFor An ordered array of all the nominee address that received votes corresponding to `voters`, `assignedVoteWeights`
    // @param assignedVoteWeights An ordered array of the voting weights corresponding to `voters`, `nomineesVotedFor`
    function logElection(
        string memory electionHash,
        address[] memory nominatedCouncilMembers,
        address[] memory voters,
        address[] memory nomineesVotedFor,
        uint256[] memory assignedVoteWeights
    ) public onlyOwner() returns (string memory) {
        require(bytes(electionHash).length > 0, "empty election hash provided");
        require(!electionHashToLog[electionHash].exist, "election hash already exists");
        require(voters.length > 0, "empty voters array provided");
        require(nomineesVotedFor.length > 0, "empty nomineesVotedFor array provided");
        require(assignedVoteWeights.length > 0, "empty assignedVoteWeights array provided");
        require(nominatedCouncilMembers.length == numOfSeats, "invalid number of council members");

        ElectionLog memory newElectionLog = ElectionLog(electionHash, now, true);

        electionHashToLog[electionHash] = newElectionLog;

        // store the voting history for calculating the allocated voting weights
        for (uint256 i = 0; i < voters.length; i++) {
            latestDelegatedVoteWeight[voters[i]][nomineesVotedFor[i]] = assignedVoteWeights[i];
            latestVotingWeight[nomineesVotedFor[i]] = assignedVoteWeights[i];
        }

        // store the total weight of each successful council member
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

    // @notice A function to created a new ProposalLog, this is called to record SCCP/SIPS created and allow for dilution to occur per proposal.
    function logProposal(string memory proposalHash, uint start) public returns (string memory) {
        require(!proposalHashToLog[proposalHash].exist, "proposal hash is not unique");
        require(bytes(proposalHash).length > 0, "proposal hash must not be empty");

        uint end = start + proposalPeriod;

        ProposalLog memory newProposalLog = ProposalLog(proposalHash, start, end, true);

        proposalHashToLog[proposalHash] = newProposalLog;

        emit ProposalLogged(proposalHash, start, end);

        return proposalHash;
    }

    // @notice A function to dilute a council member's voting weight for a particular proposal
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

        if (proposalHashToMemberDilution[proposalHash][memberToDilute].exist) {
            DilutionReceipt storage receipt = proposalHashToMemberDilution[proposalHash][memberToDilute];
            receipt.dilutors.push(msg.sender);
            receipt.voterDilutions[msg.sender] = latestVotingWeight[msg.sender];

            receipt.totalDilutionValue = receipt.totalDilutionValue + latestVotingWeight[msg.sender];

            emit DilutionCreated(proposalHash, receipt.memberDiluted, receipt.totalDilutionValue);
        } else {
            address[] memory dilutors;
            DilutionReceipt memory newDilutionReceipt = DilutionReceipt(proposalHash, memberToDilute, 0, dilutors, true);

            proposalHashToMemberDilution[proposalHash][memberToDilute] = newDilutionReceipt;

            proposalHashToMemberDilution[proposalHash][memberToDilute].dilutors.push(msg.sender);
            proposalHashToMemberDilution[proposalHash][memberToDilute].voterDilutions[msg.sender] = latestVotingWeight[
                msg.sender
            ];

            proposalHashToMemberDilution[proposalHash][memberToDilute].totalDilutionValue = latestVotingWeight[msg.sender];

            emit DilutionCreated(proposalHash, newDilutionReceipt.memberDiluted, newDilutionReceipt.totalDilutionValue);
        }
    }

    // @notice A function that allows a voter to undo a dilution
    function invalidateDilution(string memory proposalHash, address memberToUndilute) public {
        require(msg.sender != address(0), "sender must be a valid address");
        require(memberToUndilute != address(0), "member to undilute must be a valid address");
        require(proposalHashToLog[proposalHash].exist, "proposal does not exist");
        require(
            proposalHashToMemberDilution[proposalHash][memberToUndilute].totalDilutionValue > 0,
            "dilution receipt does not exist for this member and proposal hash"
        );

        DilutionReceipt storage receipt = proposalHashToMemberDilution[proposalHash][memberToUndilute];

        uint originalDilutionValue = receipt.voterDilutions[msg.sender];

        for (uint i = 0; i < receipt.dilutors.length; i++) {
            if (receipt.dilutors[i] == msg.sender) {
                delete receipt.dilutors[i];
                break;
            }
        }
        receipt.voterDilutions[msg.sender] = 0;
        receipt.totalDilutionValue = receipt.totalDilutionValue - originalDilutionValue;

        emit DilutionModified(proposalHash, receipt.memberDiluted, receipt.totalDilutionValue);
    }

    /* Views */

    // @notice A view function that calculates the council member voting weight for a proposal after any dilution penalties
    function getDilutedWeightForProposal(string memory proposalHash, address councilMember) public view returns (uint) {
        require(proposalHashToLog[proposalHash].exist, "proposal does not exist");
        require(
            electionHashToLog[latestElectionHash].councilMembers[councilMember],
            "address must be a nominated council member"
        );

        uint originalWeight = electionHashToLog[latestElectionHash].votesForMember[councilMember];
        uint penaltyValue = proposalHashToMemberDilution[proposalHash][councilMember].totalDilutionValue;

        return (originalWeight / penaltyValue) / originalWeight;
    }

    /* Restricted Functions */

    // @notice A function that can only be called by the owner that changes the number of seats on the Spartan Council
    function modifySeats(uint _numOfSeats) public onlyOwner() {
        require(_numOfSeats > 0, "number of seats must be greater than zero");
        uint oldNumOfSeats = numOfSeats;
        numOfSeats = _numOfSeats;

        emit SeatsModified(oldNumOfSeats, numOfSeats);
    }

    // @notice A function that can only be called by the owner that changes the proposal voting period length
    function modifyProposalPeriod(uint _proposalPeriod) public onlyOwner() {
        uint oldProposalPeriod = proposalPeriod;
        proposalPeriod = _proposalPeriod;

        emit SeatsModified(oldProposalPeriod, proposalPeriod);
    }
}
