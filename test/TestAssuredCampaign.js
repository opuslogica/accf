const AssuredCampaign = artifacts.require("./AssuredCampaign.sol");
const tryCatch = require("./helpers/exceptions").tryCatch;
const errTypes = require("./helpers/exceptions").errTypes;

const deployer_address = AssuredCampaign.class_defaults.from;

const params = ({ start, end, target, profit, minAmount, ent, recepient }) => {
  let current_time = Date.now();
  return [
    start || current_time - 120,
    end || (start || current_time) - 420,
    target || 50,
    profit || 10,
    minAmount || 2,
    ent || deployer_address,
    recepient || deployer_address
  ];
};

contract("Testing campaign", async accounts => {
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

// 2549405445, 8549405445, 50, 10, 2, 0x31119260c0Bd3a8Ad822878B687efc3AFB60B603
