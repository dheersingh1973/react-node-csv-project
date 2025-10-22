const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env file
const { connectDB, getConnections, localConnectionEstablished, globalConnectionEstablished, reconnectGlobalDB, connectGlobalDBFailed } = require('./db');

const STORE_ID = 1;
const STORE_NAME = 'TEST_STORE_1';
const POS_ID = 1;

let localConnection;
let globalConnection;

const app = express();
const PORT = process.env.PORT || 5000;
// Periodically check global connection and attempt sync
const SYNC_INTERVAL = 60 * 1000; // 1 minute

app.use(cors());
app.use(express.json());


const initializeConnectionsAndSync = async () => {
  try {
    await connectDB();
    ({ localConnection, globalConnection } = getConnections());

    if (localConnectionEstablished() && globalConnectionEstablished()) {
      console.log("Both databases connected. Initiating syncData.");
      console.log(`Initial Check: Local: ${localConnectionEstablished()}, Global: ${globalConnectionEstablished()}`);
      syncData();
    } else if (localConnectionEstablished()) {
      console.log("Local database connected. Operating in local-only mode. Global database not connected.");
    } else {
      console.error("Failed to connect to local database. Exiting.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Error during initial connection setup:", err);
    process.exit(1);
  }
};

initializeConnectionsAndSync();

setInterval(async () => {
  // Re-fetch connection status and objects in case db.js reconnected internally
  ({ localConnection, globalConnection } = getConnections());

  if (!localConnectionEstablished()) {
    console.error("Local database connection lost. Sync cannot proceed.");
    return;
  }

  if (!globalConnectionEstablished()) {
    console.warn("Global database not connected. Attempting to reconnect...");
    const reconnected = await reconnectGlobalDB();
    if (reconnected) {
      console.log("Global database reconnected successfully during periodic check.");
      ({ localConnection, globalConnection } = getConnections()); // Re-fetch connections after successful reconnection
    } else {
      console.warn("Failed to reconnect global database during periodic check.");
    }
  }

  if (localConnectionEstablished() && globalConnectionEstablished()) {
    console.log("Both databases connected. Triggering periodic syncData.");
    console.log(`Periodic Check: Local: ${localConnectionEstablished()}, Global: ${globalConnectionEstablished()}`);
    try {
      await syncData();
      console.log("Periodic syncData completed successfully.");
    } catch (error) {
      console.error("Error during periodic syncData:", error);
    }
  } else {
    console.log("Periodic check: Global database still not connected. Skipping syncData.");
    console.log(`Periodic Check: Local: ${localConnectionEstablished()}, Global: ${globalConnectionEstablished()}`);
  }
}, SYNC_INTERVAL);


// Utility for mapping local IDs to global IDs (implement as per your user/product sync logic)
async function getGlobalUserId(localUserId, localConn) {
  const [rows] = await localConn.query(
    'SELECT master_user_id FROM UserAccounts WHERE user_id = ?', [localUserId]
  );
  return rows.length > 0 ? rows[0].master_user_id : null;
}

async function syncData() {
  try {
    // Check if globalConnection is still valid before executing queries
    if (!globalConnectionEstablished()) {
      console.warn("Global database not connected during syncData. Skipping synchronization.");
      throw new Error("Global DB not connected.");
    }
        // 1. Fetch all unsynced users
        const [users] = await localConnection.execute(
          'SELECT user_id,mobile_number,email,name,address,created_at,TotalPoints,master_user_id,last_sync_date,is_sync,store_id FROM UserAccounts WHERE is_sync = 0 and master_user_id IS NULL'
        );

        for (const user of users) {
          // Check if user exists in global DB
          const [globalUserRows] = await globalConnection.execute(
            `SELECT user_id, email, name, address, created_at, TotalPoints, store_id FROM UserAccounts WHERE mobile_number = ?`,
            [user.mobile_number]
          );

          let masterUserId;

          if (globalUserRows.length > 0) {
            // User exists in global DB, update local DB
            const globalUser = globalUserRows[0];
            masterUserId = globalUser.user_id;
            await localConnection.execute(
              `UPDATE UserAccounts
              SET master_user_id = ?, email = ?, name = ?, address = ?, TotalPoints = ?, last_sync_date = NOW(), is_sync = 1, store_id = ?
              WHERE user_id = ?`,
              [
                masterUserId,
                globalUser.email,
                globalUser.name,
                globalUser.address,
                globalUser.TotalPoints,
                globalUser.store_id,
                user.user_id
              ]
            );
            console.log('User sync complete.');
          } 
          else 
          {
            // User does not exist in global DB, insert new user
            const [result] = await globalConnection.execute(
              `INSERT INTO UserAccounts
              (mobile_number, email, name, address, created_at, TotalPoints, local_user_id, last_sync_date, is_sync, store_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
              [
                user.mobile_number,
                user.email,
                user.name,
                user.address,
                user.created_at,
                user.TotalPoints,
                user.store_id,
                user.user_id, // local PK
                1
              ]
            );
            masterUserId = result.insertId;

            // Update local DB's master_user_id, last_sync_date, and is_sync
            await localConnection.execute(
              `UPDATE UserAccounts
              SET master_user_id = ?,last_sync_date = NOW(), is_sync = 1
              WHERE user_id = ?`,
              [masterUserId, user.user_id]
            );
          }
          console.log('User sync complete.');
        }

        
        // Select products to sync (is_sync = 0)
        const [products] = await localConnection.query(
        `SELECT product, category, sub_category, brand, sale_price, market_price, type, rating , description, category_id,  quantity, sku_id, store_id
          FROM Grocery_Products 
          WHERE is_sync = 0`
        );
      
        for (const product of products) {
            // Check if product exists in global DB
            const [existingGlobalProduct] = await globalConnection.execute(
                `SELECT master_product_id FROM Grocery_Products WHERE sku_id = ? AND store_id = ?`,
                [product.sku_id, product.store_id]
            );

            let masterProductId;

            if (existingGlobalProduct.length > 0) {
                // Product exists, update it
                masterProductId = existingGlobalProduct[0].master_product_id;
                await globalConnection.execute(
                    `UPDATE Grocery_Products
                    SET sale_price = ?, quantity = ?
                    WHERE sku_id = ? AND store_id = ?`,
                    [
                        product.sale_price,
                        product.quantity,
                        product.sku_id,
                        product.store_id
                    ]
                );
            } else {
                // Product does not exist, create it
                const [insertResult] = await globalConnection.execute(
                    `INSERT INTO Grocery_Products
                    (sku_id, sale_price, quantity, store_id, product, category, 
                    sub_category, brand, market_price, master_category_id, type, rating, description)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        product.sku_id,
                        product.sale_price,
                        product.quantity,
                        product.store_id,
                        product.product, // Assuming these fields are available in the local product object
                        product.category,
                        product.sub_category,
                        product.brand,
                        product.market_price,
                        product.category_id,
                        product.type,
                        product.rating,
                        product.description
                    ]
                );
                masterProductId = insertResult.insertId;
                
            }

            // Update local is_sync and master_product_id
            await localConnection.execute(
                `UPDATE Grocery_Products
                SET is_sync = 1, master_product_id = ?
                WHERE sku_id = ? AND store_id = ?`,
                [masterProductId, product.sku_id, product.store_id]
            );

            console.log('Product sync completed.');
        }

        

        // 1. Get all unsynced orders from local DB
        const [orders] = await localConnection.query('SELECT * FROM Orders WHERE is_sync = 0');

        for (const order of orders) {
          // Map local user_id to global user_id (depends on your actual mapping logic)
          // If user sync is already done, you can get this from the Users table, as per your dependency field
          // Can cache lookups for better performance

          const globalUserId = await getGlobalUserId(order.user_id, localConnection);

          if (!globalUserId) {
            // User not yet present in global DB, skip or log
            console.log('Global user id not found.');
            continue;
          }

          // 2. Insert order into Global DB
          const [orderResult] = await globalConnection.query(
            `INSERT INTO Orders (
              global_user_id, order_date, order_status, item_total_amount, shipping_address,
              payment_method, payment_id, discount_amount, discount_code, discount_type,
              points_redeemed, points_discount, total_amount, cart_id, local_order_id,
              last_sync_date, is_sync,pos_id, store_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1, ?, ?)`,
            [
              globalUserId, order.order_date, order.order_status, order.item_total_amount,
              order.shipping_address, order.payment_method, order.payment_id, order.discount_amount,
              order.discount_code, order.discount_type, order.points_redeemed, order.points_discount,
              order.total_amount, order.cart_id, order.order_id, POS_ID, STORE_ID // local_order_id
            ]
          );
          const globalOrderId = orderResult.insertId;
          console.log('Global order Id: ',globalOrderId);

          // 3. Sync all OrderItems for this order
          const [items] = await localConnection.query(
            'SELECT * FROM OrderItems WHERE order_id = ? AND is_sync = 0', [order.order_id]
          );

          for (const item of items) {
            // If you maintain a mapping for product IDs, apply it here as well
            const localProductId = item.product_id; // Replace with mapping logic if needed

            const [globalProduct] = await localConnection.query(
              'SELECT master_product_id FROM Grocery_Products WHERE product_id = ?', [localProductId]
            );

            const globalProductId = globalProduct[0].master_product_id

            const [itemResult] = await globalConnection.query(
              `INSERT INTO OrderItems (
                global_order_id, master_product_id, sku_id, quantity,
                sale_price, adjusted_price, local_order_item_id, local_order_id,
                last_sync_date, is_sync
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1)`,
              [
                globalOrderId, globalProductId, item.sku_id, item.quantity,
                item.sale_price, item.adjusted_price, item.order_item_id, item.order_id
              ]
            );
            const globalOrderItemId = itemResult.insertId;
            console.log('Global order item Id: ',globalOrderItemId);

            // Update local OrderItem with new global IDs and mark as synced
            await localConnection.query(
              `UPDATE OrderItems
              SET master_order_item_id = ?, master_order_id = ?, last_sync_date = NOW(), is_sync = 1
              WHERE order_item_id = ?`,
              [globalOrderItemId, globalOrderId, item.order_item_id]
            );
          }

          // 4. Update local order with global order ID and mark as synced
          await localConnection.query(
            `UPDATE Orders
            SET master_order_id = ?, last_sync_date = NOW(), is_sync = 1
            WHERE order_id = ?`,
            [globalOrderId, order.order_id]
          );
          console.log('Full update of order id: ',order.order_id,'complete.');
        }

      
  } catch (err) {
    console.error('Sync error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'EADDRNOTAVAIL' || err.code === 'ENOTFOUND') {
        await connectGlobalDBFailed();
    }
    throw err; // Re-throw the error to be caught by the caller
  } 
}


