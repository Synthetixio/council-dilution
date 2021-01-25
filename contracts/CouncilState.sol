//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

contract CouncilState {

  /* SCCP configurable values */

  //@notice How long the council epoch is set to
  uint public currentCouncilEpoch;
  //@notice How many seats the council should have
  uint public currentNumOfSeats;

  struct Result {
    //@notice The id of the election, the latest id being the most recent
    uint electionId;
    //@notice The number of seats to be voted in by this election
    uint numOfSeats;
    //@notice Maps the council members to their total votes
    mapping(address => uint) councillorToVotes;
    //@notice Maps each voter to their contributed weight and who they voted for
    mapping(address => Receipt) receipts;
  }

  struct Receipt {
    //@notice Accessor used to check if a voter has voted for a particular result
    bool hasVoted;
    //@notice How much vote weight the voter contributed for a particular result
    uint256 voteWeight;
    //@notice The address in which the voter has voted for
    address supportFor;
  }

  struct Proposals {
    bool hasDilutions;
    uint proposalHash;
    mapping(address => Dilution) dilutions;
  }

  struct Dilution {
    //@notice Accessor for checking if a dilution exist for particular address
    bool hasDiluted;
    //@notice The address which has actioned a dilution event
    address dilutor;
    //@notice The vote weight that the dilutor has impacted by
    uint voteWeight;
    //@notice The councillor who has been diluted
    address councillor;
  }

  // Store election id to results
  mapping(uint => Result) resultsOfElection;
  // Store proposals that have a dilution event by hash
  mapping(uint => Proposals) proposals;

  constructor(uint _beginningEpoch, uint _beginningNumOfSeats) {
    currentCouncilEpoch = _beginningEpoch;
    currentNumOfSeats = _beginningNumOfSeats;
  }

}
