pragma solidity ^0.5.3;

contract AssuredCampaign {

    uint256 public startTime;
    uint256 public deadline;

    address public entHotAccount;
    address payable public entColdAccount;
    address payable public recepientAccount;

    uint256 public targetAmount;
    uint256 public contribMinAmount;
    uint256 public monetaryIndivisibleAmount = 1;
    uint256 public entStakePct;
    uint256 public entProfitAmount;

    uint256 public stakedAmount;

    struct Pledge {
        address payable pledging_address;
        uint256 balance;
        bool refunded;
    }

    Pledge[] pledges;
    mapping (address => Pledge) addressToPledge;
    uint256 public amountRaised;

    bool entProfitted;
    bool entGotRemainingStake;
    bool recepientReceivedFunding;


    modifier _stakingStage()
    {
        require(now < startTime, "Entrepreneur can't stake after the start time");
        _;
    }


    modifier _pledgingStage()
    {
        require(startTime < now, "You can't pledge before the start time");
        require(now < deadline, "You can't pledge after the deadline");
        require(stakedAmount >= targetAmount * entStakePct, "Entrepreneur doesn't have enough staked to assure your pledge's profit in case of a failed campaign");
        _;
    }

    modifier _terminationStage()
    {
        require(amountRaised >= targetAmount + stakedAmount, "Can't distribute raised funds if the target amount isn't reached");
        require(now > deadline, "Can't distribute raised funds before the deadline");
        _;
    }

    modifier _refundingStage()
    {
        require(now > deadline, "Can't request a refund prior to the deadline");
        require(amountRaised <= targetAmount + stakedAmount, "Can't get a refund if the target amount is reached");
        _;
    }


    constructor(uint256 start, uint256 end, uint256 target, uint256 profit,
                uint256 minAmount, uint256 stakePct,
                address ent_hot_account, address payable ent_cold_account, address payable recepient)
    public
    {
        require(end - start > 24 hours, "The campaign's duration should at least be 24 hours");
        require(start > now + 1 minutes, "The start time should at least be a minute from now");
        require(profit < target, "Entrepreneur's profit should be less than the target raising amount");
        require(ent_hot_account != address(0x0));
        require(ent_cold_account != address(0x0));
        require(recepient != address(0x0));
        require(minAmount < target, "target amount should be greater than min contrib amount");
        require(target > 0, "target amount should be nonzero");
        require(stakePct > 0);
        startTime = start;
        deadline = end;
        entProfitAmount = profit;
        targetAmount = target;
        entHotAccount = ent_hot_account;
        entColdAccount = ent_cold_account;
        entStakePct = stakePct;
        recepientAccount = recepient;
        contribMinAmount = minAmount;
    }

    function stake(uint256 amount)
    public
    _stakingStage
    payable
    {
        require(amount == msg.value, "Transaction doesn't have enough value as the claimed amount");
        require(entHotAccount == msg.sender, "Only the entrepreneur's hot account can stake");
        stakedAmount += msg.value;
    }


    function pledge(uint256 amount)
    public
    _pledgingStage
    payable
    {
        require(amount == msg.value, "Transaction doesn't have enough value as the claimed amount");
        require(amount >= contribMinAmount, "Pledging amount should be no less than contribMinAmount");

        if (pledgeExists(msg.sender)) {
            addressToPledge[msg.sender].balance += amount;
        } else {
            Pledge memory newPledge = Pledge({
                pledging_address: address(msg.sender),
                balance: amount,
                refunded: false
            });
            pledges.push(newPledge);
        }
        amountRaised += amount;
    }


    function refund()
    _refundingStage
    public
    {
        require(addressToPledge[msg.sender].balance > 0, "must have pledged something to get a refund");
        require(!addressToPledge[msg.sender].refunded, "can't get a refund more than once");
        addressToPledge[msg.sender].refunded = true;
        msg.sender.transfer(addressToPledge[msg.sender].balance * (1 + stakedAmount / amountRaised));
    }

    function retrieveRemainingStake()
    _refundingStage
    public
    {
        require(msg.sender == entHotAccount, "Only the entrepreneur's hot account can retrieve the remaining stake");
        require(!entGotRemainingStake, "Can only retrieve the remaining stake once");
        uint256 remaining_stake = calculateRemainingStake();
        require(remaining_stake > 0, "No remainder; The stake is proportionally divisible for all pledgers");
        if (!entGotRemainingStake) {
            entGotRemainingStake = true;
            entColdAccount.transfer(remaining_stake);
        }
    }

    function satisfied_contract_termination_process()
    _terminationStage
    public
    {
        uint256 entShare = stakedAmount + entProfitAmount;
        uint256 recepientShare = amountRaised - entShare;
        if (!entProfitted) {
            entProfitted = true;
            entColdAccount.transfer(entShare);
        }
        if (!recepientReceivedFunding) {
            recepientReceivedFunding = true;
            recepientAccount.transfer(recepientShare);
        }
    }

    function pledgeExists(address a)
    public
    view
    returns (bool) {
        return !(
            addressToPledge[a].pledging_address == address(0x0) &&
            addressToPledge[a].balance == 0 &&
            !addressToPledge[a].refunded
        );
    }


    function calculateRemainingStake()
    internal
    view
    returns (uint256)
    {
        uint256 cursor;
        for (uint i; i < pledges.length; i++) {
            cursor += pledges[i].balance * stakedAmount / amountRaised;
        }

        uint256 remainder;
        if (cursor >= 0) {
            remainder = stakedAmount - cursor;
        }
        return remainder;
    }
}