app.post('/api/global-db-failed', async (req, res) => {
  console.log("Frontend reported global DB connection failed.");
  await connectGlobalDBFailed();
  res.status(200).json({ message: 'Global database connection marked as failed.' });
});

app.post('/api/reconnect-global-db', async (req, res) => {
  console.log("Frontend requested global DB reconnection.");
  const reconnected = await reconnectGlobalDB();
  // Re-fetch connections after reconnection attempt, regardless of success or failure
  ({ localConnection, globalConnection } = getConnections());

  if (reconnected) {
    res.status(200).json({ message: 'Global database reconnected successfully.', connected: true });
  } else {
    res.status(200).json({ message: 'Failed to reconnect global database.', connected: false });
  }
});

app.get('/api/db-status', (req, res) => {
  res.status(200).json({
    localConnected: localConnectionEstablished(),
    globalConnected: globalConnectionEstablished(),
  });
});

app.get('/api/products', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const offset = (page - 1) * limit;
  const category = req.query.category;
  const searchTerm = req.query.search;

  let query = `SELECT product_id, Sku_id, product, category, brand, sale_price, market_price, category_id, quantity FROM pos_poc.Grocery_Products`;
  const queryParams = [];

  const conditions = [];
  if (category) {
    conditions.push(`category_id = ?`);
    queryParams.push(category);
  }
  if (searchTerm) {
    conditions.push(`(product LIKE ? OR brand LIKE ?)`);
    queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
  }

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(` AND `);
  }

  query += ` LIMIT ? OFFSET ?`;
  queryParams.push(limit, offset);

  try {
    const [results] = await localConnection.query(query, queryParams);
    res.json(results);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Error fetching products' });
  }
});

