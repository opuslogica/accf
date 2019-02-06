const Web3latest = require("web3");
const web3latest = new Web3latest(web3.currentProvider);

const timeJump = async (time) => {
  await web3latest.currentProvider.send({
    jsonrpc: "2.0",
    method: "evm_increaseTime",
    params: [time],
    id: Date.now()
  });
};

const currentBlockNumber = async () => await web3latest.eth.getBlockNumber();

const getBlockTimestamp = async (blockNumber = 0) => {
  return (await web3latest.eth.getBlock(blockNumber)).timestamp;
};

const equalizeTime = async (true_time, target_block) => {
  let block_time = await getBlockTimestamp(
    target_block || (await currentBlockNumber())
  );
  await timeJump((true_time || Date.now()) - block_time);
};

module.exports = {
  timeJump,
  currentBlockNumber,
  getBlockTimestamp,
  equalizeTime
};
