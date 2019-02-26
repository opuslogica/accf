const AssuredCampaign = artifacts.require("./AssuredCampaign.sol");
const tryCatch = require("./helpers/exceptions").tryCatch;
const errTypes = require("./helpers/exceptions").errTypes;
const jumpForward = require("./helpers/time").jumpForward;
const make_snapshot = require("./helpers/time").make_snapshot;
const goto_snapshot = require("./helpers/time").goto_snapshot;


contract("AssuredCampaign", async accounts => {

  let starting_point;
  let deployer_address;

  before(async () => {
    deployer_address = (await web3.eth.getAccounts())[0];
  });

  beforeEach(() => {
    make_snapshot(Date.now(), (err, res) => {
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
    let current_time = Date.now();
    return [
      start || current_time,
      end || ((start || current_time) + (3600 * 24)),
      target || 50,
      profit || 10,
      minAmount || 2,
      stakePct || 10,
      ent_hot_account || deployer_address,
      ent_cold_account || deployer_address,
      recepient || deployer_address
    ];
  };

  it("should deploy without an error", async () => {
    assert.exists(await AssuredCampaign.new(...params({})));
  });

  it("should have a far enough start time", async () => {
    await tryCatch(
      AssuredCampaign.new(...params({ start: 1 })),
      errTypes.revert
    );
  });

  it("should have a duration of at least 24 hours", async () => {
    let start_point = Date.now();
    assert.isOk(await AssuredCampaign.new(...params({
      start: start_point, end: start_point + (60 * 60 * 24)
    })));
    await tryCatch(
      AssuredCampaign.new(...params({
        start: start_point, end: start_point + (60 * 60 * 24) - 1
      })),
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
      deployer_address,
      "For this test, recepient address has to be different from entrepreneur's address"
    );
    assert.notEqual(await c.entAccount, await c.recepientAccount);
  });

  it("should have a positive target amount", async () => {
    // assert.isOk(AssuredCampaign.new(...params({ target: 1000000 })));
    // await tryCatch(
    //   AssuredCampaign.new(...params({ target: 0 })),
    //   errTypes.revert
    // );
    // await tryCatch(
    //   AssuredCampaign.new(...params({ target: -1 })),
    //   errTypes.revert
    // );
  });

  it("shouldn't overflow with the target specification");

  it("shouldn't have a positive stake percentage");

  it("shouldn't overflow with the stake percentage");

  it("should only receive stakes from the entrepreneur's hot account");

  it("should accept multiple staking payments before the pledging stage");

  it("shouldn't overflow when adding stakes");

  it("should accept and store pledges and their contributions");

  it("should detect whether a pledge exists");

  it("should be able to accept multiple pledging payments from the same person");

  it("shouldn't overflow with the pledging amount");

  it("shouldn't overflow with the pledging balance");

  it("should only refund to people with positive balance");

  it("shouldn't refund to people who have been refunded");

  it("should have refund amount that at least as much as the person's balance");

  it("should have a proportional refund amount");

  it("should be able to return the indivisible stakes to the entrepreneur's cold account");

  it("should only return the remaining stakes if it hasn't been returned before");

  it("should calculate the remaining stakes correctly");

  it("should have the entrepreneur's share as the stakedAmount plus the profitted amount");

  it("should have the recepient to receive everything but the entrepreneur's share");
});

// 2549405445, 8549405445, 50, 10, 2, 0x31119260c0Bd3a8Ad822878B687efc3AFB60B603, 0x31119260c0Bd3a8Ad822878B687efc3AFB60B603
