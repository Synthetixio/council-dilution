require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-solhint');
require('@nomiclabs/hardhat-etherscan');
require('solidity-coverage');
require('dotenv').config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
// task('accounts', 'Prints the list of accounts', async () => {
// 	const accounts = await ethers.getSigners();

// 	for (const account of accounts) {
// 		console.log(account.address);
// 	}
// });

task('compile')
	.addFlag('useOvm', 'Compile with the OVM Solidity compiler')
	.setAction(async (taskArguments, hre, runSuper) => {
		if (taskArguments.useOvm) {
			require('@eth-optimism/plugins/hardhat/compiler');
		}

		if (taskArguments.native) {
			hre.config.solc.native = true;
		}

		// optimizeIfRequired({ hre, taskArguments });

		await runSuper(taskArguments);
	});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
	solidity: '0.5.16',
	ovm: {
		solcVersion: '0.5.16',
	},
	networks: {
		kovan: {
			url: `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`,
			accounts: {
				mnemonic: process.env.KOVAN_PRIVATE_KEY,
			},
		},
	},
	etherscan: {
		// Your API key for Etherscan
		// Obtain one at https://etherscan.io/
		apiKey: process.env.ETHERSCAN,
	},
};
