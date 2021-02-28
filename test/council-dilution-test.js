'use strict';

const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('CouncilDilution', () => {
	let dilution;
	let electionHash;
	let proposalHash;
	let nominatedCouncilMembers;
	let voters;
	let nomineesVotedFor;
	let assignedVoteWeights;

	let deployer;
	let caller;
	let memberOne;
	let memberTwo;
	let memberThree;
	let voterOne;
	let voterTwo;
	let voterThree;
	let voterFour;
	let nomineeOne;
	let nomineeTwo;

	let start;

	beforeEach(async () => {
		const Dilution = await ethers.getContractFactory('CouncilDilution');
		dilution = await Dilution.deploy(2);

		[
			deployer,
			caller,
			memberOne,
			memberTwo,
			memberThree,
			voterOne,
			voterTwo,
			voterThree,
			voterFour,
			nomineeOne,
			nomineeTwo,
		] = await ethers.getSigners();

		electionHash = 'QWERTY';
		proposalHash = 'UIOP';
		nominatedCouncilMembers = [memberOne.address, memberTwo.address];
		voters = [voterOne.address, voterTwo.address, voterThree.address, voterFour.address];
		nomineesVotedFor = [
			memberOne.address,
			memberTwo.address,
			nomineeOne.address,
			nomineeTwo.address,
		];
		assignedVoteWeights = [40, 30, 20, 15];

		start = Date.now();
	});

	describe('Deployment', async () => {
		it('should return the initial council seats and proposal period when set', async () => {
			expect(await dilution.numOfSeats()).to.equal(2);
			expect(await dilution.proposalPeriod()).to.equal(259_200); // ~ 2 days in blocks (assuming 15s blocks)
		});
	});

	describe('when logging an election', async () => {
		it('should be successful when called by owner', async () => {
			await expect(
				await dilution.logElection(
					electionHash,
					nominatedCouncilMembers,
					voters,
					nomineesVotedFor,
					assignedVoteWeights
				)
			)
				.to.emit(dilution, 'ElectionLogged')
				.withArgs(
					electionHash,
					nominatedCouncilMembers,
					voters,
					nomineesVotedFor,
					assignedVoteWeights
				);
		});
		it('should only be allowed to be called by owner', async () => {
			await expect(
				dilution
					.connect(caller)
					.logElection(
						electionHash,
						nominatedCouncilMembers,
						voters,
						nomineesVotedFor,
						assignedVoteWeights
					)
			).to.be.revertedWith('Only the contract owner may perform this action');
		});

		it('should fail when the nominatedCouncilMembers array is not equal to the current number of council seats', async () => {
			const assignedVoteWeights = [40, 50, 10, 15];

			nominatedCouncilMembers.push(memberThree.address);

			await expect(
				dilution.logElection(
					electionHash,
					nominatedCouncilMembers,
					voters,
					nomineesVotedFor,
					assignedVoteWeights
				)
			).to.be.revertedWith('invalid number of council members');

			nominatedCouncilMembers.pop();
			nominatedCouncilMembers.pop();

			await expect(
				dilution.logElection(
					electionHash,
					nominatedCouncilMembers,
					voters,
					nomineesVotedFor,
					assignedVoteWeights
				)
			).to.be.revertedWith('invalid number of council members');
		});

		it('should fail if voters is an empty array', async () => {
			await expect(
				dilution.logElection(
					electionHash,
					nominatedCouncilMembers,
					[],
					nomineesVotedFor,
					assignedVoteWeights
				)
			).to.be.revertedWith('empty voters array provided');
		});

		it('should fail if nomineesVotedFor is an empty array', async () => {
			await expect(
				dilution.logElection(electionHash, nominatedCouncilMembers, voters, [], assignedVoteWeights)
			).to.be.revertedWith('empty nomineesVotedFor array provided');
		});

		it('should fail if assignedVoteWeights is an empty array', async () => {
			await expect(
				dilution.logElection(electionHash, nominatedCouncilMembers, voters, nomineesVotedFor, [])
			).to.be.revertedWith('empty assignedVoteWeights array provided');
		});

		it('should fail if the election hash is not unique', async () => {
			await dilution.logElection(
				electionHash,
				nominatedCouncilMembers,
				voters,
				nomineesVotedFor,
				assignedVoteWeights
			);
			await expect(
				dilution.logElection(
					electionHash,
					nominatedCouncilMembers,
					voters,
					nomineesVotedFor,
					assignedVoteWeights
				)
			).to.be.revertedWith('election hash already exists');
		});

		it('should return the correct latestElectionHash', async () => {
			await dilution.logElection(
				electionHash,
				nominatedCouncilMembers,
				voters,
				nomineesVotedFor,
				assignedVoteWeights
			);

			const latestElectionHash = await dilution.latestElectionHash();

			expect(latestElectionHash).to.equal(electionHash);
		});

		it('should return the correct latestDelegatedVoteWeight for a pair of addresses', async () => {
			await dilution.logElection(
				electionHash,
				nominatedCouncilMembers,
				voters,
				nomineesVotedFor,
				assignedVoteWeights
			);
			let delegatedVoteWeight;

			delegatedVoteWeight = await dilution.latestDelegatedVoteWeight(
				voterOne.address,
				memberOne.address
			);

			expect(delegatedVoteWeight).to.equal(40);

			delegatedVoteWeight = await dilution.latestDelegatedVoteWeight(
				voterTwo.address,
				memberTwo.address
			);

			expect(delegatedVoteWeight).to.equal(30);

			delegatedVoteWeight = await dilution.latestDelegatedVoteWeight(
				voterOne.address,
				nomineeOne.address
			);

			expect(delegatedVoteWeight).to.equal(0);
		});

		it('should return the correct latestVotingWeight for a pair of addresses', async () => {
			await dilution.logElection(
				electionHash,
				nominatedCouncilMembers,
				voters,
				nomineesVotedFor,
				assignedVoteWeights
			);

			let latestVotingWeight;

			latestVotingWeight = await dilution.latestVotingWeight(memberOne.address);

			expect(latestVotingWeight).to.equal(40);

			latestVotingWeight = await dilution.latestVotingWeight(memberTwo.address);

			expect(latestVotingWeight).to.equal(30);

			latestVotingWeight = await dilution.latestVotingWeight(nomineeOne.address);

			expect(latestVotingWeight).to.equal(20);

			latestVotingWeight = await dilution.latestVotingWeight(voterOne.address);

			expect(latestVotingWeight).to.equal(0);
		});
	});

	describe('when logging a proposal', () => {
		let proposalPeriod;
		let end;

		beforeEach(async () => {
			proposalPeriod = await dilution.proposalPeriod();

			const startBN = ethers.BigNumber.from(start);

			end = startBN.add(proposalPeriod);
		});

		it('should successfully log a proposal and emit event', async () => {
			await expect(await dilution.logProposal(proposalHash, start))
				.to.emit(dilution, 'ProposalLogged')
				.withArgs(proposalHash, start, end);
		});

		it('should be able to be called by non-owner', async () => {
			await expect(await dilution.connect(caller).logProposal(proposalHash, start))
				.to.emit(dilution, 'ProposalLogged')
				.withArgs(proposalHash, start, end);
		});

		it('should fail if proposal hash is not unique', async () => {
			await dilution.logProposal(proposalHash, start);

			await expect(dilution.logProposal(proposalHash, start)).to.be.revertedWith(
				'proposal hash is not unique'
			);
		});

		it('should fail if proposal hash is empty', async () => {
			await expect(dilution.logProposal('', start)).to.be.revertedWith(
				'proposal hash must not be empty'
			);
		});
	});

	describe('when diluting', () => {});
});
