import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import '../reports/css/OrderDetails.css'; // Import the CSS file

const OrderDetails = () => {
  const { orderId } = useParams();
  const [orderDetails, setOrderDetails] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrderData = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`http://localhost:5000/api/order-details/${orderId}`);
        setOrderDetails(response.data.orderDetails);
        setOrderItems(response.data.orderItems);
      } catch (err) {
        setError('Failed to fetch order details.');
        console.error('Error fetching order details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [orderId]);

  if (loading) {
    return <div className="order-details-container">Loading order details...</div>;
  }

  if (error) {
    return <div className="order-details-container" style={{ color: 'red' }}>{error}</div>;
  }

  if (!orderDetails) {
    return <div className="order-details-container">No order details found.</div>;
  }

  return (
    <div className="order-details-container">
      <h2>Order Details for Order ID: {orderId}</h2>

      <div className="order-details-grid">
        <div className="detail-item">
          <strong>Order ID:</strong> {orderDetails.order_id}
        </div>
        <div className="detail-item">
          <strong>Customer Mobile:</strong> {orderDetails.customer_mobile}
        </div>
        <div className="detail-item">
          <strong>Order Total:</strong> ${orderDetails.order_total}
        </div>
        <div className="detail-item">
          <strong>Item Count:</strong> {orderDetails.item_count}
        </div>
        <div className="detail-item">
          <strong>Payment Mode:</strong> {orderDetails.payment_mode}
        </div>
        <div className="detail-item">
          <strong>Order Status:</strong> {orderDetails.order_status}
        </div>
        <div className="detail-item">
          <strong>Discount Amount:</strong> ${orderDetails.discount_amount ? parseFloat(orderDetails.discount_amount).toFixed(2) : '0.00'}
        </div>
        <div className="detail-item">
          <strong>Coupon Code:</strong> {orderDetails.discount_code || 'N/A'}
        </div>
        <div className="detail-item">
          <strong>Item Total Amount:</strong> ${orderDetails.item_total_amount ? parseFloat(orderDetails.item_total_amount).toFixed(2) : '0.00'}
        </div>
      </div>

      <h3>Order Items</h3>
      <table className="order-items-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Quantity</th>
            <th>Sale Price</th>
            <th>Brand</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {orderItems.map((item, index) => (
            <tr key={index}>
              <td>{item.product_name}</td>
              <td>{item.product_quantity}</td>
              <td>${parseFloat(item.sale_price).toFixed(2)}</td>
              <td>{item.brand}</td>
              <td>{item.product_type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default OrderDetails;
