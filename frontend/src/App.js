import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import Register from './components/pos/Register';
import StoreStatus from './components/status/StoreStatus';
import Pricebook from './components/price/Pricebook';
import Vendors from './components/Suppliers/Vendors';
import Users from './components/staff/Users';
import TimeClock from './components/clock/TimeClock';
import ProductCatalog from './components/price/ProductCatalog'; // Import the new component
import PriceManagement from './components/price/PriceManagement'; // Import the new component
import CategoryOrganization from './components/price/CategoryOrganization'; // Import the new component
import POSCart from './components/pos/POSCart'; // Import POSCart component
import Header from './components/Header'; // Import the Header component
import OrderPayment from './components/pos/OrderPayment'; // Import OrderPayment component
import ThankYou from './components/pos/ThankYou'; // Import ThankYou component
import OrderReport from './components/reports/OrderReport'; // Import OrderReport component
import OrderDetails from './components/reports/OrderDetails'; // Import OrderDetails component
import DiscountReport from './components/reports/DiscountReport'; // Import DiscountReport component
import './App.css';

function App() {
  const menuItems = [
    {
      id: 'register',
      title: 'Register',
      icon: '🛒',
      path: '/register',
      color: '#4CAF50'
    },
    {
      id: 'store-status',
      title: 'Store Status',
      icon: '🏪',
      path: '/store-status',
      color: '#2196F3'
    },
    {
      id: 'pricebook',
      title: 'Pricebook',
      icon: '💰',
      path: '/pricebook',
      color: '#FF9800'
    },
    {
      id: 'vendors',
      title: 'Vendors',
      icon: '🚚',
      path: '/vendors',
      color: '#9C27B0'
    },
    {
      id: 'users',
      title: 'Users',
      icon: '👥',
      path: '/users',
      color: '#F44336'
    },
    {
      id: 'time-clock',
      title: 'Time Clock',
      icon: '⏰',
      path: '/time-clock',
      color: '#607D8B'
    }
  ];

  return (
    <Router>
      <div className="App">
        <Header menuItems={menuItems} /> {/* Pass menuItems as a prop */}
        <Routes>
          <Route path="/" element={<HomePage menuItems={menuItems} />} /> {/* Pass menuItems to HomePage */}
          <Route path="/register" element={<Register />} />
          <Route path="/poscart" element={<POSCart />} />
          <Route path="/order-payment" element={<OrderPayment />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/order-report" element={<OrderReport />} /> {/* Add new route for OrderReport */}
          <Route path="/order-details/:orderId" element={<OrderDetails />} /> {/* Add new route for OrderDetails */}
          <Route path="/store-status" element={<StoreStatus />} />
          <Route path="/pricebook" element={<Pricebook />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/users" element={<Users />} />
          <Route path="/time-clock" element={<TimeClock />} />
          <Route path="/product-catalog" element={<ProductCatalog />} /> {/* Add new route */}
          <Route path="/price-management" element={<PriceManagement />} /> {/* Add new route */}
          <Route path="/category-organization" element={<CategoryOrganization />} /> {/* Add new route */}
          <Route path="/discount-report" element={<DiscountReport />} /> {/* Add new route for DiscountReport */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;




