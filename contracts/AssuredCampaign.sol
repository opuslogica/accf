pragma solidity ^0.5.4;

import { SafeMath } from "./SafeMath.sol";
import { Ownable } from "./Ownable.sol";

contract AssuredCampaign is Ownable {

    uint256 public startTime;
    uint256 public deadline;

    address public entHotAccount;
    address payable public entColdAccount;
    address payable public recepientAccount;

    uint256 public targetAmount;
    uint256 public contribMinAmount;
    uint256 entStakePct;
    uint256 public minStakeRequired;
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

    event newStake(
        uint256 amount,
        bool thereIsEnoughStaked
    );

    modifier _pledgingStage()
    {
        require(startTime < now, "You can't pledge before the start time");
        require(now < deadline, "You can't pledge after the deadline");
        require(stakedAmount >= minStakeRequired, "Entrepreneur doesn't have enough staked to assure your pledge's profit in case of a failed campaign");
        _;
    }

    event newPledge(
        uint256 amount,
        uint256 raised_thus_far,
        uint256 pledge_count
    );

    modifier _terminationStage()
    {
        require(amountRaised >= SafeMath.add(targetAmount, stakedAmount), "Can't distribute raised funds if the target amount isn't reached");
        require(now > deadline, "Can't distribute raised funds before the deadline");
        _;
    }

    event entShareDelivery(
        uint256 amount,
        uint256 current_balance
    );

    event recepientShareDelivery(
        uint256 amount,
        uint256 current_balance
    );

    modifier _refundingStage()
    {
        require(now > deadline, "Can't request a refund prior to the deadline");
        require(amountRaised <= SafeMath.add(targetAmount, stakedAmount), "Can't get a refund if the target amount is reached");
        _;
    }

    event newRefund(
        uint256 amount,
        uint256 current_balance
    );

    event gotRemainingStake(
        uint256 amount,
        uint256 current_balance
    );


    constructor(uint256 start, uint256 end, uint256 target, uint256 profit,
                uint256 minAmount, uint256 stakePct,
                address ent_hot_account, address payable ent_cold_account, address payable recepient)
    public
    {
        require(end - start >= 24 hours, "The campaign's duration should at least be 24 hours");
        require(start - now >= 1 minutes, "The start time should at least be a minute from now");
        require(profit < target, "Entrepreneur's profit should be less than the target raising amount");
        require(ent_hot_account != address(0x0), "An account should be nonzero");
        require(ent_cold_account != address(0x0), "An account should be nonzero");
        require(recepient != address(0x0), "An account should be nonzero");
        require(minAmount < target, "target amount should be greater than min contrib amount");
        require(target > 0, "target amount should be nonzero");
        require(stakePct > 0, "campaign must have a positive staking percentage");
        startTime = start;
        deadline = end;
        entProfitAmount = profit;
        targetAmount = target;
        entHotAccount = ent_hot_account;
        entColdAccount = ent_cold_account;
        entStakePct = stakePct;
        minStakeRequired = SafeMath.div(SafeMath.mul(entStakePct, targetAmount), 100);
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
        stakedAmount = SafeMath.add(stakedAmount, msg.value);
        emit newStake(amount, stakedAmount >= minStakeRequired);
    }


    function pledge(uint256 amount)
    public
    _pledgingStage
    payable
    {
        require(amount == msg.value, "Transaction doesn't have enough value as the claimed amount");
        require(amount >= contribMinAmount, "Pledging amount should be no less than contribMinAmount");

        if (_pledgeExists(msg.sender)) {
            addressToPledge[msg.sender].balance = SafeMath.add(
                addressToPledge[msg.sender].balance, amount
            );
        } else {
            Pledge memory p = Pledge({
                pledging_address: address(msg.sender),
                balance: amount,
                refunded: false
            });
            pledges.push(p);
            addressToPledge[msg.sender] = p;
        }
        amountRaised = SafeMath.add(amountRaised, amount);

        emit newPledge(amount, amountRaised, pledges.length);
    }


    function refund()
    public
    _refundingStage
    {
        require(addressToPledge[msg.sender].balance > 0, "must have pledged something to get a refund");
        require(!addressToPledge[msg.sender].refunded, "can't get a refund more than once");
        uint256 amount = addressToPledge[msg.sender].balance * (1 + stakedAmount / amountRaised);
        addressToPledge[msg.sender].refunded = true;
        msg.sender.transfer(amount);
        emit newRefund(amount, address(this).balance);
    }

    function retrieveRemainingStake()
    public
    _refundingStage
    {
        require(msg.sender == entHotAccount, "Only the entrepreneur's hot account can retrieve the remaining stake");
        require(!entGotRemainingStake, "Can only retrieve the remaining stake once");
        uint256 remaining_stake = calculateRemainingStake();
        require(remaining_stake > 0, "No remainder; The stake is proportionally divisible for all pledgers");
        if (!entGotRemainingStake) {
            entGotRemainingStake = true;
            entColdAccount.transfer(remaining_stake);
            emit gotRemainingStake(remaining_stake, address(this).balance);
        }
    }

    function satisfied_contract_termination_process()
    public
    _terminationStage
    {
        uint256 entShare = SafeMath.add(stakedAmount, entProfitAmount);
        uint256 recepientShare = SafeMath.sub(amountRaised, entShare);
        if (!entProfitted) {
            entProfitted = true;
            entColdAccount.transfer(entShare);
            emit entShareDelivery(entShare, address(this).balance);
        }
        if (!recepientReceivedFunding) {
            recepientReceivedFunding = true;
            recepientAccount.transfer(recepientShare);
            emit recepientShareDelivery(recepientShare, address(this).balance);
        }
    }

    function _pledgeExists(address a)
    internal
    view
    returns (bool) {
        return !(
            addressToPledge[a].pledging_address == address(0x0) &&
            addressToPledge[a].balance == 0 &&
            !addressToPledge[a].refunded
        );
    }

    function pledgeExists(address a)
    public
    onlyOwner
    view
    returns (bool) {
        return _pledgeExists(a);
    }

    function fetchPledgeBalance(address a)
    public
    onlyOwner
    view
    returns (uint256) {
        require(_pledgeExists(a));
        for (uint i; i < pledges.length; i++) {
            if (pledges[i].pledging_address == a) {
                return pledges[i].balance;
            }
        }
        return 0;
    }

    function hasPledgeBeenRefunded(address a)
    public
    onlyOwner
    view
    returns (bool) {
        require(_pledgeExists(a));
        for (uint i; i < pledges.length; i++) {
            if (pledges[i].pledging_address == a) {
                return pledges[i].refunded;
            }
        }
    }

    function pledgeCount()
    public
    view
    returns (uint) {
        return pledges.length;
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
            remainder = SafeMath.sub(stakedAmount, cursor);
        }
        return remainder;
    }
}
