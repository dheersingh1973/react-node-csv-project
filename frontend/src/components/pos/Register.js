import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../PageTemplate.css';

const Register = () => {
  const navigate = useNavigate();

  return (
    <div className="page-template">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back to Home
        </button>
        <h1>Register</h1>
      </div>
      <div className="page-content">
        <div className="placeholder-content">
          <h2>🛒 Register System</h2>
          <p>Point of Sale register functionality will be implemented here.</p>
          <div className="feature-list">
            <button className="action-button" onClick={() => navigate('/POScart')}>💰 Process Sales transactions</button>
            <button className="action-button" onClick={() => navigate('/order-report')}>📊 Order Report</button>
            <button className="action-button" onClick={() => navigate('/order-report', { state: { fromPrintReceipts: true } })}>🖨️ Print receipts</button>
            <div className="feature-item">• Manage returns and refunds</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;




