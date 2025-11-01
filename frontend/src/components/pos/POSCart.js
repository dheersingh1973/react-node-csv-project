import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import RedeemPointsPopup from './RedeemPointsPopup'; // Import the new component
import './css/POSCart.css';

const POSCart = () => {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showMobileInputModal, setShowMobileInputModal] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const navigate = useNavigate();
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [discountMessage, setDiscountMessage] = useState('');
  const [itemsPrice, setItemsPrice] = useState(0); // New state to store total price of items before discount
  const [pointsRedeemed, setPointsRedeemed] = useState(0);
  const [pointsAmountDiscount, setPointsAmountDiscount] = useState(0);
  const [showRedeemPointsModal, setShowRedeemPointsModal] = useState(false); // New state for modal visibility

  useEffect(() => {
    fetchCategories();
    const storedMobileNumber = sessionStorage.getItem('mobileNumber');
    const storedIsPointsApplied = sessionStorage.getItem('isPointsApplied');
    if (storedMobileNumber && storedIsPointsApplied === 'true') {
      setMobileNumber(storedMobileNumber);
    }
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProductsByCategory = async (categoryId) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/products?category=${categoryId}`);
      setProducts(response.data);
      setSearchResults([]); // Clear search results when a new category is selected
    } catch (error) {
      console.error('Error fetching products by category:', error);
    }
  };

  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    fetchProductsByCategory(category.category_id);
  };

  const handleSearch = async () => {
    if (searchTerm.trim() === '') {
      setSearchResults([]);
      if (selectedCategory) {
        fetchProductsByCategory(selectedCategory.category_id);
      } else {
        setProducts([]); // Clear products if no category selected and search is empty
      }
      return;
    }
    try {
      // Assuming the API supports searching by product or brand name
      const response = await axios.get(`http://localhost:5000/api/products?search=${searchTerm}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error('Error searching products:', error);
    }
  };

  const addToCart = (product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.product === product.product);
      if (existingItem) {
        return prevCart.map((item) =>
          item.product === product.product ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prevCart, { ...product, quantity: 1, available_quantity: product.quantity }];
      }
    });
  };

  const updateCartQuantity = (productName, newQuantity) => {
    setCart((prevCart) => {
      if (newQuantity <= 0) {
        return prevCart.filter((item) => item.product !== productName);
      } else {
        const updatedCart = prevCart.map((item) =>
          item.product === productName ? { ...item, quantity: newQuantity } : item
        );
        return updatedCart;
      }
    });
  };

  const calculateTotal = useCallback(() => {
    const subtotal = cart.reduce((total, item) => total + item.quantity * item.sale_price, 0);
    return (subtotal - appliedDiscount - pointsAmountDiscount).toFixed(2);
  }, [cart, appliedDiscount, pointsAmountDiscount]);

  const calculateTotalItems = useCallback(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  const calculateTotalUniqueItems = useCallback(() => {
    return cart.length;
  }, [cart]);

  const calculateItemsPrice = useCallback(() => {
    return cart.reduce((total, item) => total + item.quantity * item.sale_price, 0);
  }, [cart]);

  const handleApplyDiscount = useCallback(async () => {
    if (discountCode.trim() === '') {
      setDiscountMessage('Please enter a discount code.');
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/api/apply-discount', {
        discount_code: discountCode.trim(),
        cart_total: parseFloat(calculateTotal()),
      });

      if (response.status === 200) {
        const discountData = response.data;
        setAppliedDiscount(discountData.discount_amount);
        setDiscountMessage(`Discount applied: -$${discountData.discount_amount.toFixed(2)}`);
        alert(`Discount applied: -$${discountData.discount_amount.toFixed(2)}`);
      } else {
        setAppliedDiscount(0);
        const errorMessage = response.data && response.data.message ? response.data.message : 'Failed to apply discount.';
        setDiscountMessage(errorMessage);
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error applying discount:', error);
      setAppliedDiscount(0);
      const errorMessage = error.response && error.response.data && error.response.data.message 
        ? error.response.data.message 
        : 'Error applying discount. Please try again.';
      setDiscountMessage(errorMessage);
      alert(errorMessage);
    }
  }, [calculateTotal, discountCode, setAppliedDiscount, setDiscountMessage]);

  const handleCheckout = () => {
    if (mobileNumber) { // If mobile number is already available, proceed directly to checkout logic
      handleMobileNumberSubmit();
    } else {
      setShowMobileInputModal(true);
    }
  };

  useEffect(() => {
    setItemsPrice(calculateItemsPrice());
  }, [calculateItemsPrice]);

  const handleMobileNumberSubmit = useCallback(async () => {
    if (mobileNumber.length !== 10 || !/^[0-9]+$/.test(mobileNumber)) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      if (pointsRedeemed > 0 || pointsAmountDiscount > 0) {
        sessionStorage.setItem('mobileNumber', mobileNumber); // Store mobile number in session storage if points are applied
        sessionStorage.setItem('isPointsApplied', 'true'); // Store flag if points are applied
      } else {
        sessionStorage.removeItem('mobileNumber');
        sessionStorage.removeItem('isPointsApplied');
      }
      const response = await axios.post('http://localhost:5000/api/checkout', {
        mobile_number: mobileNumber,
        cart_items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity })),
        total_quantity: calculateTotalItems(),
        cart_total: parseFloat(calculateTotal()),
        discount_code: discountCode,
        discount_amount: appliedDiscount,
        item_total_amount: itemsPrice, // Add this line
        points_redeemed: pointsRedeemed, // Add points redeemed
        points_discount_amount: pointsAmountDiscount, // Add points discount amount
      });

      if (response.status === 201) {
        console.log('Checkout successful:', response.data);
        setShowMobileInputModal(false);
        navigate('/order-payment', { 
          state: { 
            cartGrandTotal: parseFloat(calculateTotal()), 
            checkoutDetails: response.data, 
            cartItems: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity })) 
          }
        });
      } else {
        alert('Checkout failed. Please try again.');
      }
    } catch (error) {
      console.error('Error during checkout:', error);
      alert('Error during checkout. Please try again.');
    }
  }, [mobileNumber, cart, calculateTotalItems, calculateTotal, discountCode, appliedDiscount, setShowMobileInputModal, navigate, itemsPrice, pointsRedeemed, pointsAmountDiscount]);

  const handleRedeemPoints = useCallback(() => {
    setShowRedeemPointsModal(true); // Show the redeem points modal
  }, []);

  const handlePointsRedeemed = useCallback((points, amount) => {
    setPointsRedeemed(points);
    setPointsAmountDiscount(amount);
    setShowRedeemPointsModal(false);
  }, []);

  const productsToDisplay = searchResults.length > 0 ? searchResults : products;

  return (
    <div className="pos-cart-container">
      <div className="categories-pane">
        <h2>Categories</h2>
        <div className="category-list">
          {categories.map((category, index) => (
            <div key={index} className={`category-item ${selectedCategory && selectedCategory.category_id === category.category_id ? 'selected' : ''}`}
              onClick={() => handleCategoryClick(category)}>
              {category.category}
            </div>
          ))}
        </div>
      </div>
      <div className="products-pane">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by brand or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') handleSearch(); }}
          />
          <button onClick={handleSearch}>Search</button>
        </div>
        <h2>Products {selectedCategory ? `in ${selectedCategory.category}` : ''}</h2>
        <div className="product-list">
          {productsToDisplay.map((product, index) => (
            <div key={index} className="product-item" onClick={() => addToCart(product)}>
              <h3>{product.product}</h3>
              <p>{product.brand}</p>
              <p>${product.sale_price}</p>
              <p>Available: {product.quantity || 'N/A'}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="cart-pane">
        <h2>Cart</h2>
        {cart.length === 0 ? (
          <p>Cart is empty</p>
        ) : (
          <div className="cart-items">
            {cart.map((item, index) => (
              <div key={index} className="cart-item">
                <div>
                  <h3>{item.product}</h3>
                  <p>{item.brand}</p>
                  <p>${item.sale_price} x {item.quantity}</p>
                </div>
                <div className="quantity-controls">
                  <button onClick={() => updateCartQuantity(item.product, item.quantity - 1)}>-</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateCartQuantity(item.product, item.quantity + 1)}>+</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="discount-section">
          <input
            type="text"
            placeholder="Discount Code"
            value={discountCode}
            onChange={(e) => setDiscountCode(e.target.value)}
            className="discount-input"
          />
          <button onClick={handleApplyDiscount} className="apply-discount-button">Apply</button>
          <button onClick={handleRedeemPoints} className="redeem-points-button">Redeem Points</button>
          {discountMessage && <p className="discount-message">{discountMessage}</p>}
        </div>
        <div className="cart-summary">
          <div className="summary-row">
            <p><strong>Total Items:</strong> {calculateTotalUniqueItems()}</p>
            <p><strong>Total Qty:</strong> {calculateTotalItems()}</p>
          </div>
          <div className="summary-row">
            <p><strong>Items Price:</strong> ${itemsPrice.toFixed(2)}</p>
            <p><strong>Discount Applied:</strong> {appliedDiscount > 0 ? `-$${appliedDiscount.toFixed(2)}` : '-$0.00'}</p>
          </div>
          <div className="summary-row">
            <p><strong>Points Redeemed:</strong> {pointsRedeemed}</p>
            <p><strong>Points Amt. Discount:</strong> -${pointsAmountDiscount.toFixed(2)}</p>
          </div>
          <div className="summary-row total-row">
            <h3>Total: ${calculateTotal()}</h3>
            <button className="checkout-button" onClick={handleCheckout}>Checkout</button>
          </div>
        </div>

        {showMobileInputModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Enter Mobile Number</h2>
              <input
                type="tel"
                pattern="[0-9]{10}"
                placeholder="10-digit mobile number"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                maxLength="10"
              />
              <button onClick={handleMobileNumberSubmit}>OK</button>
              <button onClick={() => setShowMobileInputModal(false)}>Cancel</button>
            </div>
          </div>
        )}

        {showRedeemPointsModal && (
          <RedeemPointsPopup
            onClose={() => setShowRedeemPointsModal(false)}
            onPointsRedeemed={handlePointsRedeemed}
            mobileNumber={mobileNumber} // Pass mobile number if already entered
          />
        )}

      </div>
    </div>
  );
};

export default POSCart;
