import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../PageTemplate.css';

const Pricebook = () => {
  const navigate = useNavigate();

  return (
    <div className="page-template">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back to Home
        </button>
        <h1>Pricebook</h1>
      </div>
      <div className="page-content">
        <div className="placeholder-content">
          <h2>💰 Pricebook Management</h2>
          <p>Manage product pricing and catalog information.</p>
          <div className="feature-list">
            <button className="action-button" onClick={() => navigate('/product-catalog')}>💰 Product Catalog</button>
            <button className="action-button" onClick={() => navigate('/price-management')}>💰 Price Management</button>
            <button className="action-button" onClick={() => navigate('/discount-report')}>📈 Discounts and promotions</button>
            <button className="action-button" onClick={() => navigate('/category-organization')}>⚙️ Category Organization</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricebook;




