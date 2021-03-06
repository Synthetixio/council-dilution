'use strict';

const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('CouncilDilution', () => {
	let dilution;
	let electionHash;
	let proposalHash;
	let proposalTwoHash;
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
		proposalTwoHash = 'ABCDEF';
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

		it('should return the zeroAddress if the user has not voted for a member', async () => {
			await dilution.logElection(
				electionHash,
				nominatedCouncilMembers,
				voters,
				nomineesVotedFor,
				assignedVoteWeights
			);

			const electionMemberVotedFor = await dilution.electionMemberVotedFor(
				electionHash,
				nomineeOne.address
			);

			expect(electionMemberVotedFor).to.equal(ethers.constants.AddressZero);
		});

		it('should return the address for the member the user has voted for', async () => {
			await dilution.logElection(
				electionHash,
				nominatedCouncilMembers,
				voters,
				nomineesVotedFor,
				assignedVoteWeights
			);

			const electionMemberVotedFor = await dilution.electionMemberVotedFor(
				electionHash,
				voterOne.address
			);

			expect(electionMemberVotedFor).to.equal(memberOne.address);
		});
	});

	describe('when logging a proposal', () => {
		it('should successfully log a proposal and emit event', async () => {
			await expect(await dilution.logProposal(proposalHash)).to.emit(dilution, 'ProposalLogged');
		});

		it('should be able to be called by non-owner', async () => {
			await expect(await dilution.connect(caller).logProposal(proposalHash)).to.emit(
				dilution,
				'ProposalLogged'
			);
		});

		it('should fail if proposal hash is not unique', async () => {
			await dilution.logProposal(proposalHash);

			await expect(dilution.logProposal(proposalHash)).to.be.revertedWith(
				'proposal hash is not unique'
			);
		});

		it('should fail if proposal hash is empty', async () => {
			await expect(dilution.logProposal('')).to.be.revertedWith('proposal hash must not be empty');
		});

		it('should reflect the correct start and end timestamps', async () => {
			const proposalPeriod = (await dilution.proposalPeriod()).toNumber();

			await dilution.logProposal(proposalHash);

			const proposalStruct = await dilution.proposalHashToLog(proposalHash);

			const startDate = proposalStruct.start.toNumber();

			const endDate = proposalStruct.end.toNumber();

			expect(endDate).to.equal(startDate + proposalPeriod);
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

			await dilution.logProposal(proposalHash);
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

		it('should fail if the proposal voting period has ended', async () => {
			await dilution.modifyProposalPeriod(59); // 59 seconds

			const ENDED_PROPOSAL_HASH = 'ENDED_PROPOSAL';
			await dilution.logProposal(ENDED_PROPOSAL_HASH);

			ethers.provider.send('evm_increaseTime', [60]); // add 60 seconds
			ethers.provider.send('evm_mine'); // mine the next block

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

		it('should return true for hasAddressDilutedForProposal', async () => {
			await dilution.connect(voterOne).dilute(proposalHash, memberOne.address);

			const hasDiluted = await dilution.hasAddressDilutedForProposal(
				proposalHash,
				voterOne.address
			);

			expect(hasDiluted).to.equal(true);
		});

		it('should fail if the caller has diluted already', async () => {
			await dilution.connect(voterOne).dilute(proposalHash, memberOne.address);
			await expect(
				dilution.connect(voterOne).dilute(proposalHash, memberOne.address)
			).to.be.revertedWith('sender has already diluted');
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

			await dilution.logProposal(proposalHash);
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

		it('should return false for hasAddressDilutedForProposal', async () => {
			await dilution.connect(voterOne).invalidateDilution(proposalHash, memberOne.address);

			const hasDiluted = await dilution.hasAddressDilutedForProposal(
				proposalHash,
				voterOne.address
			);

			expect(hasDiluted).to.equal(false);
		});

		it('should fail if the caller has undiluted already', async () => {
			await dilution.connect(voterOne).invalidateDilution(proposalHash, memberOne.address);
			await expect(
				dilution.connect(voterOne).invalidateDilution(proposalHash, memberOne.address)
			).to.be.revertedWith('voter has no dilution weight');
		});

		it('should fail if the proposal voting period has ended', async () => {
			await dilution.modifyProposalPeriod(60); // 60 seconds

			const ENDED_PROPOSAL_HASH = 'ENDED_PROPOSAL';

			await dilution.logProposal(ENDED_PROPOSAL_HASH);

			await dilution.connect(voterOne).dilute(ENDED_PROPOSAL_HASH, memberOne.address);

			ethers.provider.send('evm_increaseTime', [60]); // add 60 seconds
			ethers.provider.send('evm_mine'); // mine the next block

			await expect(
				dilution.connect(voterOne).invalidateDilution(ENDED_PROPOSAL_HASH, memberOne.address)
			).to.be.revertedWith('dilution can only occur within the proposal voting period');
		});
	});

	describe('when validating a list of proposal hashes', () => {
		beforeEach(async () => {
			await dilution.logElection(
				electionHash,
				nominatedCouncilMembers,
				voters,
				nomineesVotedFor,
				assignedVoteWeights
			);

			await dilution.logProposal(proposalHash);
			await dilution.logProposal(proposalTwoHash);
		});

		it('should return the correct number', async () => {
			const validHashes = await dilution.getValidProposals([proposalHash, proposalTwoHash]);

			expect(validHashes[0]).to.equal(proposalHash);
			expect(validHashes[1]).to.equal(proposalTwoHash);
		});

		it('should return the correct number for invalid and valid proposals', async () => {
			const validHashes = await dilution.getValidProposals([INVALID_PROPOSAL_HASH, proposalHash]);

			expect(validHashes[0]).to.equal('');
			expect(validHashes[1]).to.equal(proposalHash);
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

			await dilution.logProposal(proposalHash);
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

	describe('when batching the voters list', () => {
		let dilutionTwo;
		let electionHash;
		let nominatedCouncilMembers;
		let voters;
		let nomineesVotedFor;
		let assignedVoteWeights;
		beforeEach(async () => {
			const DilutionTwo = await ethers.getContractFactory('CouncilDilution');
			dilutionTwo = await DilutionTwo.deploy(8);
			electionHash = 'QmPyFrvjPRzqsxCpcUFdHU2hWGWV4EJa99ahFATtTyxyZ6';
			nominatedCouncilMembers = [
				'0x935D2fD458fdf41B6F7B62471f593797866a3Ce6',
				'0x9d256b839C1b46e57122eBb3C5e6da97288FaCf1',
				'0x65DCD62932fEf5af25AdA91F0F24658e94e259c5',
				'0xbF49B454818783D12Bf4f3375ff17C59015e66Cb',
				'0x461783a831e6db52d68ba2f3194f6fd1e0087e04',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0xBD015d82a36C9a05108ebC5FEE12672F24dA0Cf4',
				'0x682C4184286415344a35a0Ff6699bb8EdAbDdc17',
			];
			voters = [
				'0xD85A7A3C5F08E3E709c233E133cE1335fBbF5518',
				'0xC8C2b727d864CC75199f5118F0943d2087fB543b',
				'0x691Ce62a208B195acCF54C39a98F1112C90046d1',
				'0x3A2839250072f936f1A1BE79A367e18557fb4a2c',
				'0xC34a7c65aa08Cb36744bdA8eEEC7b8e9891e147C',
				'0x6e3AA85dB95BBA36276a37ED93B12B7AB0782aFB',
				'0xB696d629Cd0a00560151A434F6B4478AD6c228D7',
				'0x46b46931423e711D051e264020ACad89c0e147Bd',
				'0x2354D7B3A54c2EF507f724131E5AA11739815e36',
				'0xf88d3412764873872aB1FdED5F168a6c1A3bF7bB',
				'0x2ce5f9f52C1eec9a1183f91139C59b485Ff39dAd',
				'0xA698cAdE532Bf7491F0F887284f8E10E2De97198',
				'0x70265950ADD51748Aa041dE8aCcce6747507ADcE',
				'0xa33c7f924399b59A8Ee627388A108beAb5E12EaF',
				'0xC814d2ef6D893568c74cD969Eb6F72a62fc261f7',
				'0x461783A831E6dB52D68Ba2f3194F6fd1E0087E04',
				'0xDBB70FBeDd2661Ef3B6Bdf0C105E62fd1c61dA7c',
				'0xF1b98463d6574c998f03e6EDF6D7b4e5F917F915',
				'0xB631651cB570bA0C0D696bD5E4860cbD214f20a0',
				'0x21fFf64975b0c9Cf1202771AeD6cF104C99A1667',
				'0xf75200b7684A120fBa433145609112616749C082',
				'0xFf50219d17083f234a37f9f85d5f1D5A05b3169f',
				'0xC54570b8EB8138aCE95132b944b7b6Bb391976Dc',
				'0x9Ee1830ff376758c5Ecc7FB465f3b14d64116d71',
				'0x1Fa4823613Fb2424cbDab225FC1eEfe3Bd293c84',
				'0xE272a25b3b30A6C76AB15224F24eaAEeD24AbED9',
				'0x1eb66a75215a0eE8C88bc99125fBE8E387419F38',
				'0x2cc96F1a3e55882DE61B965b668AE3A5326f4CE0',
				'0x79a98A9F41051e119cad1b9fFeFe523cd0Be65f0',
				'0xd6D7Ea4833f22edBED3DbD3d71Adf3cdD8E36a01',
				'0xdf7C04C309D77DC561d7eAE8997772F5910f41f4',
				'0x3FB7d366036f854F479bB40CB547F34352399F21',
				'0xB2fbF923588764859c3a7aD2DDf90e4d24ED3005',
				'0xA0D86993bf9593A9186c7F022e31bd0d32808BF1',
				'0xcC2b9fDe1e59342C1Ae10ebc02bb44E1dbE2B02D',
				'0xc4df7c5fDAEd215fA559c63211407c28f91848a6',
				'0x86AABcD459587bC1A347aE1E2d15223856354EC9',
				'0xdbc605b9Edd0B5fd3B58e75E975cbA62385A7E4a',
				'0x63B461A9577cdAea028f25D059868d9Abe6EddBF',
				'0x32a59b87352e980dD6aB1bAF462696D28e63525D',
				'0xE0ffF9c0c1a54C9e606Ad5366E8f00048c5B6257',
				'0xA7D7Ac8Fe7e8693B5599C69cC7d4F6226677845B',
				'0x7c04C24D53d3d1278bB5B961496d6e632eD0F7C7',
				'0x85B777c3fcEf0F387B394c5216e9414a9E881898',
				'0x36F4BFC9f49Dc5D4b2d10c4a48a6b30128BD79bC',
				'0xD6f04cDbb1A2F78E2AE6Ef42aeda817Ad701322a',
				'0x4CD67cc4aede471e20bbFeab92eFf2b88141a48f',
				'0x8252C3Ad7008464A618B6b28690DFB30D17A4910',
				'0xab85a4CDd5f16b5C02B7A2DAB3F464E17Dddb833',
				'0x4F8bB28187Cc89ddAD0f35AA76A4693A54595c24',
				'0x8eFD9ADDD8de6A4E64664D1893dEc51F8C3339E9',
				'0xA1ca76eE286c011B074ABaE70B4DF768b16a671D',
				'0x24e445fe7708Bf4bC2ae8d4df1694C98Af8BDE4F',
				'0x05282B9c5034CDFC8aF432659c868815A959A847',
				'0xBD1f7d88C76A86C60d41bDDD4819fAe404e7151E',
				'0x76e6e2E9Ca0ee9a2BB4148566791FD6F2fEeAc32',
				'0x787b4b7FFEf8edDaD54F311039aCF4c36FEC9593',
				'0x81261845d959A0D7F89429F9DA68bD478F3A640A',
				'0xcb59dB511a5922303cc867E2853D5caD72698dEB',
				'0xE76Be9C1e10910d6Bc6b63D8031729747910c2f6',
				'0x12A1E8f498501c2CCE0967F8b9717b28492fC668',
				'0x4E0E75808D68c0a198E504b46F87D6853BbbF0E6',
				'0x868fB2fFCB74111a27c86fbA78b9EA8AF8867a0F',
				'0x68575571E75D2CfA4222e0F8E7053F056EB91d6C',
				'0x3bd59eD16c462b4464091830DAB828dce079076f',
				'0x4093eED436bd6A5320316af7De30059a58f70c4c',
				'0x8fB66B276481Ad68928056c1ED18C6e37F1bdb66',
				'0x4d65151cD05f43F9aCbEdBe4182b02445A93D7CF',
				'0x41647a74673C90F4a13884bee4f8A89034FB85E8',
				'0x565F1dd3f6f0d088f8cF48A9d57014Ef5f89a54F',
			];
			nomineesVotedFor = [
				'0x935D2fD458fdf41B6F7B62471f593797866a3Ce6',
				'0x9d256b839C1b46e57122eBb3C5e6da97288FaCf1',
				'0xbF49B454818783D12Bf4f3375ff17C59015e66Cb',
				'0x682C4184286415344a35a0Ff6699bb8EdAbDdc17',
				'0x65DCD62932fEf5af25AdA91F0F24658e94e259c5',
				'0xBD015d82a36C9a05108ebC5FEE12672F24dA0Cf4',
				'0x461783a831e6db52d68ba2f3194f6fd1e0087e04',
				'0x65DCD62932fEf5af25AdA91F0F24658e94e259c5',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x461783a831e6db52d68ba2f3194f6fd1e0087e04',
				'0x935D2fD458fdf41B6F7B62471f593797866a3Ce6',
				'0x461783a831e6db52d68ba2f3194f6fd1e0087e04',
				'0x65DCD62932fEf5af25AdA91F0F24658e94e259c5',
				'0xBD015d82a36C9a05108ebC5FEE12672F24dA0Cf4',
				'0x9d256b839C1b46e57122eBb3C5e6da97288FaCf1',
				'0x935D2fD458fdf41B6F7B62471f593797866a3Ce6',
				'0xbF49B454818783D12Bf4f3375ff17C59015e66Cb',
				'0x682C4184286415344a35a0Ff6699bb8EdAbDdc17',
				'0x935D2fD458fdf41B6F7B62471f593797866a3Ce6',
				'0x9d256b839C1b46e57122eBb3C5e6da97288FaCf1',
				'0x461783a831e6db52d68ba2f3194f6fd1e0087e04',
				'0xBD015d82a36C9a05108ebC5FEE12672F24dA0Cf4',
				'0x935D2fD458fdf41B6F7B62471f593797866a3Ce6',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x935D2fD458fdf41B6F7B62471f593797866a3Ce6',
				'0x461783a831e6db52d68ba2f3194f6fd1e0087e04',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0xBD015d82a36C9a05108ebC5FEE12672F24dA0Cf4',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x935D2fD458fdf41B6F7B62471f593797866a3Ce6',
				'0xBD015d82a36C9a05108ebC5FEE12672F24dA0Cf4',
				'0x935D2fD458fdf41B6F7B62471f593797866a3Ce6',
				'0x935D2fD458fdf41B6F7B62471f593797866a3Ce6',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0xBD015d82a36C9a05108ebC5FEE12672F24dA0Cf4',
				'0x65DCD62932fEf5af25AdA91F0F24658e94e259c5',
				'0xBD015d82a36C9a05108ebC5FEE12672F24dA0Cf4',
				'0xbF49B454818783D12Bf4f3375ff17C59015e66Cb',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x461783a831e6db52d68ba2f3194f6fd1e0087e04',
				'0x935D2fD458fdf41B6F7B62471f593797866a3Ce6',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x9d256b839C1b46e57122eBb3C5e6da97288FaCf1',
				'0xbF49B454818783D12Bf4f3375ff17C59015e66Cb',
				'0xBD015d82a36C9a05108ebC5FEE12672F24dA0Cf4',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x935D2fD458fdf41B6F7B62471f593797866a3Ce6',
				'0x65DCD62932fEf5af25AdA91F0F24658e94e259c5',
				'0x461783a831e6db52d68ba2f3194f6fd1e0087e04',
				'0x682C4184286415344a35a0Ff6699bb8EdAbDdc17',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x461783a831e6db52d68ba2f3194f6fd1e0087e04',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x461783a831e6db52d68ba2f3194f6fd1e0087e04',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x935D2fD458fdf41B6F7B62471f593797866a3Ce6',
				'0x65DCD62932fEf5af25AdA91F0F24658e94e259c5',
				'0x65DCD62932fEf5af25AdA91F0F24658e94e259c5',
				'0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
				'0x65DCD62932fEf5af25AdA91F0F24658e94e259c5',
				'0x9d256b839C1b46e57122eBb3C5e6da97288FaCf1',
				'0x935D2fD458fdf41B6F7B62471f593797866a3Ce6',
			];
			assignedVoteWeights = [
				93.39548472473724,
				70.8433268598176,
				61.96895537758775,
				46.231239331522005,
				41.61570649601773,
				32.69087496537043,
				31.08801886605055,
				24.78827925021365,
				13.74501254745897,
				11.633816799400567,
				9.30580808077875,
				7.715919218251335,
				6.325144562071033,
				6.319516090824064,
				6.203949114384978,
				5.667098310527187,
				5.519164746036679,
				5.285300495800554,
				5.0492688805093096,
				3.764867324638482,
				3.6847493819831967,
				3.5540707735456687,
				3.458340397677439,
				3.3812353132149138,
				3.302497851785125,
				3.230647709275387,
				3.1326367689396193,
				2.894641471620526,
				2.852438419206749,
				2.852301422175727,
				2.8315870043456495,
				2.8226248142471624,
				2.674466981337543,
				2.6453255212437505,
				2.336051026190308,
				2.2560372009029432,
				2.1928979014306154,
				2.1860489065455737,
				2.1075536744499894,
				1.9730798826316398,
				1.9447203869147676,
				1.796505587616145,
				1.7039742323251175,
				1.6696803789137353,
				1.5621845739211406,
				1.4661850815799091,
				1.387618137301643,
				1.3275991688452267,
				1.2474820872492431,
				1.181485120499945,
				1.1653667866916773,
				1.1232296012359178,
				1.0561817742582806,
				1.0099125016957147,
				0.9673613255298812,
				0.883531037803148,
				0.8817440807315893,
				0.8438250919118394,
				0.8234239613150011,
				0.7248405666570193,
				0.6569294582267734,
				0.6374654987344748,
				0.6333287276190314,
				0.5858091900880366,
				0.5821897604115484,
				0.4869752001765988,
				0.3500844480481434,
				0.31082032855548564,
				0.2890607394205065,
				0.11497285979538122,
			];
		});

		it('should be successful', async () => {
			let votersBatch = [];
			let nomineesVotedForBatch = [];
			let assignedVoteWeightsBatch = [];

			let i,
				j,
				chunk = 50;

			for (i = 0, j = voters.length; i < j; i += chunk) {
				votersBatch.push(voters.slice(i, i + chunk));
				nomineesVotedForBatch.push(nomineesVotedFor.slice(i, i + chunk));
				assignedVoteWeightsBatch.push(
					assignedVoteWeights
						.slice(i, i + chunk)
						.map((weight) => ethers.utils.parseEther(weight.toString()))
				);
			}

			const txBatch = await Promise.all(
				votersBatch.map(async (batch, key) => {
					return await dilutionTwo.logElection(
						electionHash,
						nominatedCouncilMembers,
						batch,
						nomineesVotedForBatch[key],
						assignedVoteWeightsBatch[key]
					);
				})
			);

			expect(txBatch.length).to.equal(2);
		});
	});
});
