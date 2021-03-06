const AssuredCampaign = artifacts.require("./AssuredCampaign.sol");
const { tryCatch, errTypes } = require("./helpers/exceptions");
const {
  currentTime,
  currentBlockTime,
  equalizeTime,
  make_snapshot,
  goto_snapshot,
  jumpForward
} = require("./helpers/time");


async function moneySpentIn(receipt, from) {
  const tx = await web3.eth.getTransaction(receipt.tx, { from });
  return Number(tx.gas) * Number(tx.gasPrice);
}


contract("AssuredCampaign", async accounts => {
  let starting_point;
  let deployer_account;

  before(async () => {
    deployer_account = (await web3.eth.getAccounts())[0];
  });

  beforeEach(async () => {
    make_snapshot(currentTime(), (err, res) => {
      starting_point = res.result;
    });
  });

  afterEach(() => goto_snapshot(starting_point));

  function params({
    start,
    end,
    target,
    profit,
    minAmount,
    stakePct,
    ent_hot_account,
    ent_cold_account,
    recepient
  }) {
    // default values should result in successful test deployment.
    let current_time = currentTime();
    return [
      start || current_time + 120,
      end || (start || current_time + 120) + 60 * 60 * 24,
      target || 50,
      profit || 10,
      minAmount || 2,
      stakePct || 10,
      ent_hot_account || deployer_account,
      ent_cold_account || deployer_account,
      recepient || deployer_account
    ];
  }

  // Init

  it("should deploy without an error", async () => {
    assert.exists(await AssuredCampaign.new(...params({})));
  });

  it("should start at least one minute from now", async () => {
    await tryCatch(
      AssuredCampaign.new(...params({ start: currentTime() })),
      errTypes.revert
    );
    await tryCatch(
      AssuredCampaign.new(...params({ start: currentTime() + 59 })),
      errTypes.revert
    );
  });

  it("should have a duration of at least 24 hours", async () => {
    // Since starting point is declared before campaign initialization,
    // this test may fail if some other test fails due to lagging.
    // That's why euqlizeTime is there.
    let start_point = currentTime() + 60;
    await equalizeTime();
    assert.isOk(
      await AssuredCampaign.new(
        ...params({
          start: start_point,
          end: start_point + 60 * 60 * 24
        })
      )
    );
    await tryCatch(
      AssuredCampaign.new(
        ...params({
          start: start_point,
          end: start_point + 60 * 60 * 24 - 1
        })
      ),
      errTypes.revert
    );
  });

  it("should have nonzero entrepreneur accounts", async () => {
    await tryCatch(
      AssuredCampaign.new(
        ...params({
          ent_hot_account: "0x0000000000000000000000000000000000000000"
        })
      ),
      errTypes.revert
    );
    await tryCatch(
      AssuredCampaign.new(
        ...params({
          ent_cold_account: "0x0000000000000000000000000000000000000000"
        })
      ),
      errTypes.revert
    );
  });

  it("should have a nonzero recepient account", async () => {
    await tryCatch(
      AssuredCampaign.new(
        ...params({ recepient: "0x0000000000000000000000000000000000000000" })
      ),
      errTypes.revert
    );
  });

  it("should an entrepreneur's profit less than the target raising amount", async () => {
    await tryCatch(
      AssuredCampaign.new(...params({ profit: 10, target: 10 })),
      errTypes.revert
    );
    await tryCatch(
      AssuredCampaign.new(...params({ profit: 11, target: 10 })),
      errTypes.revert
    );
    assert.isOk(
      await AssuredCampaign.new(...params({ profit: 9, target: 10 }))
    );
  });

  it("should store recepient's address separately than entrepreneur's address, irrespective of whether they're the same", async () => {
    let recepient = (await web3.eth.getAccounts())[1];
    let c = await AssuredCampaign.new(...params({ recepient }));
    assert.notEqual(
      recepient,
      deployer_account,
      "For this test, recepient address has to be different from entrepreneur's address"
    );
    assert.notEqual(await c.entAccount, await c.recepientAccount);
  });

  it("should store minStakeRequired correctly", async () => {
    let target = 23;
    let stakePct = 7;
    let c = await AssuredCampaign.new(...params({ target, stakePct }));
    assert.equal(
      Math.floor((target * stakePct) / 100),
      await c.minStakeRequired()
    );
  });

  // Staking Stage

  it("should only accept stakes before the start time of the campaign", async () => {
    let start = currentTime() + 120;
    let c = await AssuredCampaign.new(...params({ start }));

    assert.isOk(await c.stake(2, { value: 2, from: deployer_account }));
    assert.equal(await c.stakedAmount(), 2);

    jumpForward(start - (await currentBlockTime()));

    await tryCatch(
      c.stake(2, { value: 2, from: deployer_account }),
      errTypes.revert
    );
  });

  it("should only receive stakes from the entrepreneur's hot account", async () => {
    // ent_cold_account is already stored separately,
    // and we know deployer_account successfully stakes.

    let other_account = (await web3.eth.getAccounts())[1];
    let c = await AssuredCampaign.new(...params({}));
    await tryCatch(
      c.stake(2, { value: 2, from: other_account }),
      errTypes.revert
    );
    assert.notEqual(await c.stakedAmount(), 2);
  });

  it("should accept multiple staking payments before the pledging stage", async () => {
    let c = await AssuredCampaign.new(...params({}));
    assert.isOk(await c.stake(2, { value: 2, from: deployer_account }));
    assert.equal(await c.stakedAmount(), 2);
    assert.isOk(await c.stake(2, { value: 2, from: deployer_account }));
    assert.equal(await c.stakedAmount(), 4);
  });

  it("should accept more stakes than minimum", async () => {
    let c = await AssuredCampaign.new(...params({}));
    let min_stake = Number(await c.minStakeRequired());
    assert.isOk(
      await c.stake(min_stake + 1, {
        value: min_stake + 1,
        from: deployer_account
      })
    );
    assert.equal(await c.stakedAmount(), min_stake + 1);
  });

  it("should accept more stakes than target amount", async () => {
    let c = await AssuredCampaign.new(...params({}));
    let targetAmount = await c.targetAmount();
    assert.isOk(
      await c.stake(targetAmount + 100, {
        value: targetAmount + 100,
        from: deployer_account
      })
    );
    assert.equal(await c.stakedAmount(), targetAmount + 100);
  });

  //Pledging Stage

  it("shouldn't accept pledges if entrepreneur hasn't staked enough", async () => {
    let account = (await web3.eth.getAccounts())[1];
    let start = currentTime() + 120;
    let c = await AssuredCampaign.new(...params({ start }));
    let min_stake = Number(await c.minStakeRequired());
    let amount = Number(await c.contribMinAmount());
    await c.stake(min_stake - 1, {
      value: min_stake - 1,
      from: deployer_account
    });
    jumpForward(start - (await currentBlockTime()));
    await tryCatch(
      c.pledge(amount, { value: amount, from: account }),
      errTypes.revert
    );
  });

  it("should accept pledges no less than contribMinAmount", async () => {
    let account = (await web3.eth.getAccounts())[1];
    let start = currentTime() + 120;
    let c = await AssuredCampaign.new(...params({ start }));
    let min_stake = Number(await c.minStakeRequired());
    let amount = Number((await c.contribMinAmount()) - 1);
    await c.stake(min_stake, { value: min_stake, from: deployer_account });
    jumpForward(start - (await currentBlockTime()));
    await tryCatch(
      c.pledge(amount, { value: amount, from: account }),
      errTypes.revert
    );
  });

  it("should accept pledges only after startTime", async () => {
    let start = currentTime() + 120;
    let c = await AssuredCampaign.new(...params({ start }));
    let amount = Number(await c.contribMinAmount());
    let account = (await web3.eth.getAccounts())[1];

    let min_stake = Number(await c.minStakeRequired());

    await c.stake(min_stake, { value: min_stake, from: deployer_account });

    await tryCatch(
      c.pledge(amount, { value: amount, from: account }),
      errTypes.revert
    );
    jumpForward(start - (await currentBlockTime()) + 60 * 60);
    // assert.isOk(await c.pledge(amount, { value: amount, from: account }));
    let r = (await c.pledge(amount, { value: amount, from: account }));
    assert.equal(amount, Number(await c.fetchMyBalance({ from: account })));
  });

  it("should accept pledges before the deadline", async () => {
    let start = currentTime() + 120;
    let deadline = start + 60 * 60 * 24;
    let c = await AssuredCampaign.new(...params({ start }));
    let amount = Number(await c.contribMinAmount());
    let account = (await web3.eth.getAccounts())[1];

    let min_stake = Number(Number(await c.minStakeRequired()));
    await c.stake(min_stake, { value: min_stake, from: deployer_account });

    await tryCatch(
      c.pledge(amount, { value: amount, from: account }),
      errTypes.revert
    );

    jumpForward(deadline - (await currentBlockTime()) + 1);

    await tryCatch(
      c.pledge(amount, { value: amount, from: account }),
      errTypes.revert
    );
  });

  it("should accept pledges from entrepreneur and both of his hot and cold accounts", async () => {
    let start = currentTime() + 120;
    let c = await AssuredCampaign.new(...params({ start }));
    let amount = Number(await c.contribMinAmount());

    let hot_account = await c.entHotAccount();
    let cold_account = await c.entColdAccount();

    let min_stake = Number(await c.minStakeRequired());
    await c.stake(min_stake, { value: min_stake, from: hot_account });

    jumpForward(start - (await currentBlockTime()) + 60 * 60);

    assert.isOk(await c.pledge(amount, { value: amount, from: hot_account }));
    assert.equal(amount, Number(await c.fetchMyBalance({ from: hot_account })));
    assert.isOk(await c.pledge(amount, { value: amount, from: cold_account }));
    assert.equal(
      hot_account == cold_account ? amount * 2 : amount,
      Number(await c.fetchMyBalance({ from: cold_account }))
    );
  });

  it("should be able to accept multiple pledging payments from the same person", async () => {
    let start = currentTime() + 120;
    let c = await AssuredCampaign.new(...params({ start }));
    let amount = Number(await c.contribMinAmount());
    let min_stake = Number(await c.minStakeRequired());
    await c.stake(min_stake, { value: min_stake, from: deployer_account });

    jumpForward(start - (await currentBlockTime()) + 60 * 60);

    assert.isOk(
      await c.pledge(amount, { value: amount, from: deployer_account })
    );
    assert.equal(
      amount * 1,
      Number(await c.fetchMyBalance({ from: deployer_account }))
    );
    assert.isOk(
      await c.pledge(amount, { value: amount, from: deployer_account })
    );
    assert.equal(
      amount * 2,
      Number(await c.fetchMyBalance({ from: deployer_account }))
    );
    assert.isOk(
      await c.pledge(amount, { value: amount, from: deployer_account })
    );
    assert.equal(
      amount * 3,
      Number(await c.fetchMyBalance({ from: deployer_account }))
    );
  });

  it("should accept the entire targetAmount from one person too", async () => {
    let start = currentTime() + 120;
    let c = await AssuredCampaign.new(...params({ start }));
    let amount = Number(await c.targetAmount());

    let min_stake = Number(await c.minStakeRequired());
    await c.stake(min_stake, { value: min_stake, from: deployer_account });

    jumpForward(start - (await currentBlockTime()) + 60 * 60);

    assert.isOk(
      await c.pledge(amount, { value: amount, from: deployer_account })
    );
    assert.equal(
      amount,
      Number(await c.fetchMyBalance({ from: deployer_account }))
    );
  });

  it("should be able to raise more than the targetAmount", async () => {
    let start = currentTime() + 120;
    let c = await AssuredCampaign.new(...params({ start }));
    let amount = Number(await c.contribMinAmount());
    let other_amount = Number(await c.targetAmount()) + amount;
    let other_account = (await web3.eth.getAccounts())[2];

    let min_stake = Number(await c.minStakeRequired());
    await c.stake(min_stake, { value: min_stake, from: deployer_account });

    jumpForward(start - (await currentBlockTime()) + 60 * 60);

    assert.isOk(
      await c.pledge(amount, { value: amount, from: deployer_account })
    );
    assert.equal(
      amount,
      Number(await c.fetchMyBalance({ from: deployer_account }))
    );

    assert.isOk(
      await c.pledge(other_amount, { value: other_amount, from: other_account })
    );
    assert.equal(
      other_amount,
      Number(await c.fetchMyBalance({ from: other_account }))
    );
  });

  // Refunding Stage

  it("shouldn't allow refunds before deadline", async () => {
    let start = currentTime() + 120;
    let deadline = start + 60 * 60 * 24;
    let c = await AssuredCampaign.new(...params({ start }));
    let amount = Number(await c.contribMinAmount());

    let min_stake = Number(Number(await c.minStakeRequired()));
    await c.stake(min_stake, { value: min_stake, from: deployer_account });

    jumpForward(start - (await currentBlockTime()) + 60 * 60);

    await c.pledge(amount, { value: amount, from: deployer_account });

    jumpForward(deadline - (await currentBlockTime()) - 1);

    await tryCatch(c.refund({ from: deployer_account }), errTypes.revert);

    // Time is being floored, since we're less than a second away, this +1 has to exist.
    jumpForward(deadline - (await currentBlockTime()) + 1);

    assert.isOk(await c.refund({ from: deployer_account }));
  });

  it("shouldn't allow refunds if target amount is raised", async () => {
    let start = currentTime() + 120;
    let deadline = start + 60 * 60 * 24;
    let c = await AssuredCampaign.new(...params({ start }));
    let amount = Number(await c.targetAmount());

    let min_stake = Number(Number(await c.minStakeRequired()));
    await c.stake(min_stake, { value: min_stake, from: deployer_account });

    jumpForward(start - (await currentBlockTime()) + 60 * 60);

    await c.pledge(amount, { value: amount, from: deployer_account });

    jumpForward(deadline - (await currentBlockTime()));

    await tryCatch(c.refund({ from: deployer_account }), errTypes.revert);
  });

  it("should only refund to people who have pledged in the first place", async () => {
    let start = currentTime() + 120;
    let deadline = start + 60 * 60 * 24;
    let c = await AssuredCampaign.new(...params({ start }));
    let amount = Number(await c.contribMinAmount());
    let other_account = (await web3.eth.getAccounts())[1];

    let min_stake = Number(Number(await c.minStakeRequired()));
    await c.stake(min_stake, { value: min_stake, from: deployer_account });

    jumpForward(start - (await currentBlockTime()) + 60 * 60);

    await c.pledge(amount, { value: amount, from: deployer_account });

    jumpForward(deadline - (await currentBlockTime()) + 60 * 60);

    assert.isOk(await c.refund({ from: deployer_account }));

    await tryCatch(
      c.haveIBeenRefunded({ from: other_account }),
      errTypes.revert
    );

    await tryCatch(c.refund({ from: other_account }), errTypes.revert);
  });

  it("shouldn't refund to people who have been refunded", async () => {
    let start = currentTime() + 120;
    let deadline = start + 60 * 60 * 24;
    let c = await AssuredCampaign.new(...params({ start }));
    let amount = Number(await c.contribMinAmount());

    let min_stake = Number(Number(await c.minStakeRequired()));
    await c.stake(min_stake, { value: min_stake, from: deployer_account });

    jumpForward(start - (await currentBlockTime()) + 60 * 60);

    await c.pledge(amount, { value: amount, from: deployer_account });

    jumpForward(deadline - (await currentBlockTime()) + 60 * 60);

    assert.isFalse(await c.haveIBeenRefunded({ from: deployer_account }));

    assert.isOk(await c.refund({ from: deployer_account }));

    assert.isTrue(await c.haveIBeenRefunded({ from: deployer_account }));

    await tryCatch(c.refund({ from: deployer_account }), errTypes.revert);
  });

  it("shouldn't return the indivisible stake portion to the entrepreneur if he calls the a refund, irrespective of whether he has pledged or not", async () => {
    let start = currentTime() + 120;
    let deadline = start + 60 * 60 * 24;
    let c = await AssuredCampaign.new(...params({ start, deadline }));
    let amount = Number(await c.contribMinAmount());

    let min_stake = Number(Number(await c.minStakeRequired()));
    await c.stake(min_stake, { value: min_stake, from: deployer_account });

    jumpForward(start - (await currentBlockTime()) + 60 * 60);

    await c.pledge(amount, { value: amount, from: deployer_account });

    jumpForward(deadline - (await currentBlockTime()) + 60 * 60);

    await c.refund({ from: deployer_account });

    assert.isFalse(await c.entGotIndivisibleStakePortion());
  });

  it("should have a proportional refund amount");

  it("only entrepreneur, the deployer and the recepient can see the remaining indivisible stake amount");

  it("should calculate remaining indivisible stake amount correctly");

  it("should only return the remaining stakes if it hasn't been returned before");

  it("should be able to return the indivisible stakes to the entrepreneur's cold account");

  // Success Stage

  it("should have the entrepreneur's share as the stakedAmount plus the profitted amount");

  it("should have the recepient to receive everything but the entrepreneur's share");

  // Any Stage

  it("should detect whether an arbitrary address has pledged", async () => {
    let start = currentTime() + 120;
    let c = await AssuredCampaign.new(...params({ start }));
    let amount = Number(await c.contribMinAmount());
    let account_1 = (await web3.eth.getAccounts())[1];
    let account_2 = (await web3.eth.getAccounts())[2];

    let min_stake = Number(await c.minStakeRequired());
    await c.stake(min_stake, { value: min_stake, from: deployer_account });

    jumpForward(start - (await currentBlockTime()) + 60 * 60);

    [deployer_account, account_2].forEach(async x => {
      await c.pledge(amount, { value: amount, from: x });
      assert.isTrue(await c.pledgeExists(x));
    });

    assert.isFalse(await c.pledgeExists(account_1));
  });
});

// Can fed below into Remix deployer for testing
// 2549405445,8549405445,50,10,2,15,"0x31119260c0Bd3a8Ad822878B687efc3AFB60B603","0x31119260c0Bd3a8Ad822878B687efc3AFB60B603","0x31119260c0Bd3a8Ad822878B687efc3AFB60B603"
