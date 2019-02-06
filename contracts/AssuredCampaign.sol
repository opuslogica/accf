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
        require(end - start > 5 minutes, "The deadline should be at least 5 minutes away from the start time");
        require(start > now + 1 minutes, "The start time should at least be a minute from now");
        require(profit < target, "Entrepreneur's profit should be less than the target raising amount");
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
        require(amount == msg.value, "Transaction doesn't have enough value as the claimed amount");
        require(msg.sender != entAccount, "Entrepreneur's can't pledge");
        require(amount > contribMinAmount, "Pledging amount should be greater than contribMinAmount");
        require(startTime < now, "You can't pledge before the start time");
        require(now < deadline, "You can't pledge after the deadline");
        require(balanceOf[entAccount] >= (targetAmount / contribMinAmount + 1) * monetaryIndivisibleAmount, "Entrepreneur doesn't have enough staked to assure your pledge's profit in case of a failed campaign");
        balanceOf[msg.sender] = amount;
        receivedRefunds[msg.sender] = false;
        amountRaised += amount;
    }

    function stake(uint256 amount)
    public
    payable
    {
        require(now < startTime, "Entrepreneur can't stake after the start time");
        require(amount == msg.value, "Transaction doesn't have enough value as the claimed amount");
        require(entAccount == msg.sender, "Only the entrepreneur can stake");
        balanceOf[entAccount] += msg.value;
    }

    function refund()
    public
    {
        require(now > deadline, "Can't request a refund prior to the deadline");
        require(msg.sender != entAccount, "Entrepreneur's can't take back their stake");
        require(!receivedRefunds[msg.sender], "Must have pledged something to refund");
        require(address(this).balance <= targetAmount + balanceOf[entAccount], "Can't get a refund if the target amount is reached");
        receivedRefunds[msg.sender] = true;
        msg.sender.transfer(balanceOf[msg.sender] * (1 + balanceOf[entAccount] / amountRaised));
    }

    function satisfied_contract_termination_process()
    public
    {
        require(msg.sender == entAccount, "Only Entrepreneur's can distribute raised funds");
        require(address(this).balance >= targetAmount + balanceOf[entAccount], "Can't distribute raised funds if the target amount isn't reached");
        require(now > deadline, "Can't distribute raised funds before the deadline");
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