app.put('/api/products/:product_id/price', async (req, res) => {
  const productId = req.params.product_id;
  const { sale_price } = req.body;

  const query = `UPDATE pos_poc.Grocery_Products SET sale_price = ? WHERE product_id = ?`;
  try {
    const [results] = await localConnection.query(query, [sale_price, productId]);
    if (results.affectedRows === 0) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json({ message: `Sale price for product ID ${productId} updated to ${sale_price}` });
  } catch (err) {
    console.error('Error updating product price:', err);
    res.status(500).json({ error: 'Error updating product price' });
  }
});

app.put('/api/products/:product_id', async (req, res) => {
  const productId = req.params.product_id;
  const { product, quantity, sale_price, market_price } = req.body;

  const query = `UPDATE pos_poc.Grocery_Products SET product = ?, quantity = ?, sale_price = ?, market_price = ? WHERE product_id = ?`;
  try {
    const [results] = await localConnection.query(query, [product, quantity, sale_price, market_price, productId]);
    if (results.affectedRows === 0) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json({ message: `Product with ID ${productId} updated successfully` });
  } catch (err) {
    console.error('Error updating product details:', err);
    res.status(500).json({ error: 'Error updating product details' });
  }
});

app.get('/api/categories', async (req, res) => {
  const query = `SELECT category_id,category, category_image FROM pos_poc.Grocery_Category`;
  try {
    const [results] = await localConnection.query(query);
    res.json(results);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Error fetching categories' });
  }
});

