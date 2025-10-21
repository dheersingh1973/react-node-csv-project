import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './css/RedeemPointsPopup.css';

const RedeemPointsPopup = ({ onClose, onPointsRedeemed, mobileNumber: propMobileNumber }) => {
  const [mobileNumber, setMobileNumber] = useState(propMobileNumber || sessionStorage.getItem('mobileNumber') || '');
  const [pointsBalance, setPointsBalance] = useState(0);
  const [eligiblePoints, setEligiblePoints] = useState(0);
  const [pointsToRedeemInput, setPointsToRedeemInput] = useState('');
  const [pointsDiscountAmount, setPointsDiscountAmount] = useState(0);
  const [message, setMessage] = useState('');
  const [showPointsInput, setShowPointsInput] = useState(false);

  useEffect(() => {
    if (propMobileNumber) {
      fetchPointsBalance(propMobileNumber);
    } else if (sessionStorage.getItem('mobileNumber')) {
      fetchPointsBalance(sessionStorage.getItem('mobileNumber'));
    }
  }, [propMobileNumber]);

  const fetchPointsBalance = async (number) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/points/balance?mobile_number=${number}`);
      const balance = response.data.balance_after || 0;
      setPointsBalance(balance);
      if (balance < 100) {
        setEligiblePoints(0);
        setMessage('Total points are less than 100. Eligible points to redeem are 0.');
        setShowPointsInput(false);
      } else {
        setEligiblePoints(balance);
        setMessage(`You have ${balance} points. Eligible points to redeem: ${balance}`);
        setShowPointsInput(true);
      }
    } catch (error) {
      console.error('Error fetching points balance:', error);
      setMessage('Error fetching points balance. Please try again.');
      setPointsBalance(0);
      setEligiblePoints(0);
      setShowPointsInput(false);
    }
  };

  const handleSubmitMobileNumber = () => {
    if (mobileNumber.length !== 10 || !/^[0-9]+$/.test(mobileNumber)) {
      setMessage('Please enter a valid 10-digit mobile number.');
      return;
    }
    sessionStorage.setItem('mobileNumber', mobileNumber); // Store mobile number in session storage
    fetchPointsBalance(mobileNumber);
  };

  const handlePointsToRedeemChange = (e) => {
    const value = e.target.value;
    if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 0)) {
      setPointsToRedeemInput(value);
      const points = parseInt(value);
      if (!isNaN(points) && points <= eligiblePoints && points % 10 === 0) {
        const discount = (points / 10) * 1; // $1 discount per 10 points
        setPointsDiscountAmount(discount);
        setMessage(`You are eligible for a $${discount.toFixed(2)} discount.`);
      } else if (!isNaN(points) && points % 10 !== 0) {
        setMessage('Points to redeem must be in multiples of 10.');
        setPointsDiscountAmount(0);
      } else if (!isNaN(points) && points > eligiblePoints) {
        setMessage(`Points to redeem cannot exceed eligible points (${eligiblePoints}).`);
        setPointsDiscountAmount(0);
      } else {
        setPointsDiscountAmount(0);
        setMessage('');
      }
    } else {
      setMessage('Please enter a valid number for points to redeem.');
      setPointsDiscountAmount(0);
    }
  };

  const handleConfirmRedemption = () => {
    const points = parseInt(pointsToRedeemInput);
    if (isNaN(points) || points <= 0 || points > eligiblePoints || points % 10 !== 0) {
      setMessage('Please enter a valid amount of points to redeem.');
      return;
    }
    onPointsRedeemed(points, pointsDiscountAmount);
    onClose();
  };

  return (
    <div className="redeem-points-modal-overlay">
      <div className="redeem-points-modal-content">
        <h2>Redeem Points</h2>

        {!showPointsInput && (
          <div className="input-group">
            <input
              type="tel"
              pattern="[0-9]{10}"
              placeholder="Enter your phone no."
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              maxLength="10"
            />
            <button onClick={handleSubmitMobileNumber}>Submit</button>
          </div>
        )}

        {message && <p className="redeem-points-message">{message}</p>}

        {mobileNumber && <p>Mobile Number: <strong>{mobileNumber}</strong></p>} {/* Display mobile number if available */}

        {showPointsInput && (
          <div className="points-info">
            <p><strong>Current Balance:</strong> {pointsBalance} points</p>
            <p><strong>Eligible to Redeem:</strong> {eligiblePoints} points</p>
            <div className="input-group">
              <input
                type="number"
                placeholder="Points to redeem (multiples of 10)"
                value={pointsToRedeemInput}
                onChange={handlePointsToRedeemChange}
              />
            </div>
            {pointsDiscountAmount > 0 && (
              <p className="discount-message">You are eligible for a ${pointsDiscountAmount.toFixed(2)} discount.</p>
            )}
            <button onClick={handleConfirmRedemption} disabled={pointsDiscountAmount <= 0}>OK</button>
          </div>
        )}

        <button onClick={onClose} className="close-button">Close</button>
      </div>
    </div>
  );
};

export default RedeemPointsPopup;
