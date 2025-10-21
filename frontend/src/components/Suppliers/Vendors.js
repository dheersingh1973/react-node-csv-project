import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../PageTemplate.css';

const Vendors = () => {
  const navigate = useNavigate();

  return (
    <div className="page-template">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back to Home
        </button>
        <h1>Vendors</h1>
      </div>
      <div className="page-content">
        <div className="placeholder-content">
          <h2>🚚 Vendor Management</h2>
          <p>Manage supplier relationships and procurement.</p>
          <div className="feature-list">
            <div className="feature-item">• Vendor directory</div>
            <div className="feature-item">• Purchase orders</div>
            <div className="feature-item">• Supplier performance</div>
            <div className="feature-item">• Contact management</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Vendors;




