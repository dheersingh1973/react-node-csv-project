import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './css/ThankYou.css';

const ThankYou = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { orderId, cartGrandTotal } = location.state || { orderId: 'N/A', cartGrandTotal: 0 };

  const handleNewOrder = () => {
    navigate('/poscart');
  };

  return (
    <div className="thank-you-container">
      <h2>Thank You for Your Order!</h2>
      <p>Your Order ID: <strong>{orderId}</strong></p>
      <p>Total Amount: <strong>₹ {cartGrandTotal.toFixed(2)}</strong></p>

      <div className="thank-you-actions">
        <button className="action-button" onClick={handleNewOrder}>New Order</button>
        <button className="action-button">Print Bill</button>
        <button className="action-button">Bill Send to Email</button>
        <button className="action-button">Send to Whatsapp</button>
        <button className="action-button">Invoice</button>
        <button className="action-button">Share Bill</button>
      </div>
      <button className="action-button open-cash-register-button">Open Cash Register</button>
    </div>
  );
};

export default ThankYou;