app.post('/api/checkout', async (req, res) => {
  const { mobile_number, cart_items, total_quantity, cart_total, discount_code, discount_amount, item_total_amount, points_redeemed, points_discount_amount } = req.body;

  try {
    // 1. Find or create user
    let userId;
    const [userRows] = await localConnection.query(
      `SELECT user_id FROM pos_poc.UserAccounts WHERE mobile_number = ?`,
      [mobile_number]
    );

    if (userRows.length > 0) {
      userId = userRows[0].user_id;
    } else {
      const [insertUserResult] = await localConnection.query(
        `INSERT INTO pos_poc.UserAccounts (mobile_number,store_id) VALUES (?,?)`,
        [mobile_number,STORE_ID]
      );
      userId = insertUserResult.insertId;
    }

    let discountType = null;
    if (discount_code) {
      const [couponInfo] = await localConnection.query(
        `SELECT discount_type FROM pos_poc.DiscountCoupons WHERE discount_code = ?`,
        [discount_code]
      );
      if (couponInfo.length > 0) {
        discountType = couponInfo[0].discount_type;
      }
    }

    // 2. Create Cart record
    const [insertCartResult] = await localConnection.query(
      `INSERT INTO pos_poc.Cart (user_id, created_at, total_quantity, cart_total, discount_code, discount_type, discount_amount, item_total_amount, points_redeemed, points_discount)
       VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, total_quantity, cart_total, discount_code, discountType, discount_amount, item_total_amount, points_redeemed, points_discount_amount]
    );
    const cartId = insertCartResult.insertId;

    // 3. Create CartItems records
    for (const item of cart_items) {
      // Assuming item has product_id, quantity.
      // We need sku_id and sale_price from Grocery_Products.
      const [productInfo] = await localConnection.query(
        `SELECT Sku_id, sale_price FROM pos_poc.Grocery_Products WHERE product_id = ?`,
        [item.product_id]
      );

      if (productInfo.length === 0) {
        throw new Error(`Product with ID ${item.product_id} not found.`);
      }

      await localConnection.query(
        `INSERT INTO pos_poc.CartItems (cart_id, product_id, sku_id, sale_price, quantity, added_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [cartId, item.product_id, productInfo[0].Sku_id, productInfo[0].sale_price, item.quantity]
      );
    }

    res.status(201).json({ message: 'Checkout successful', cartId: cartId, userId: userId, cart_items: cart_items, discount_code: discount_code, discount_amount: discount_amount, item_total_amount: item_total_amount });

  } catch (error) {
    console.error('Error during checkout:', error);
    res.status(500).json({ error: 'Internal server error during checkout' });
  }
});

app.post('/api/apply-discount', async (req, res) => {
  const { discount_code, cart_total } = req.body;

  if (!discount_code) {
    return res.status(400).json({ message: 'Discount code is required.' });
  }

  try {
    const [couponRows] = await localConnection.query(
      `SELECT * FROM pos_poc.DiscountCoupons WHERE discount_code = ? `,[discount_code]
    );

    if (couponRows.length === 0) {
      return res.status(404).json({ message: 'Invalid discount code.' });
    }

    const coupon = couponRows[0];
    let discountAmount = 0;

    //inactive discount code check
    if (coupon.status !== 'active') {
      return res.status(404).json({ message: 'Inactive discount code.' });
    }
    // Check usage limit
    if (coupon.usage_limit !== null && coupon.total_redeems >= coupon.usage_limit) {
      return res.status(400).json({ message: 'Discount code usage limit reached.' });
    }

    // Check start and expiry dates
    const currentDate = new Date();
    if (coupon.start_date && new Date(coupon.start_date) > currentDate) {
      return res.status(400).json({ message: 'Discount code not yet active.' });
    }
    if (coupon.expiry_date && new Date(coupon.expiry_date) < currentDate) {
      return res.status(400).json({ message: 'Discount code has expired.' });
    }

    // Check minimum cart value
    if (coupon.min_cart_value && cart_total < coupon.min_cart_value) {
      return res.status(400).json({ message: `Minimum cart value of $${coupon.min_cart_value} not met.` });
    }

    if (coupon.discount_type === 'P') { // Percentage discount
      discountAmount = cart_total * (coupon.discount_value / 100);
    } else if (coupon.discount_type === 'V') { // Value discount
      discountAmount = coupon.discount_value;
    }

    // Apply max_cart_applicable if present
    if (coupon.max_cart_applicable && discountAmount > coupon.max_cart_applicable) {
      discountAmount = coupon.max_cart_applicable;
    }

    res.status(200).json({ discount_amount: parseFloat(Number(discountAmount).toFixed(2)), discount_type: coupon.discount_type });

  } catch (error) {
    console.error('Error applying discount:', error);
    res.status(500).json({ message: 'Internal server error applying discount.' });
  }
});

