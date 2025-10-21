import React, { useState, useEffect, useCallback } from 'react';
import './css/PriceManagement.css'; // We'll create this CSS file next

const PriceManagement = () => {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null); // State to track which product is being edited
  const [newSalePrice, setNewSalePrice] = useState({}); // State to hold new sale prices
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Changed limit to 5 for this interface
      const response = await fetch(`http://localhost:5000/api/products?page=${page}&limit=5`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [page, setLoading, setError, setProducts]);

  useEffect(() => {
    fetchProducts();
  }, [page, fetchProducts]);

  const handleEditClick = (product) => {
    setEditingProduct(product.product_id);
    setNewSalePrice({ ...newSalePrice, [product.product_id]: product.sale_price });
  };

  const handleSaveClick = async (product) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:5000/api/products/${product.product_id}/price`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sale_price: newSalePrice[product.product_id] }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setPopupMessage(`${product.product}: ${data.message}`);
      setShowPopup(true);
      setEditingProduct(null); // Exit editing mode
      fetchProducts(); // Re-fetch products to update the list
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSalePriceChange = (productName, value) => {
    setNewSalePrice({ ...newSalePrice, [productName]: value });
  };

  const handleNextPage = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const handlePreviousPage = () => {
    setPage((prevPage) => Math.max(1, prevPage - 1));
  };

  const closePopup = () => {
    setShowPopup(false);
    setPopupMessage('');
  };

  if (loading) return <p>Loading products...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div className="price-management-container">
      <h2>Price Management</h2>
      <div className="product-table-container">
        <table className="product-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Brand</th>
              <th>Sale Price</th>
              <th>Market Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => (
              <tr key={index}>
                <td>{product.product}</td>
                <td>{product.category}</td>
                <td>{product.brand}</td>
                <td>
                  {editingProduct === product.product_id ? (
                    <input
                      type="number"
                      value={newSalePrice[product.product_id] !== undefined ? newSalePrice[product.product_id] : product.sale_price}
                      onChange={(e) => handleSalePriceChange(product.product_id, e.target.value)}
                      className="editable-sale-price"
                    />
                  ) : (
                    `$${product.sale_price}`
                  )}
                </td>
                <td>${product.market_price}</td>
                <td className="product-actions">
                  {editingProduct === product.product_id ? (
                    <button className="action-button save-button" onClick={() => handleSaveClick(product)}>Save</button>
                  ) : (
                    <button className="action-button edit-button" onClick={() => handleEditClick(product)}>Edit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination-controls">
        <button onClick={handlePreviousPage} disabled={page === 1}>Previous</button>
        <span>Page {page}</span>
        <button onClick={handleNextPage} disabled={products.length === 0 || products.length < 5}>Next</button>
      </div>

      {showPopup && (
        <div className="popup-overlay">
          <div className="popup-content">
            <h3>Update Successful</h3>
            <p>{popupMessage}</p>
            <button onClick={closePopup}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceManagement;
