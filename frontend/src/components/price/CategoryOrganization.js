import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import './css/CategoryOrganization.css'; // We'll create this CSS file next

const CategoryOrganization = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate(); // Initialize navigate

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:5000/api/categories`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  if (loading) return <p>Loading categories...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div className="category-organization-container">
      <h2>Category Organization</h2>
      <div className="category-list">
        {categories.map((category, index) => (
          <button 
            key={index} 
            className="category-button"
            onClick={() => navigate(`/product-catalog?category=${category.category_id}`)} // Navigate to ProductCatalog with category
          >
            {category.category_image && (
              <img src={category.category_image} alt={category.category} className="category-image" />
            )}
            <span className="category-name">{category.category}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryOrganization;
