'use strict';

const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('CouncilDilution', async () => {
	let dilution;

	beforeEach(async () => {
		const Dilution = await ethers.getContractFactory('CouncilDilution');
		dilution = await Dilution.deploy(8);
	});

	it('should return the initial council seats and proposal period when set', async function () {
		expect(await dilution.numOfSeats()).to.equal(8);
		expect(await dilution.proposalPeriod()).to.equal(259_200); // ~ 2 days in blocks (assuming 15s blocks)
	});

	// describe('when logging an election', async () => {});
});
