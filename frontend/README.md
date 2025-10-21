# POS System Frontend

A modern React.js frontend for a Point of Sale (POS) system with a beautiful, responsive interface.

## Features

- **Home Page**: Clean, modern interface with six main navigation buttons
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Modern UI**: Beautiful gradient backgrounds and smooth animations
- **Navigation**: Easy navigation between different POS functions
- **User Greeting**: Displays logged-in user name at the bottom

## Main Functions

1. **Register** 🛒 - Point of sale transactions
2. **Store Status** 🏪 - Store operations dashboard
3. **Reports** 📊 - Sales and order reports
4. **Vendors** 🚚 - Supplier management
5. **Users** 👥 - Staff and user management
6. **Time Clock** ⏰ - Employee time tracking

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Project Structure

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── clock/
│   │   │   └── TimeClock.js         # Employee time tracking component
│   │   ├── css/
│   │   │   └── Header.css           # Styling for the Header component
│   │   ├── pos/
│   │   │   ├── css/
│   │   │   │   ├── OrderPayment.css       # Styles for order payment
│   │   │   │   └── ThankYou.css           # Styles for thank you page
│   │   │   ├── OrderPayment.js            # Order payment component
│   │   │   ├── POSCart.js               # Point of sale cart component
│   │   │   ├── Register.js                # Register page for transactions
│   │   │   └── ThankYou.js              # Thank you page for successful orders
│   │   ├── price/
│   │   │   ├── css/
│   │   │   │   ├── CategoryOrganization.css # Styles for category organization
│   │   │   │   ├── PriceManagement.css    # Styles for price management
│   │   │   │   └── ProductCatalog.css     # Styles for product catalog
│   │   │   ├── CategoryOrganization.js    # Component for organizing product categories
│   │   │   ├── Pricebook.js               # Pricebook page for product pricing
│   │   │   ├── PriceManagement.js         # Component for managing prices
│   │   │   └── ProductCatalog.js          # Product catalog display
│   │   ├── reports/
│   │   │   ├── css/
│   │   │   │   ├── OrderDetails.css       # Styles for order details
│   │   │   │   └── OrderReport.css        # Styles for order report
│   │   │   ├── OrderDetails.js            # Order details component
│   │   │   └── OrderReport.js             # Order report component
│   │   ├── staff/
│   │   │   └── Users.js             # Staff and user management
│   │   ├── status/
│   │   │   └── StoreStatus.js       # Store operations dashboard
│   │   ├── Suppliers/
│   │   │   └── Vendors.js           # Supplier management
│   │   ├── Header.js                # Header component
│   │   ├── HomePage.css             # Home page styles
│   │   ├── HomePage.js              # Main home page
│   │   └── PageTemplate.css         # Shared page styles
│   ├── App.css                      # Main app styles
│   ├── App.js                       # Main app component
│   ├── index.css                    # Global styles
│   └── index.js                     # Entry point
├── package.json
├── package-lock.json
└── README.md
```

## Technologies Used

- React 18
- React Router DOM
- CSS3 with modern features
- Responsive Grid Layout
- CSS Animations and Transitions

## Customization

- **Colors**: Modify the CSS custom properties in the component files
- **Icons**: Replace emoji icons with custom SVG icons
- **User Name**: Update the `loggedInUser` variable in `HomePage.js`
- **Styling**: Customize colors, fonts, and layouts in the CSS files

## Build for Production

```bash
npm run build
```

This builds the app for production to the `build` folder.




