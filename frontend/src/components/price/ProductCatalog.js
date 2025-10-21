import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom'; // Import useLocation
import './css/ProductCatalog.css'; // We'll create this CSS file next

const ProductCatalog = () => {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null); // State to track which product is being edited
  const [editedProductData, setEditedProductData] = useState({}); // State to hold edited product data
  const location = useLocation(); // Initialize useLocation

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams(location.search);
      const category = queryParams.get('category'); // Get category from URL

      let url = `http://localhost:5000/api/products?page=${page}&limit=30`;
      if (category) {
        url += `&category=${category}`;
      }

      const response = await fetch(url);
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
  }, [page, location.search, setLoading, setError, setProducts]);

  useEffect(() => {
    fetchProducts();
  }, [page, location.search, fetchProducts]); // Re-fetch when page or URL search params change

  const handleNextPage = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const handlePreviousPage = () => {
    setPage((prevPage) => Math.max(1, prevPage - 1));
  };

  const handleEditClick = (product) => {
    setEditingProduct(product.product_id);
    setEditedProductData({ ...product });
  };

  const handleSaveClick = async (productId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:5000/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedProductData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      // const data = await response.json(); // If you want to use the response data
      setEditingProduct(null); // Exit editing mode
      fetchProducts(); // Re-fetch products to update the list
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = () => {
    setEditingProduct(null);
    setEditedProductData({});
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedProductData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  if (loading) return <p>Loading products...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div className="product-catalog-container">
      <h2>Product Catalog</h2>
      <div className="product-table-container">
        <table className="product-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Brand</th>
              <th>Sale Price</th>
              <th>Market Price</th>
              <th>Quantity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.product_id}>
                {editingProduct === product.product_id ? (
                  <>
                    <td>
                      <input
                        type="text"
                        name="product"
                        value={editedProductData.product || ''}
                        onChange={handleChange}
                      />
                    </td>
                    <td>{product.category}</td>
                    <td>{product.brand}</td>
                    <td>
                      <input
                        type="number"
                        name="sale_price"
                        value={editedProductData.sale_price || ''}
                        onChange={handleChange}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        name="market_price"
                        value={editedProductData.market_price || ''}
                        onChange={handleChange}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        name="quantity"
                        value={editedProductData.quantity || ''}
                        onChange={handleChange}
                      />
                    </td>
                    <td className="product-actions">
                      <button className="action-button save-button" onClick={() => handleSaveClick(product.product_id)}>Save</button>
                      <button className="action-button cancel-button" onClick={handleCancelClick}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{product.product}</td>
                    <td>{product.category}</td>
                    <td>{product.brand}</td>
                    <td>${product.sale_price}</td>
                    <td>${product.market_price}</td>
                    <td>{product.quantity}</td>
                    <td className="product-actions">
                      <button className="action-button edit-button" onClick={() => handleEditClick(product)}>Edit</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination-controls">
        <button onClick={handlePreviousPage} disabled={page === 1}>Previous</button>
        <span>Page {page}</span>
        <button onClick={handleNextPage} disabled={products.length === 0 || products.length < 30}>Next</button>
      </div>
    </div>
  );
};

export default ProductCatalog;
