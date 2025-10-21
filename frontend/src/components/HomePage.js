import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

const HomePage = ({ menuItems }) => {
  const navigate = useNavigate();

  const handleMenuClick = (path) => {
    navigate(path);
  };

  return (
    <div className="homepage">
      <div className="header">
        <h1 className="welcome-title">Welcome</h1>
      </div>
      
      <div className="menu-grid">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className="menu-button"
            style={{ '--button-color': item.color }}
            onClick={() => handleMenuClick(item.path)}
          >
            <div className="menu-icon">{item.icon}</div>
            <div className="menu-title">{item.title}</div>
          </button>
        ))}
      </div>
      
      <div className="footer">
      </div>
    </div>
  );
};

export default HomePage;




