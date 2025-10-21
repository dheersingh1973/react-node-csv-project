import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../PageTemplate.css';

const StoreStatus = () => {
  const navigate = useNavigate();

  return (
    <div className="page-template">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back to Home
        </button>
        <h1>Store Status</h1>
      </div>
      <div className="page-content">
        <div className="placeholder-content">
          <h2>🏪 Store Status Dashboard</h2>
          <p>Monitor store operations and performance metrics.</p>
          <div className="feature-list">
            <div className="feature-item">• Real-time sales data</div>
            <div className="feature-item">• Inventory levels</div>
            <div className="feature-item">• Staff performance</div>
            <div className="feature-item">• Store analytics</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreStatus;




