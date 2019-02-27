function _send({method, params, id}, c) {
  web3.currentProvider.send({
    jsonrpc: "2.0",
    method: method,
    params: params || [],
    id: id || Date.now()
  }, c || ((err, res) => {
    if (err) console.log(err);
  }));
}

async function currentBlockNumber() {
  return await web3.eth.getBlockNumber();
}

async function getBlockTimestamp(blockNumber = 0) {
  return (await web3.eth.getBlock(blockNumber)).timestamp;
}

async function currentBlockTime() {
  return await getBlockTimestamp(await currentBlockNumber());
}

function currentTime() {
  // Timestamps in solidity are seconds since the Unix epoch, whereas in Javascript
  // they are miliseconds since then.
  // Furthermore, apparently in solidity, the seconds are being floored, not rounded!
  return Math.floor(Date.now() / 1000);
}

function make_snapshot(id, c) {
  _send({
    method: "evm_snapshot",
    id: id
  }, c);
}

function goto_snapshot(id, c) {
  _send({
    method: "evm_revert",
    params: [id]
  }, c);
}

function jumpForward(duration, c) {
  _send({
    method: "evm_increaseTime",
    params: [duration],
    id: duration
  }, c);
}

async function equalizeTime(true_time, target_block) {
  // Blockchain's time is behind the real time. This equalizes it.
  // Doesn't work if its time is ahead of the real time.
  let block_time = await getBlockTimestamp(
    target_block || (await currentBlockNumber())
  );
  await jumpForward((true_time || Date.now()) - block_time);
}


module.exports = {
  jumpForward,
  currentBlockTime,
  currentTime,
  equalizeTime,
  make_snapshot,
  goto_snapshot
};
