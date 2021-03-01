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
	let voterFive;
	let nomineeOne;
	let nomineeTwo;

	let start;

	let INVALID_PROPOSAL_HASH;

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
			voterFive,
			nomineeOne,
			nomineeTwo,
		] = await ethers.getSigners();

		electionHash = 'QWERTY';
		proposalHash = 'UIOP';
		INVALID_PROPOSAL_HASH = 'INVALID_PROPOSAL';

		nominatedCouncilMembers = [memberOne.address, memberTwo.address];
		voters = [
			voterOne.address,
			voterTwo.address,
			voterThree.address,
			voterFour.address,
			voterFive.address,
		];
		nomineesVotedFor = [
			memberOne.address,
			memberTwo.address,
			nomineeOne.address,
			nomineeTwo.address,
			memberOne.address,
		];
		assignedVoteWeights = [40, 30, 20, 15, 10];

		start = Math.round(new Date().getTime() / 1000);
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

		it('should fail if the election hash is empty', async () => {
			await expect(
				dilution.logElection(
					'',
					nominatedCouncilMembers,
					voters,
					nomineesVotedFor,
					assignedVoteWeights
				)
			).to.be.revertedWith('empty election hash provided');
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

		it('should return the correct latestVotingWeight for nominees', async () => {
			await dilution.logElection(
				electionHash,
				nominatedCouncilMembers,
				voters,
				nomineesVotedFor,
				assignedVoteWeights
			);

			let latestVotingWeight;

			latestVotingWeight = await dilution.latestVotingWeight(memberOne.address);

			expect(latestVotingWeight).to.equal(50);

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

	describe('when diluting', () => {
		beforeEach(async () => {
			await dilution.logElection(
				electionHash,
				nominatedCouncilMembers,
				voters,
				nomineesVotedFor,
				assignedVoteWeights
			);

			await dilution.logProposal(proposalHash, start);
		});

		it('should fail if the caller has not voted in the most recent election', async () => {
			await expect(
				dilution.connect(caller).dilute(proposalHash, memberOne.address)
			).to.be.revertedWith('sender has not delegated voting weight for member');
		});

		it('should fail if memberToDilute is not a valid address', async () => {
			await expect(
				dilution.connect(voterOne).dilute(proposalHash, ethers.constants.AddressZero)
			).to.be.revertedWith('member to dilute must be a valid address');
		});

		it('should fail if the proposal does not exist', async () => {
			await expect(
				dilution.connect(voterOne).dilute(INVALID_PROPOSAL_HASH, memberOne.address)
			).to.be.revertedWith('proposal does not exist');
		});

		it('should fail if the proposal voting period has not started', async () => {
			const LATE_PROPOSAL_HASH = 'LATE_PROPOSAL';
			await dilution.logProposal(LATE_PROPOSAL_HASH, Date.now() + 20_000_000);
			await expect(
				dilution.connect(voterOne).dilute(LATE_PROPOSAL_HASH, memberOne.address)
			).to.be.revertedWith('dilution can only occur within the proposal voting period');
		});

		it('should fail if the proposal voting period has ended', async () => {
			const ENDED_PROPOSAL_HASH = 'ENDED_PROPOSAL';
			await dilution.logProposal(ENDED_PROPOSAL_HASH, Date.now() - 20_000_000);
			await expect(
				dilution.connect(voterOne).dilute(ENDED_PROPOSAL_HASH, memberOne.address)
			).to.be.revertedWith('dilution can only occur within the proposal voting period');
		});

		it('should fail if the caller has no voting weight', async () => {
			await expect(
				dilution.connect(voterOne).dilute(proposalHash, memberTwo.address)
			).to.be.revertedWith('sender has not delegated voting weight for member');
		});

		it('should fail if the dilution target is not a current council member', async () => {
			await expect(
				dilution.connect(voterThree).dilute(proposalHash, nomineeOne.address)
			).to.be.revertedWith('member to dilute must be a nominated council member');
		});

		it('should be successful and emit the correct event', async () => {
			await expect(await dilution.connect(voterOne).dilute(proposalHash, memberOne.address))
				.to.emit(dilution, 'DilutionCreated')
				.withArgs(proposalHash, memberOne.address, 0, assignedVoteWeights[0]);
		});

		it('should be successful on multiple dilution events', async () => {
			await dilution.connect(voterOne).dilute(proposalHash, memberOne.address);
			await dilution.connect(voterFive).dilute(proposalHash, memberOne.address);

			const dilutionReceipt = await dilution.proposalHashToMemberDilution(
				proposalHash,
				memberOne.address
			);

			const dilutors = await dilution.getDilutorsForDilutionReceipt(
				proposalHash,
				memberOne.address
			);

			const voterOneDilution = await dilution.getVoterDilutionWeightingForDilutionReceipt(
				proposalHash,
				memberOne.address,
				voterOne.address
			);

			const voterFiveDilution = await dilution.getVoterDilutionWeightingForDilutionReceipt(
				proposalHash,
				memberOne.address,
				voterFive.address
			);

			expect(dilutionReceipt.totalDilutionValue).to.equal(
				assignedVoteWeights[0] + assignedVoteWeights[4]
			);

			expect(dilutors[0]).to.equal(voterOne.address);
			expect(dilutors[1]).to.equal(voterFive.address);

			expect(voterOneDilution).to.equal(assignedVoteWeights[0]);
			expect(voterFiveDilution).to.equal(assignedVoteWeights[4]);
		});
	});

	describe('when undoing a dilution', () => {
		beforeEach(async () => {
			await dilution.logElection(
				electionHash,
				nominatedCouncilMembers,
				voters,
				nomineesVotedFor,
				assignedVoteWeights
			);

			await dilution.logProposal(proposalHash, start);
			await dilution.connect(voterOne).dilute(proposalHash, memberOne.address);
		});

		it('should successfully undo dilution', async () => {
			await expect(dilution.connect(voterOne).invalidateDilution(proposalHash, memberOne.address))
				.to.emit(dilution, 'DilutionModified')
				.withArgs(proposalHash, memberOne.address, 40, 0);
		});

		it('should fail when there is no dilution receipt', async () => {
			await expect(
				dilution.connect(voterOne).invalidateDilution(proposalHash, voterOne.address)
			).to.revertedWith('dilution receipt does not exist for this member and proposal has');
		});

		it('should fail when proposal does not exist', async () => {
			await expect(
				dilution.connect(voterOne).invalidateDilution(INVALID_PROPOSAL_HASH, memberOne.address)
			).to.revertedWith('proposal does not exist');
		});

		it('should fail when voter has not diluted', async () => {
			await dilution.connect(voterOne).invalidateDilution(proposalHash, memberOne.address);
			await expect(
				dilution.connect(voterOne).invalidateDilution(proposalHash, memberOne.address)
			).to.revertedWith('voter has no dilution weight');
		});

		it('should fail when memberToUndilute is not a valid address', async () => {
			await expect(
				dilution.connect(voterOne).invalidateDilution(proposalHash, ethers.constants.AddressZero)
			).to.revertedWith('member to undilute must be a valid address');
		});

		it('should be successful after several dilutions and undilutions', async () => {
			await dilution.connect(voterOne).invalidateDilution(proposalHash, memberOne.address);
			await dilution.connect(voterOne).dilute(proposalHash, memberOne.address);
			await dilution.connect(voterOne).invalidateDilution(proposalHash, memberOne.address);

			await dilution.connect(voterFive).dilute(proposalHash, memberOne.address);
			await dilution.connect(voterFive).invalidateDilution(proposalHash, memberOne.address);
			await dilution.connect(voterFive).dilute(proposalHash, memberOne.address);

			const dilutionReceipt = await dilution.proposalHashToMemberDilution(
				proposalHash,
				memberOne.address
			);

			expect(await dilutionReceipt.totalDilutionValue).to.equal(10);

			const dilutors = await dilution.getDilutorsForDilutionReceipt(
				proposalHash,
				memberOne.address
			);

			const voterOneDilution = await dilution.getVoterDilutionWeightingForDilutionReceipt(
				proposalHash,
				memberOne.address,
				voterOne.address
			);

			const voterFiveDilution = await dilution.getVoterDilutionWeightingForDilutionReceipt(
				proposalHash,
				memberOne.address,
				voterFive.address
			);

			expect(dilutors.length).to.equal(1);
			expect(voterOneDilution).to.equal(0);
			expect(voterFiveDilution).to.equal(10);
		});
	});

	describe('when reading dilution scores', () => {
		beforeEach(async () => {
			await dilution.logElection(
				electionHash,
				nominatedCouncilMembers,
				voters,
				nomineesVotedFor,
				assignedVoteWeights
			);

			await dilution.logProposal(proposalHash, start);
		});

		it('should return the correct dilution ratio', async () => {
			await dilution.connect(voterOne).dilute(proposalHash, memberOne.address);

			const dilutionRatio = await dilution.getDilutedWeightForProposal(
				proposalHash,
				memberOne.address
			);

			const expectedPercent = ethers.utils.parseEther('0.2');

			expect(dilutionRatio).to.equal(expectedPercent);
		});

		it('should return the correct dilution ratio for multiple dilution', async () => {
			await dilution.connect(voterFive).dilute(proposalHash, memberOne.address);

			const dilutionRatio = await dilution.getDilutedWeightForProposal(
				proposalHash,
				memberOne.address
			);

			const expectedPercent = ethers.utils.parseEther('0.8');

			expect(dilutionRatio).to.equal(expectedPercent);
		});

		it('should return the correct dilution ratio for multiple dilution', async () => {
			await dilution.connect(voterFive).dilute(proposalHash, memberOne.address);
			await dilution.connect(voterOne).dilute(proposalHash, memberOne.address);

			const dilutionRatio = await dilution.getDilutedWeightForProposal(
				proposalHash,
				memberOne.address
			);

			const expectedPercent = ethers.utils.parseEther('0');

			expect(dilutionRatio).to.equal(expectedPercent);
		});

		it('should fail when proposal does not exist', async () => {
			await expect(
				dilution.getDilutedWeightForProposal(INVALID_PROPOSAL_HASH, memberOne.address)
			).to.revertedWith('proposal does not exist');
		});

		it('should fail when proposal does not exist', async () => {
			await expect(
				dilution.getDilutedWeightForProposal(proposalHash, voterOne.address)
			).to.revertedWith('address must be a nominated council member');
		});
	});

	describe('when increasing council seats', () => {
		it('should be successful and emit event if called by owner', async () => {
			await expect(dilution.modifySeats(10)).to.emit(dilution, 'SeatsModified').withArgs(2, 10);
		});

		it('should fail if not called by owner', async () => {
			await expect(dilution.connect(caller).modifySeats(10)).to.revertedWith(
				'Only the contract owner may perform this action'
			);
		});

		it('should fail if number of seats input is 0', async () => {
			await expect(dilution.modifySeats(0)).to.revertedWith(
				'number of seats must be greater than zero'
			);
		});
	});

	describe('when modifying proposal period', () => {
		it('should be successful and emit event if called by owner', async () => {
			await expect(dilution.modifyProposalPeriod(20_000))
				.to.emit(dilution, 'ProposalPeriodModified')
				.withArgs(25_9200, 20_000);
		});

		it('should fail if not called by owner', async () => {
			await expect(dilution.connect(caller).modifyProposalPeriod(20_000)).to.revertedWith(
				'Only the contract owner may perform this action'
			);
		});
	});
});
