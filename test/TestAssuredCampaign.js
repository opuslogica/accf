const AssuredCampaign = artifacts.require("./AssuredCampaign.sol");
const tryCatch = require("./helpers/exceptions").tryCatch;
const errTypes = require("./helpers/exceptions").errTypes;
const jumpForward = require("./helpers/time").jumpForward;
const make_snapshot = require("./helpers/time").make_snapshot;
const goto_snapshot = require("./helpers/time").goto_snapshot;

const deployer_address = AssuredCampaign.class_defaults.from;

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
    start || current_time - 120,
    end || (start || current_time) - 420,
    target || 50,
    profit || 10,
    minAmount || 2,
    stakePct || 10,
    ent_hot_account || deployer_address,
    ent_cold_account || deployer_address,
    recepient || deployer_address
  ];
};


contract("Testing campaign", async accounts => {

  let starting_point;

  beforeEach(() => {
    make_snapshot(Date.now(), (err, res) => {
      starting_point = res.result;
    });
  });

  afterEach(() => goto_snapshot(starting_point));

  it("should deploy without an error", async () => {
    let a = await AssuredCampaign.new(...params({}));
    assert.exists(await AssuredCampaign.new(...params({})));
  });

  it("should have a far enough start time", async () => {
    await tryCatch(
      AssuredCampaign.new(...params({ start: 1 })),
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
    let recepient = "0x31119260c0Bd3a8Ad822878B687efc3AFB60B603";
    let c = await AssuredCampaign.new(...params({ recepient }));
    assert.notEqual(
      recepient,
      deployer_address,
      "For this test, recepient address has to be different from entrepreneur's address"
    );
    assert.notEqual(await c.entAccount, await c.recepientAccount);
  });
});

// 2549405445, 8549405445, 50, 10, 2, 0x31119260c0Bd3a8Ad822878B687efc3AFB60B603, 0x31119260c0Bd3a8Ad822878B687efc3AFB60B603
