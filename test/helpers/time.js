function send({method, params, id}, c) {
  web3.currentProvider.send({
    jsonrpc: "2.0",
    method: method,
    params: params || [],
    id: id || Date.now()
  }, c || ((err, res) => {
    if (err) console.log(err);
  }));
}


function make_snapshot(id, c) {
  send({
    method: "evm_snapshot",
    id: id
  }, c);
}


function goto_snapshot(id, c) {
  send({
    method: "evm_revert",
    params: [id]
  }, c);
}

function jumpForward(duration, c) {
  send({
    method: "evm_increaseTime",
    params: [duration],
    id: duration
  }, c);
}


async function currentBlockNumber() {
  await web3.eth.getBlockNumber();
}


async function getBlockTimestamp(blockNumber = 0) {
  await web3.eth.getBlock(blockNumber).timestamp;
}


module.exports = {
  jumpForward,
  make_snapshot,
  goto_snapshot,
  currentBlockNumber,
  getBlockTimestamp,
};
