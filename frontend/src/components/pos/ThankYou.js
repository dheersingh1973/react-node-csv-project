import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { generateReceipt } from '../../utils/receiptUtils'; // Import the generateReceipt function
import './css/ThankYou.css';
import axios from 'axios';

const ThankYou = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { orderId, cartGrandTotal } = location.state || { orderId: 'N/A', cartGrandTotal: 0 };

  const handleNewOrder = () => {
    navigate('/poscart');
  };

  const handlePrintBill = () => {
    if (orderId) {
      generateReceipt(orderId);
    } else {
      alert('Order ID not available for printing.');
    }
  };

  const handleSendBillByEmail = async () => {
    const toEmail = prompt('Please enter the recipient\'s email address:');
    if (!toEmail) {
      alert('Email address is required to send the bill.');
      return;
    }

    if (!orderId || cartGrandTotal === undefined) {
      alert('Order details are missing. Cannot send bill.');
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/api/send-bill-email', {
        toEmail,
        orderId,
        cartGrandTotal,
      });

      if (response.data.success) {
        alert('Bill sent to email successfully!');
      } else {
        alert(`Failed to send bill to email: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Error sending bill by email:', error);
      alert('An error occurred while trying to send the bill by email.');
    }
  };

  return (
    <div className="thank-you-container">
      <h2>Thank You for Your Order!</h2>
      <p>Your Order ID: <strong>{orderId}</strong></p>
      <p>Total Amount: <strong>$ {cartGrandTotal.toFixed(2)}</strong></p>

      <div className="thank-you-actions">
        <button className="action-button" onClick={handleNewOrder}>New Order</button>
        <button className="action-button" onClick={handlePrintBill}>Print Bill</button>
        <button className="action-button" onClick={handleSendBillByEmail}>Bill Send to Email</button>
      </div>
      <button className="action-button open-cash-register-button">Open Cash Register</button>
      <button className="action-button order-report-button" onClick={() => navigate('/order-report')}>Order report</button>
    </div>
  );
};

export default ThankYou;
