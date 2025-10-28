import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './css/DiscountReport.css';

const DiscountReport = () => {
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingCode, setEditingCode] = useState(null);
  const [editFormData, setEditFormData] = useState({
    expiry_date: '',
    usage_limit: '',
    status: '',
  });

  useEffect(() => {
    const fetchDiscounts = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/discounts');
        setDiscounts(response.data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDiscounts();
  }, []);

  const handleEditClick = (discount) => {
    setEditingCode(discount.discount_code);
    setEditFormData({
      expiry_date: discount.expiry_date ? new Date(discount.expiry_date).toISOString().split('T')[0] : '',
      usage_limit: discount.usage_limit,
      status: discount.status,
    });
  };

  const handleCancelClick = () => {
    setEditingCode(null);
    setEditFormData({
      expiry_date: '',
      usage_limit: '',
      status: '',
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData({ ...editFormData, [name]: value });
  };

  const handleSaveClick = async (discountCode) => {
    try {
      await axios.put(`http://localhost:5000/api/discounts/${discountCode}`, editFormData);
      setDiscounts((prevDiscounts) =>
        prevDiscounts.map((discount) =>
          discount.discount_code === discountCode
            ? { ...discount, ...editFormData, expiry_date: editFormData.expiry_date } // Update expiry_date for display consistency
            : discount
        )
      );
      setEditingCode(null);
      setEditFormData({
        expiry_date: '',
        usage_limit: '',
        status: '',
      });
    } catch (err) {
      console.error('Error updating discount:', err);
      setError(err);
    }
  };

  if (loading) {
    return <div className="discount-report-container"><p>Loading discounts...</p></div>;
  }

  if (error) {
    return <div className="discount-report-container"><p>Error: {error.message}</p></div>;
  }

  return (
    <div className="discount-report-container">
      <h2>Discounts and Offers Report</h2>
      <div className="table-responsive">
        <table className="discount-table">
            <thead>
              <tr>
                <th>Discount Code</th>
                <th>Type</th>
                <th>Value</th>
                <th>Min Cart Value</th>
                <th>Max Cart Applicable</th>
                <th>Usage Limit</th>
                <th>Start Date</th>
                <th>Expiry Date</th>
                <th>Total Redeems</th>
                <th>Status</th>
                <th>Sync Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((discount) => (
                <tr key={discount.discount_code}>
                  <td>{discount.discount_code}</td>
                  <td>{discount.discount_type === 'P' ? 'Percentage' : 'Value'}</td>
                  <td>{discount.discount_value}</td>
                  <td>{discount.min_cart_value || 'N/A'}</td>
                  <td>{discount.max_cart_applicable || 'N/A'}</td>
                  <td>{discount.usage_limit}</td>
                  <td>{new Date(discount.start_date).toLocaleDateString()}</td>
                  <td>
                    {editingCode === discount.discount_code ? (
                      <input
                        type="date"
                        name="expiry_date"
                        value={editFormData.expiry_date}
                        onChange={handleInputChange}
                      />
                    ) : (
                      new Date(discount.expiry_date).toLocaleDateString()
                    )}
                  </td>
                  <td>{discount.total_redeems || 0}</td>
                  <td>
                    {editingCode === discount.discount_code ? (
                      <select
                        name="status"
                        value={editFormData.status}
                        onChange={handleInputChange}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    ) : (
                      discount.status
                    )}
                  </td>
                  <td>
                    <span
                      className={`sync-status-label ${
                        discount.is_sync === 0 ? 'not-synced' : 'synced'
                      }`}
                    >
                      {discount.is_sync === 0 ? 'Not Synced' : 'Synced'}
                    </span>
                  </td>
                  <td>
                    {editingCode === discount.discount_code ? (
                      <div className="edit-form-actions">
                        <button className="save-button" onClick={() => handleSaveClick(discount.discount_code)}>Save</button>
                        <button className="cancel-button" onClick={handleCancelClick}>Cancel</button>
                      </div>
                    ) : (
                      <button className="edit-button" onClick={() => handleEditClick(discount)}>Edit</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
  );
};

export default DiscountReport;
