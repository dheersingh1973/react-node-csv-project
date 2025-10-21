import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../PageTemplate.css';

const Users = () => {
  const navigate = useNavigate();

  return (
    <div className="page-template">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back to Home
        </button>
        <h1>Users</h1>
      </div>
      <div className="page-content">
        <div className="placeholder-content">
          <h2>👥 User Management</h2>
          <p>Manage staff accounts and permissions.</p>
          <div className="feature-list">
            <div className="feature-item">• Staff directory</div>
            <div className="feature-item">• Role management</div>
            <div className="feature-item">• Access permissions</div>
            <div className="feature-item">• User activity logs</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Users;