app.post('/api/place-order', async (req, res) => {
  const { userId, cartId, cartGrandTotal, paymentMethod, cart_items } = req.body; // Removed discount details and item_total_amount from req.body

  try {
        let orderStatus = 'Processing';
        if (paymentMethod === 'Cash') {
          orderStatus = 'Paid';
        }

        // Retrieve discount, item_total_amount, points_redeemed, and points_discount_amount from Cart table
        const [cartInfo] = await localConnection.query(
          `SELECT discount_code, discount_type, discount_amount, item_total_amount, points_redeemed, points_discount 
          FROM pos_poc.Cart WHERE cart_id = ?`,
          [cartId]
        );

        if (cartInfo.length === 0) {
          return res.status(404).json({ message: 'Cart not found.' });
        }

        const { discount_code, discount_type, discount_amount, item_total_amount, points_redeemed, points_discount} = cartInfo[0];

        let currentPointsBalance = 0;
        const [latestPointsEvent] = await localConnection.query(
          `SELECT balance_after FROM pos_poc.Points_Event WHERE user_id = ? ORDER BY id DESC,created_at DESC LIMIT 1`,[userId]
        );

        if (latestPointsEvent.length > 0) {
          currentPointsBalance = latestPointsEvent[0].balance_after;
        }

        // 1. Create Order record
        const [insertOrderResult] = await localConnection.query(
          `INSERT INTO pos_poc.Orders (
            user_id, order_date, order_status, total_amount, item_total_amount, shipping_address, 
            payment_method, payment_id, discount_amount, discount_code, discount_type, cart_id, 
            points_redeemed, points_discount, pos_id, store_id
          ) VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`,
          [
            userId, orderStatus, cartGrandTotal, item_total_amount, null, // shipping_address
            paymentMethod, null, // payment_id
            discount_amount || 0, discount_code || null, discount_type || null,
            cartId, points_redeemed || 0, points_discount || 0, // points redeemed and discount fields
            POS_ID, STORE_ID
          ]
        );
        const orderId = insertOrderResult.insertId;

        // 2. Create OrderItems records
        for (const item of cart_items) {
            // Retrieve sku_id and sale_price from Grocery_Products based on product_id
            const [productInfo] = await localConnection.query(
              `SELECT Sku_id, sale_price FROM pos_poc.Grocery_Products WHERE product_id = ?`,
              [item.product_id]
            );

            if (productInfo.length === 0) {
              throw new Error(`Product with ID ${item.product_id} not found.`);
            }

            await localConnection.query(
              `INSERT INTO pos_poc.OrderItems (
                order_id, product_id, sku_id, quantity, sale_price, adjusted_price
              ) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                orderId, item.product_id, productInfo[0].Sku_id,
                item.quantity, productInfo[0].sale_price, productInfo[0].sale_price // adjusted_price same as sale_price for now
              ]
            );

            // Decrement quantity in Grocery_Products table
            await localConnection.query(
              `UPDATE pos_poc.Grocery_Products SET quantity = quantity - ?,is_sync=0 WHERE Sku_id = ?`,
              [item.quantity, productInfo[0].Sku_id]
            );
        }

        // 2.a. If points are redeemed, insert entry in Points_Event table (activity_type_id=5)
        if (points_redeemed > 0) {
          const newBalanceAfterRedemption = currentPointsBalance - points_redeemed;
          await localConnection.query(
            `INSERT INTO pos_poc.Points_Event (user_id, activity_type_id, order_id, points, balance_after, activity_desc, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [userId, 5, orderId, -points_redeemed, newBalanceAfterRedemption,'Points redeemed']
          );
          currentPointsBalance = newBalanceAfterRedemption; // Update balance for next event
        }

        
        // 2.b. Insert entry in Points_Event table for order creation (activity_type_id=4)
        const pointsEarned = Math.floor(cartGrandTotal / 100) * 5;
        if (pointsEarned > 0) {
          const newBalanceAfterOrder = currentPointsBalance + pointsEarned;
          await localConnection.query(
            `INSERT INTO pos_poc.Points_Event (user_id, activity_type_id, order_id, activity_desc, points, balance_after, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [userId, 4, orderId, 'Order created', pointsEarned, newBalanceAfterOrder]
          );
        }

        // Increment total_redeems for the used discount code
        if (discount_code) {
          await localConnection.query(
            `UPDATE pos_poc.DiscountCoupons SET total_redeems = total_redeems + 1 WHERE discount_code = ?`,
            [discount_code]
          );
        }

        // 3. Update Cart status to 'M'
        await localConnection.query(
          `UPDATE pos_poc.Cart SET cart_status = 'M' WHERE cart_id = ?`,
          [cartId]
        );

        res.status(201).json({ message: 'Order placed successfully', orderId: orderId, item_total_amount: item_total_amount }); 
    }
    catch (error) 
    {
        console.error('Error placing order:', error);
        res.status(500).json({ error: 'Internal server error during order placement' });
    }
});

app.get('/api/orders-report', async (req, res) => {
  try {
    const query = `
      SELECT 
        o.order_id,
        o.total_amount AS order_total,
        ua.mobile_number AS customer_phone_no,
        SUM(oi.quantity) AS items_count,
        o.payment_method
      FROM 
        pos_poc.Orders o
      JOIN 
        pos_poc.UserAccounts ua ON o.user_id = ua.user_id
      JOIN 
        pos_poc.OrderItems oi ON o.order_id = oi.order_id
      GROUP BY
        o.order_id, o.total_amount, ua.mobile_number, o.payment_method
      ORDER BY
        o.order_date DESC
    `;
    const [results] = await localConnection.query(query);
    res.json(results);
  } catch (error) {
    console.error('Error fetching order report:', error);
    res.status(500).json({ error: 'Internal server error fetching order report' });
  }
});

app.get('/api/order-details/:orderId', async (req, res) => {
  const orderId = req.params.orderId;

  try {
    // Fetch order details
    const [orderDetails] = await localConnection.query(
      `SELECT 
         o.order_id,
         o.total_amount AS order_total,
         ua.mobile_number AS customer_mobile,
         SUM(oi.quantity) AS item_count,
         o.payment_method AS payment_mode,
         o.order_status AS order_status,
         o.discount_amount,
         o.discount_code,
         o.item_total_amount
       FROM 
         pos_poc.Orders o
       JOIN 
         pos_poc.UserAccounts ua ON o.user_id = ua.user_id
       JOIN 
         pos_poc.OrderItems oi ON o.order_id = oi.order_id
       WHERE 
         o.order_id = ?
       GROUP BY
         o.order_id, o.total_amount, ua.mobile_number, o.payment_method, o.order_status`,
      [orderId]
    );

    if (orderDetails.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Fetch order items
    const [orderItems] = await localConnection.query(
      `SELECT
         gp.product AS product_name,
         oi.quantity AS product_quantity,
         oi.sale_price,
         gp.brand,
         gp.category AS product_type,
         gp.cgst,
         gp.sgst,
         gp.market_price
       FROM
         pos_poc.OrderItems oi
       JOIN
         pos_poc.Grocery_Products gp ON oi.product_id = gp.product_id
       WHERE
         oi.order_id = ?`,
      [orderId]
    );

    res.json({ orderDetails: orderDetails[0], orderItems });

  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ error: 'Internal server error fetching order details' });
  }
});

app.get('/api/points/balance', async (req, res) => {
  const { mobile_number } = req.query;

  if (!mobile_number) {
    return res.status(400).json({ message: 'Mobile number is required.' });
  }

  try {
    // 1. Find user_id from UserAccounts table
    const [userRows] = await localConnection.query(
      `SELECT user_id FROM pos_poc.UserAccounts WHERE mobile_number = ?`,
      [mobile_number]
    );

    if (userRows.length === 0) {
      return res.status(200).json({ balance_after: 0, message: 'User not found. No points to redeem.' });
    }

    const userId = userRows[0].user_id;

    // 2. Get the latest points balance from Points_Event for the user_id
    const [pointsRows] = await localConnection.query(
      `SELECT balance_after FROM pos_poc.Points_Event WHERE user_id = ? ORDER BY id DESC,created_at DESC LIMIT 1`,
      [userId]
    );

    if (pointsRows.length === 0) {
      return res.status(200).json({ balance_after: 0, message: 'No points events found for this user.' });
    }

    res.status(200).json({ balance_after: pointsRows[0].balance_after });

  } catch (error) {
    console.error('Error fetching points balance:', error);
    res.status(500).json({ message: 'Internal server error fetching points balance.' });
  }
});

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Constants for Receipt
const COMPANY = "Demo POS (Delhi)";
const WEBSITE = "http://www.demopos.com";
const EMAIL = "info@demopos.com";
const TELEPHONE = "18604444444";
const STORE = "DEMO Store 1";

app.get('/api/generate-receipt/:orderId', async (req, res) => {
  const orderId = req.params.orderId;

  const filename = `receipt_${orderId}.pdf`;
  const invoicesDir = path.join(__dirname, '..', 'frontend', 'public', 'invoices');
  const filepath = path.join(invoicesDir, filename);

  try {
    // Ensure the invoices directory exists before writing the file
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    // Fetch order details
    const [orderDetails] = await localConnection.query(
      `SELECT
         o.order_id,
         o.total_amount AS order_total,
         ua.mobile_number AS customer_mobile,
         SUM(oi.quantity) AS item_count,
         o.payment_method AS payment_mode,
         o.order_status AS order_status,
         o.discount_amount,
         o.discount_code,
         o.item_total_amount,
         o.order_date,
         o.points_redeemed,
         o.points_discount,
         uac.name AS cashier_name
       FROM
         pos_poc.Orders o
       JOIN
         pos_poc.UserAccounts ua ON o.user_id = ua.user_id
       JOIN
         pos_poc.OrderItems oi ON o.order_id = oi.order_id
       LEFT JOIN
         pos_poc.UserAccounts uac ON o.pos_id = uac.user_id
       WHERE
         o.order_id = ?
       GROUP BY
         o.order_id, o.total_amount, ua.mobile_number, o.payment_method, o.order_status, o.order_date, o.points_redeemed, o.points_discount, o.discount_amount, o.discount_code, o.item_total_amount, cashier_name`,
      [orderId]
    );

    if (orderDetails.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Fetch order items with CGST, SGST, and Market Price
    const [orderItems] = await localConnection.query(
      `SELECT
         gp.product AS product_name,
         oi.quantity AS product_quantity,
         oi.sale_price,
         gp.brand,
         gp.category AS product_type,
         gp.cgst,
         gp.sgst,
         gp.market_price,
         gp.sku_id
       FROM
         pos_poc.OrderItems oi
       JOIN
         pos_poc.Grocery_Products gp ON oi.product_id = gp.product_id
       WHERE
         oi.order_id = ?`,
      [orderId]
    );

    const order = orderDetails[0];

    // Calculate totals
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let amountSavedAgainstMRP = 0;

    // Group items by total GST percentage (CGST + SGST)
    const groupedItems = {};

    orderItems.forEach(item => {
      const itemTotal = parseFloat(item.product_quantity) * parseFloat(item.sale_price);
      subtotal += itemTotal;

      // Calculate CGST and SGST for the item, assuming baked into sale price
      const gstPercentage = (Number(item.cgst) || 0) + (Number(item.sgst) || 0);
      const actualPriceWithoutTax = itemTotal / (1 + gstPercentage / 100);
      const itemCgst = actualPriceWithoutTax * (item.cgst / 100);
      const itemSgst = actualPriceWithoutTax * (item.sgst / 100);

      totalCgst += itemCgst;
      totalSgst += itemSgst;

      amountSavedAgainstMRP += (item.market_price - item.sale_price) * parseFloat(item.product_quantity);

      const gstGroup = `${gstPercentage}% GST items`;
      if (!groupedItems[gstGroup]) {
        groupedItems[gstGroup] = [];
      }
      groupedItems[gstGroup].push({ ...item, itemCgst, itemSgst, itemTotal });
    });

    // Sort items within each group by CGST ascending
    for (const group in groupedItems) {
      groupedItems[group].sort((a, b) => a.cgst - b.cgst);
    }

    const finalTotal = Number(order.order_total);
    const discountAmount = Number(order.discount_amount) || 0;
    const pointsDiscount = Number(order.points_discount) || 0;

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Ensure the invoices directory exists before writing the file
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    doc.pipe(fs.createWriteStream(filepath));

    // Header
    doc.image(path.join(__dirname, '..', 'frontend', 'src', 'components', 'images', 'Demo POS-logo.jpg'), 50, 45, { width: 50 })
      .fillColor('#444444')
      .fontSize(10)
      .text(COMPANY, 200, 65, { align: 'right' })
      .text(`Tel:${TELEPHONE}`, 200, 80, { align: 'right' })
      .text(EMAIL, 200, 95, { align: 'right' })
      .text(WEBSITE, 200, 110, { align: 'right' })
      .moveDown();

    // TAX INVOICE section
    let currentY = doc.y + 20;
    doc.fontSize(16).text('TAX INVOICE', 50, currentY, { align: 'center' });
    currentY += 30;

    doc.fontSize(10).font('Helvetica-Bold').text('Order no:', 50, currentY, { continued: true });
    doc.font('Helvetica').text(`${order.order_id}`, 100, currentY);
    doc.font('Helvetica-Bold').text('Order Date:', 300, currentY, { continued: true });
    doc.font('Helvetica').text(`${new Date(order.order_date).toLocaleDateString()}`, 370, currentY);
    currentY += 15;
    doc.font('Helvetica-Bold').text('Store:', 50, currentY, { continued: true });
    doc.font('Helvetica').text(`${STORE}`, 90, currentY);
    doc.font('Helvetica-Bold').text('Cashier:', 300, currentY, { continued: true });
    doc.font('Helvetica').text(`${order.cashier_name || 'Demo POS 1'}`, 350, currentY);
    currentY += 30;

    doc.strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, currentY - 5)
      .lineTo(550, currentY - 5)
      .stroke();

    // Product List Header
    currentY += 10;
    doc.fontSize(10)
      .text('SKU', 50, currentY)
      .text('Product Name', 130, currentY, { width: 170, align: 'left' })
      .text('Qty', 320, currentY, { width: 40, align: 'right' })
      .text('N/Rate', 390, currentY, { width: 40, align: 'right' })
      .text('Value', 0, currentY, { align: 'right' });
    currentY += 15;

    doc.strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, currentY - 5)
      .lineTo(550, currentY - 5)
      .stroke();
    currentY += 10;

    // Product List Items
    for (const gstGroup in groupedItems) {
      doc.fontSize(10).font('Helvetica-Bold').text(gstGroup, 50, currentY);
      currentY += 15;
      groupedItems[gstGroup].forEach(item => {
        const itemValue = parseFloat(item.product_quantity) * parseFloat(item.sale_price);
        const productName = item.product_name.length > 33 ? item.product_name.substring(0, 31) + '..' : item.product_name;
        doc.fontSize(10).font('Helvetica')
          .text(item.sku_id || 'N/A', 50, currentY)
          .text(productName, 130, currentY, { width: 170, align: 'left' })
          .text(item.product_quantity, 320, currentY, { width: 40, align: 'right' })
          .text(item.sale_price ? parseFloat(item.sale_price).toFixed(2) : 'N/A', 390, currentY, { width: 40, align: 'right' })
          .text(itemValue.toFixed(2), 0, currentY, { align: 'right' });
        currentY += 15;
      });
      currentY += 10;
    }

    doc.strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, currentY - 5)
      .lineTo(550, currentY - 5)
      .stroke();
    currentY += 10;

    // Summary section
    doc.fontSize(10).font('Helvetica-Bold')
      .text('Items:', 50, currentY)
      .font('Helvetica').text(`${orderItems.length}`, 90, currentY);
    doc.font('Helvetica-Bold')
      .text('Qty:', 200, currentY)
      .font('Helvetica').text(`${order.item_count}`, 230, currentY);
    doc.font('Helvetica-Bold')
      .text('SubTotal:', 350, currentY)
      .font('Helvetica').text(`${subtotal.toFixed(2)}`, 410, currentY);
    currentY += 20;

    // GST Breakup details section
    if (Object.keys(groupedItems).length > 0) {
      doc.fontSize(12).text('GST Breakup Details', 50, currentY);
      currentY += 20;

      doc.strokeColor('#aaaaaa')
        .lineWidth(1)
        .moveTo(50, currentY - 5)
        .lineTo(550, currentY - 5)
        .stroke();
      currentY += 10;

      doc.fontSize(10)
        .text('GST IND', 50, currentY)
        .text('Taxable Amount', 150, currentY, { width: 100, align: 'right' })
        .text('CGST', 270, currentY, { width: 50, align: 'right' })
        .text('SGST', 350, currentY, { width: 50, align: 'right' })
        .text('Total Amount', 0, currentY, { align: 'right' });
      currentY += 15;

      doc.strokeColor('#aaaaaa')
        .lineWidth(1)
        .moveTo(50, currentY - 5)
        .lineTo(550, currentY - 5)
        .stroke();
      currentY += 10;

      let gstIndex = 1;
      for (const groupName in groupedItems) {
        const group = groupedItems[groupName];
        const groupTaxableAmount = group.reduce((sum, item) => sum + (item.itemTotal / (1 + ((Number(item.cgst) || 0) + (Number(item.sgst) || 0)) / 100)), 0);
        const groupCgst = group.reduce((sum, item) => sum + item.itemCgst, 0);
        const groupSgst = group.reduce((sum, item) => sum + item.itemSgst, 0);
        const groupTotalAmount = group.reduce((sum, item) => sum + item.itemTotal, 0);

        doc.fontSize(10)
          .text(gstIndex++, 50, currentY)
          .text(groupTaxableAmount.toFixed(2), 150, currentY, { width: 100, align: 'right' })
          .text(groupCgst.toFixed(2), 270, currentY, { width: 50, align: 'right' })
          .text(groupSgst.toFixed(2), 350, currentY, { width: 50, align: 'right' })
          .text(groupTotalAmount.toFixed(2), 0, currentY, { align: 'right' });
        currentY += 15;
      }
      currentY += 10;

      doc.strokeColor('#aaaaaa')
        .lineWidth(1)
        .moveTo(50, currentY - 5)
        .lineTo(550, currentY - 5)
        .stroke();
      currentY += 10;
    }

    // Discount and Points Redeemed
    currentY += 10;
    doc.fontSize(10).font('Helvetica-Bold')
      .text('Discount Applied:', 50, currentY, { width: 180, align: 'left' });
    doc.font('Helvetica')
      .text(`${discountAmount.toFixed(2)}`, 200, currentY, { width: 80, align: 'right' });

    doc.font('Helvetica-Bold')
      .text('Points Redeemed:', 300, currentY, { width: 180, align: 'left' });
    doc.font('Helvetica')
      .text(`${pointsDiscount.toFixed(2)}`, 450, currentY, { width: 80, align: 'right' });
    currentY += 20;

    // Amount Received and Payment Mode
    doc.fontSize(10)
      .text('** Amount Recd. From customer **', 50, currentY, { align: 'center', width: 500 });
    currentY += 15;
    doc.font('Helvetica-Bold')
      .text('Payment Mode:', 50, currentY, { width: 180, align: 'left' });
    doc.font('Helvetica')
      .text(`${order.payment_mode}`, 200, currentY, { width: 80, align: 'right' });
    
    doc.font('Helvetica-Bold')
      .text('Final Total:', 300, currentY, { width: 180, align: 'left' });
    doc.font('Helvetica')
      .text(`${finalTotal.toFixed(2)}`, 450, currentY, { width: 80, align: 'right' });
    currentY += 20;

    // Saved amount
    if (amountSavedAgainstMRP > 0) {
      doc.fontSize(12).font('Helvetica-Bold')
        .text(`** Saved Rs. ${amountSavedAgainstMRP.toFixed(2)} on MRP **`, 50, currentY, { align: 'center', width: 500 });
      currentY += 20;
    }

    // Thank you message
    currentY += 10;
    doc.fontSize(10).font('Helvetica')
      .text('Thank you for shopping. Visit again', 50, currentY, { align: 'center', width: 500 });
    currentY += 30;

    doc.end();

    await new Promise((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);
    });

    // Send the generated PDF as a response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=${filename}`);
    const readStream = fs.createReadStream(filepath);
    readStream.pipe(res);

  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({ error: 'Internal server error generating receipt' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});