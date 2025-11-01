import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './css/OrderPayment.css'; // We will create this CSS file next

const OrderPayment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartGrandTotal, checkoutDetails, cartItems } = location.state || { cartGrandTotal: 0, checkoutDetails: null, cartItems: [] };

  const [deliveryOption, setDeliveryOption] = useState('Take Away');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [cashTendered, setCashTendered] = useState('');
  const [amountReturned, setAmountReturned] = useState(0);

  const handleCashTenderedChange = (e) => {
    setCashTendered(e.target.value);
  };

  const calculateChange = () => {
    const tendered = parseFloat(cashTendered);
    if (!isNaN(tendered) && tendered >= cartGrandTotal) {
      setAmountReturned(tendered - cartGrandTotal);
    } else {
      setAmountReturned(0);
    }
  };

  const handlePlaceOrder = async () => {
    if (paymentMethod === 'Cash' && parseFloat(cashTendered) < cartGrandTotal) {
      alert('Cash tendered is less than the total amount.');
      return;
    }

    try {
      const orderData = {
        userId: checkoutDetails.userId,
        cartId: checkoutDetails.cartId,
        cartGrandTotal: cartGrandTotal,
        paymentMethod: paymentMethod,
        cart_items: cartItems, // Use cartItems from navigation state
      };

      const response = await axios.post('http://localhost:5000/api/place-order', orderData);

      if (response.status === 201) {
        alert('Order placed successfully!');
        sessionStorage.removeItem('mobileNumber'); // Clear mobile number from session storage
        sessionStorage.removeItem('isPointsApplied'); // Clear points applied flag
        navigate('/thank-you', { 
            state: { 
                orderId: response.data.orderId, 
                cartGrandTotal: cartGrandTotal,
                cartItems: cartItems, // Pass cart items
                checkoutDetails: checkoutDetails, // Pass checkout details
                discountApplied: 0, // Placeholder
                pointsRedeemed: 0, // Placeholder
                amountSavedAgainstMRP: 0, // Placeholder
                groupedItems: [], // Placeholder
                paymentMethod: paymentMethod, // Pass payment method
                amountReturned: amountReturned // Pass amount returned
            } 
        });
      } else {
        alert('Failed to place order. Please try again.');
      }

    } catch (error) {
      console.error('Error placing order:', error);
      alert('Error placing order. Please try again.');
    }
  };

  return (
    <div className="order-payment-container">
      <div className="order-payment-header">
        <h1>Grand Total</h1>
        <p className="grand-total-amount">$ {cartGrandTotal.toFixed(2)}</p>
      </div>

      <div className="order-summary-details">
        <p>SUB TOTAL: <span>$ {cartGrandTotal.toFixed(2)}</span></p>
        <p>DELIVERY CHARGE: <span>$ 0.00</span></p>
        <p>DISCOUNT: <span>$ 0.00</span></p>
        <p>CHANGE DUE: <span>$ {amountReturned > 0 ? amountReturned.toFixed(2) : '0.00'}</span></p>
      </div>

      <div className="options-grid">
        <div className="delivery-option-section">
          <h2>DELIVERY OPTION</h2>
          <div className="option-buttons">
            <button 
              className={deliveryOption === 'Take Away' ? 'selected' : ''}
              onClick={() => setDeliveryOption('Take Away')}
            >
              Take Away
            </button>
            <button 
              className={deliveryOption === 'Delivery' ? 'selected' : ''}
              onClick={() => setDeliveryOption('Delivery')}
            >
              Delivery
            </button>
          </div>
        </div>

        <div className="payment-method-section">
          <h2>PAYMENT METHOD</h2>
          <div className="option-buttons">
            <button 
              className={paymentMethod === 'Cash' ? 'selected' : ''}
              onClick={() => setPaymentMethod('Cash')}
            >
              Cash
            </button>
            <button 
              className={paymentMethod === 'Card' ? 'selected' : ''}
              onClick={() => setPaymentMethod('Card')}
            >
              Card
            </button>
            <button 
              className={paymentMethod === 'UPI' ? 'selected' : ''}
              onClick={() => setPaymentMethod('UPI')}
            >
              UPI
            </button>
          </div>

          {paymentMethod === 'Cash' && (
            <div className="cash-fields">
              <input
                type="number"
                placeholder="Cash Tendered"
                value={cashTendered}
                onChange={handleCashTenderedChange}
              />
              <button onClick={calculateChange}>Calculate Change</button>
              {amountReturned > 0 && (
                <p>Amount to be Returned: $ {amountReturned.toFixed(2)}</p>
              )}
            </div>
          )}

          {paymentMethod === 'Card' && (
            <div className="card-fields">
              <input type="text" placeholder="Card Number" />
              <input type="text" placeholder="Card Holder Name" />
              <input type="text" placeholder="Expiry Date (MM/YY)" />
              <input type="text" placeholder="CVV" />
            </div>
          )}

          {paymentMethod === 'UPI' && (
            <div className="upi-fields">
              <input type="text" placeholder="Enter UPI ID" />
              <button>Submit</button>
            </div>
          )}
        </div>
      </div>

      <div className="payment-actions">
        <button className="continue-button" onClick={handlePlaceOrder}>Continue</button>
      </div>
    </div>
  );
};

export default OrderPayment;
