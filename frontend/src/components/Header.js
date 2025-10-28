import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './css/Header.css';
import { STORE_NAME, POS_NAME } from '../utils/config';

const Header = ({ menuItems }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(navigator.onLine);
  const [isGlobalDbConnected, setIsGlobalDbConnected] = useState(false);

  useEffect(() => {
    const pingInternet = async () => {
      let internetStatus = false;
      try {
        const timestamp = new Date().getTime();
        await fetch(`https://www.google.com/favicon.ico?_=${timestamp}`, { mode: 'no-cors' });
        internetStatus = true;
      } catch (error) {
        internetStatus = false;
      }
      setIsConnected(internetStatus);

      if (internetStatus) {
        try {
          const dbStatusResponse = await fetch('http://localhost:5000/api/db-status');
          const dbStatus = await dbStatusResponse.json();
          setIsGlobalDbConnected(dbStatus.globalConnected);

          if (!dbStatus.globalConnected) {
            console.log("Internet connected but global DB not. Attempting reconnection...");
            const reconnectResponse = await fetch('http://localhost:5000/api/reconnect-global-db', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            });
            const reconnectResult = await reconnectResponse.json();
            setIsGlobalDbConnected(reconnectResult.connected);
            if (reconnectResult.connected) {
              console.log("Global DB reconnected successfully.");
            } else {
              console.warn("Failed to reconnect global DB.");
            }
          }
        } catch (dbError) {
          console.error('Error checking/reconnecting global DB:', dbError);
          setIsGlobalDbConnected(false);
          // Call the new API to signal global DB connection failure to the backend
          fetch('http://localhost:5000/api/global-db-failed', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }).catch(apiError => console.error('Error reporting global DB failure to backend:', apiError));
        }
      } else {
        setIsGlobalDbConnected(false);
        // Call the new API to signal global DB connection failure to the backend
        fetch('http://localhost:5000/api/global-db-failed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }).catch(apiError => console.error('Error reporting global DB failure to backend:', apiError));
      }
    };

    pingInternet(); // Initial check
    const intervalId = setInterval(pingInternet, 30000); // Ping every 30 seconds

    const handleOnline = () => {
      setIsConnected(true);
      pingInternet(); // Immediately check DB status on regaining internet
    };
    const handleOffline = () => {
      setIsConnected(false);
      setIsGlobalDbConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
        <span className="store-name">{STORE_NAME}</span>
        <span className="pos-name">{POS_NAME}</span>
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
        </div>
        <div className={`connectivity-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? 'Internet Connected' : 'Internet Disconnected'}
        </div>
        <div className={`connectivity-indicator ${isGlobalDbConnected ? 'connected' : 'disconnected'}`}>
          {isGlobalDbConnected ? 'Global DB Connected' : 'Global DB Disconnected'}
        </div>
        <span className="user-name">Hi Dheer Singh</span>
        <div className="user-icon">
          👤
      </div>
    </header>
  );
};

export default Header;
