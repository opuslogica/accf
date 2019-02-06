const AssuredCampaign = artifacts.require("./AssuredCampaign.sol");
const tryCatch = require("./exceptions").tryCatch;
const errTypes = require("./exceptions").errTypes;

const params = ({start, end, target, profit, minAmount, recepient}) => {
  let current_time = Date.now();
  return [
    start || current_time - 120,
    end || (start || current_time) - 420,
    target || 50,
    profit || 10,
    minAmount || 2,
    recepient || "0x31119260c0Bd3a8Ad822878B687efc3AFB60B603"
  ];
};

contract("Testing campaign", async accounts => {

  it("should deploy without an error", async () => {
    assert.exists(await AssuredCampaign.new(...params({})));
  });

  it("should have a far enough start time", async () => {
    assert.isOk(await AssuredCampaign.new(...params({start: Date.now()})));
  });

  it("should an entrepreneur's profit less than the target raising amount", async () => {
    await tryCatch(
      AssuredCampaign.new(...params({profit:10, target:10})),
      errTypes.revert
    );
    await tryCatch(
      AssuredCampaign.new(...params({profit:11, target:10})),
      errTypes.revert
    );
    assert.isOk(await AssuredCampaign.new(...params({profit:9, target:10})));
  });

});



// 2549405445, 8549405445, 50, 10, 2, 0x31119260c0Bd3a8Ad822878B687efc3AFB60B603
