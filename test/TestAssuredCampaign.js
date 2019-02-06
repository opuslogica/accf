const AssuredCampaign = artifacts.require("./AssuredCampaign.sol");

const params = (start, end, target, profit, minAmount, recepient) => {
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

  it("should compile correctly", async () => {
    assert.exists(await AssuredCampaign.new(...params()));
  });

});



