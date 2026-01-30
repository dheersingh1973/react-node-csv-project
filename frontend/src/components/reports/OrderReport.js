import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { generateReceipt } from '../../utils/receiptUtils';
import './css/OrderReport.css';

const OrderReport = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const fromPrintReceipts = location.state?.fromPrintReceipts || false;

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/orders-report');
        setOrders(response.data);
      } catch (err) {
        setError('Failed to fetch orders.');
        console.error('Error fetching order report:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  if (loading) {
    return <div className="order-report-container">Loading orders...</div>;
  }

  if (error) {
    return <div className="order-report-container" style={{ color: 'red' }}>{error}</div>;
  }

  const handleDetailsClick = (orderId) => {
    navigate(`/order-details/${orderId}`);
  };

  const handleGenerateReceipt = (orderId) => {
    generateReceipt(orderId);
  };

  return (
    <div className="order-report-container">
      <h1>{fromPrintReceipts ? 'Print Receipts' : 'Order Report'}</h1>
      {orders.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <table className="order-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Order Total</th>
              <th>Customer Phone No.</th>
              <th>Items Count</th>
              <th>Payment Mode</th>
              <th>Paid Status</th>
              <th>Sync Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.order_id}>
                <td>{order.order_id}</td>
                <td>${parseFloat(order.order_total).toFixed(2)}</td>
                <td>{order.customer_phone_no}</td>
                <td>{order.items_count}</td>
                <td>{order.payment_method}</td>
                <td>{order.order_status}</td>
                <td>
                  <span
                    className={`sync-status-label ${
                      order.is_sync === 0 ? 'not-synced' : 'synced'
                    }`}
                  >
                    {order.is_sync === 0 ? 'Not Synced' : 'Synced'}
                  </span>
                </td>
                <td>
                  <button
                    className="detail-button"
                    onClick={() => handleDetailsClick(order.order_id)}
                  >
                    Details
                  </button>
                  <button
                    className="receipt-button"
                    onClick={() => handleGenerateReceipt(order.order_id)}
                  >
                    Generate Receipt
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default OrderReport;
