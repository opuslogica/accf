pragma solidity ^0.5.3;

contract AssuredCampaign {

    uint256 public startTime;
    uint256 public deadline;

    uint256 public entProfitAmount;
    address payable public entAccount;
    address payable public recepientAccount;
    uint256 public targetAmount;
    uint256 public contribMinAmount;
    uint256 public monetaryIndivisibleAmount = 1;

    mapping (address => uint256) balanceOf;
    mapping (address => bool) receivedRefunds;
    uint256 public amountRaised;

    bool entProfitted = false;
    bool recepientReceivedFunding = false;

    constructor(uint256 start, uint256 end, uint256 target, uint256 profit,
                uint256 minAmount, address payable recepient)
    public
    {
       require(end - start > 5 minutes);
       require(start > now + 1 minutes);
       require(profit < target);
    startTime = start;
    deadline = end;
    entProfitAmount = profit;
    targetAmount = target;
    entAccount = msg.sender;
    recepientAccount = recepient;
    contribMinAmount = minAmount;
    }

    function pledge(uint256 amount)
    public
    payable
    {
        require(amount == msg.value);
        require(msg.sender != entAccount);
        require(amount > contribMinAmount);
       require(startTime < now);
       require(now < deadline);
        require(balanceOf[entAccount] >= (targetAmount / contribMinAmount + 1) * monetaryIndivisibleAmount);
        balanceOf[msg.sender] = amount;
        receivedRefunds[msg.sender] = false;
        amountRaised += amount;
    }

    function stake(uint256 amount)
    public
    payable
    {
      require(now < startTime);
      require(amount == msg.value);
      require(entAccount == msg.sender);
      balanceOf[entAccount] += msg.value;
    }

    function refund()
    public
    {
      require(now > deadline);
      require(msg.sender != entAccount);
      require(!receivedRefunds[msg.sender]);
      require(address(this).balance <= targetAmount + balanceOf[entAccount]);
      receivedRefunds[msg.sender] = true;
      msg.sender.transfer(balanceOf[msg.sender] * (1 + balanceOf[entAccount] / amountRaised)
        );
    }

    function satisfied_contract_termination_process()
    public
    {
        require(msg.sender == entAccount);
        require(address(this).balance >= targetAmount + balanceOf[entAccount]);
       require(now > deadline);
        uint256 entShare = balanceOf[entAccount] + entProfitAmount;
        uint256 recepientShare = amountRaised - entShare;
        if (!entProfitted) {
            entProfitted = true;
            msg.sender.transfer(entShare);
        }
        if (!recepientReceivedFunding) {
            recepientReceivedFunding = true;
            recepientAccount.transfer(recepientShare);
        }
    }
}
