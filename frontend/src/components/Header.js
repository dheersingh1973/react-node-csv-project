import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './css/Header.css';

const Header = ({ menuItems }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(navigator.onLine);

  useEffect(() => {
    const pingInternet = async () => {
      try {
        const timestamp = new Date().getTime();
        await fetch(`https://www.google.com/favicon.ico?_=${timestamp}`, { mode: 'no-cors' });
        setIsConnected(true);
        // Call backend syncUsers if connected
        try {
          await fetch('http://localhost:5000/api/sync-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          console.log('User sync initiated from frontend.');
        } catch (syncError) {
          console.error('Error initiating user sync:', syncError);
        }
      } catch (error) {
        setIsConnected(false);
      }
    };

    pingInternet(); // Initial check
    const intervalId = setInterval(pingInternet, 60000); // Ping every minute

    window.addEventListener('online', () => setIsConnected(true));
    window.addEventListener('offline', () => setIsConnected(false));

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', () => setIsConnected(true));
      window.removeEventListener('offline', () => setIsConnected(false));
    };
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="app-header">
      <div className="left-section">
        <button className="hamburger-menu" onClick={toggleMenu}>
          ☰
        </button>
        <span className="app-name">Demo POS App</span>
      </div>
      <nav className={`nav-menu ${isMenuOpen ? 'open' : ''}`}>
        <ul>
          {menuItems.map((item) => (
            <li key={item.id}>
              <Link to={item.path} onClick={toggleMenu}>
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="right-section">
        <span className="user-name">Hi Dheer Singh</span>
        <div className="user-icon">
          👤
        </div>
        <div className={`connectivity-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
    </header>
  );
};

export default Header;
