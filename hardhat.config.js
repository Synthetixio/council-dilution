require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-solhint');
require('@nomiclabs/hardhat-etherscan');
require('@eth-optimism/plugins/hardhat/compiler');
require('solidity-coverage');
require('dotenv').config();

const GAS_PRICE = 15e9; // 15 GWEI

module.exports = {
	solidity: '0.7.6',
	networks: {
		kovan: {
			url: `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`,
			accounts: [`${process.env.DEPLOY_PRIVATE_KEY}`],
		},
		mainnet: {
			url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
			accounts: [`${process.env.DEPLOY_PRIVATE_KEY}`],
			gasPrice: GAS_PRICE,
		},
		optimism: {
			url: 'https://mainnet.optimism.io',
			accounts: [`${process.env.DEPLOY_PRIVATE_KEY}`],
			ovm: true,
		},
	},
	etherscan: {
		apiKey: process.env.ETHERSCAN,
	},
};
