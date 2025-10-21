import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../PageTemplate.css';

const TimeClock = () => {
  const navigate = useNavigate();

  return (
    <div className="page-template">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back to Home
        </button>
        <h1>Time Clock</h1>
      </div>
      <div className="page-content">
        <div className="placeholder-content">
          <h2>⏰ Time Clock System</h2>
          <p>Track employee hours and attendance.</p>
          <div className="feature-list">
            <div className="feature-item">• Clock in/out</div>
            <div className="feature-item">• Hours tracking</div>
            <div className="feature-item">• Attendance reports</div>
            <div className="feature-item">• Schedule management</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeClock;




