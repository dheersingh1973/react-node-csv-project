const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env file
const { connectDB, getConnections, localConnectionEstablished, globalConnectionEstablished: isGlobalConnectionEstablished, reconnectGlobalDB, connectGlobalDBFailed } = require('./db');
const { sendBillByEmail } = require('./utils/email'); // Import the email utility
const { insertAuditTrail } = require('./utils/audit_utils'); // Import the audit trail utility
const path = require('path');
const fs = require('fs');
const { STORE_ID, STORE_NAME, POS_ID, POS_NAME } = require('./utils/config');
const changed_by_user = POS_NAME; // Or a more dynamic way to get the user, e.g., from an auth token

function generateTransactionId() {
  return `TRX-${STORE_ID}-${POS_ID}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

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

    if (localConnectionEstablished() && isGlobalConnectionEstablished()) {
      console.log("Both databases connected. Initiating syncData.");
      console.log(`Initial Check: Local: ${localConnectionEstablished()}, Global: ${isGlobalConnectionEstablished()}`);
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

  if (!isGlobalConnectionEstablished()) {
    console.warn("Global database not connected. Attempting to reconnect...");
    const reconnected = await reconnectGlobalDB();
    if (reconnected) {
      console.log("Global database reconnected successfully during periodic check.");
      ({ localConnection, globalConnection } = getConnections()); // Re-fetch connections after successful reconnection
    } else {
      console.warn("Failed to reconnect global database during periodic check.");
    }
  }

  if (localConnectionEstablished() && isGlobalConnectionEstablished()) {
    console.log("Both databases connected. Triggering periodic syncData.");
    console.log(`Periodic Check: Local: ${localConnectionEstablished()}, Global: ${isGlobalConnectionEstablished()}`);
    try {
      await syncData();
      console.log("Periodic syncData completed successfully.");
    } catch (error) {
      console.error("Error during periodic syncData:", error);
    }
  } else {
    console.log("Periodic check: Global database still not connected. Skipping syncData.");
    console.log(`Periodic Check: Local: ${localConnectionEstablished()}, Global: ${isGlobalConnectionEstablished()}`);
  }
}, SYNC_INTERVAL);


// Utility for mapping local IDs to global IDs (implement as per your user/product sync logic)
async function getGlobalUserId(localUserId, localConn) {
  const [rows] = await localConn.query(
    'SELECT master_user_id FROM UserAccounts WHERE user_id = ?', [localUserId]
  );
  return rows.length > 0 ? rows[0].master_user_id : null;
}

// Modular sync function for UserAccounts
async function syncUserAccounts(localConnection, globalConnection) {
  if (!isGlobalConnectionEstablished()) {
    console.warn("Global database not connected. Skipping UserAccounts sync.");
    return;
  }
  console.log("Starting UserAccounts sync...");
  try {
    const [users] = await localConnection.execute(
      'SELECT user_id,mobile_number,email,name,address,created_at,TotalPoints,master_user_id,last_sync_date,is_sync,store_id FROM UserAccounts WHERE is_sync = 0 and master_user_id IS NULL'
    );

    for (const user of users) {
      const [globalUserRows] = await globalConnection.execute(
        `SELECT user_id, email, name, address, created_at, TotalPoints, store_id FROM UserAccounts WHERE mobile_number = ?`,
        [user.mobile_number]
      );

      let masterUserId;

      if (globalUserRows.length > 0) {
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
        // Audit trail for UserAccounts update
        const transactionIdUpdate = generateTransactionId();
        await insertAuditTrail(transactionIdUpdate, 'UserAccounts', user.user_id, 'master_user_id', user.master_user_id, masterUserId, 'UPDATE', changed_by_user);
        // Add other fields to audit if needed: email, name, address, TotalPoints, store_id
      } else {
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
            user.user_id,
            1
          ]
        );
        masterUserId = result.insertId;
        // Audit trail for UserAccounts insert
        const transactionIdInsert = generateTransactionId();
        await insertAuditTrail(transactionIdInsert, 'UserAccounts', masterUserId, '*', null, JSON.stringify(user), 'INSERT', changed_by_user);
        await localConnection.execute(
          `UPDATE UserAccounts
          SET master_user_id = ?,last_sync_date = NOW(), is_sync = 1
          WHERE user_id = ?`,
          [masterUserId, user.user_id]
        );
        // Audit trail for local UserAccounts update (master_user_id)
        const transactionIdLocalUpdate = generateTransactionId();
        await insertAuditTrail(transactionIdLocalUpdate, 'UserAccounts', user.user_id, 'master_user_id', user.master_user_id, masterUserId, 'UPDATE', changed_by_user);
      }
      console.log('User sync complete.');
    }
    console.log("UserAccounts sync completed.");
  } catch (error) {
    console.error("Error during UserAccounts sync:", error);
    throw error;
  }
}

// Modular sync function for Grocery_Products
async function syncGroceryProducts(localConnection, globalConnection) {
  if (!isGlobalConnectionEstablished()) {
    console.warn("Global database not connected. Skipping Grocery_Products sync.");
    return;
  }
  console.log("Starting Grocery_Products sync...");
  try {
    const [products] = await localConnection.query(
      `SELECT product_id, product, category, sub_category, brand, sale_price, market_price, type, rating , description, category_id,  quantity, sku_id, store_id, is_sync
      FROM Grocery_Products
      WHERE is_sync = 0`
    );

    for (const product of products) {
      const [existingGlobalProduct] = await globalConnection.execute(
        `SELECT master_product_id FROM Grocery_Products WHERE sku_id = ? AND store_id = ?`,
        [product.sku_id, product.store_id]
      );

      let masterProductId;

      if (existingGlobalProduct.length > 0) {
        masterProductId = existingGlobalProduct[0].master_product_id;
        await globalConnection.execute(
          `UPDATE Grocery_Products
          SET sale_price = ?, quantity = ?,is_sync=1
          WHERE sku_id = ? AND store_id = ?`,
          [
            product.sale_price,
            product.quantity,
            product.sku_id,
            product.store_id
          ]
        );
        // Audit trail for Grocery_Products update
        const transactionIdUpdate = generateTransactionId();
        await insertAuditTrail(transactionIdUpdate, 'Grocery_Products', product.product_id, 'sale_price', null, product.sale_price, 'UPDATE', changed_by_user);
        await insertAuditTrail(transactionIdUpdate, 'Grocery_Products', product.product_id, 'quantity', null, product.quantity, 'UPDATE', changed_by_user);
      } else {
        const [insertResult] = await globalConnection.execute(
          `INSERT INTO Grocery_Products
          (sku_id, sale_price, quantity, store_id, product, category, 
          sub_category, brand, market_price, master_category_id, type, rating, description, is_sync)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            product.sku_id,
            product.sale_price,
            product.quantity,
            product.store_id,
            product.product,
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
        // Audit trail for Grocery_Products insert
        const transactionIdInsert = generateTransactionId();
        await insertAuditTrail(transactionIdInsert, 'Grocery_Products', masterProductId, '*', null, JSON.stringify(product), 'INSERT', changed_by_user);
      }

      await localConnection.execute(
        `UPDATE Grocery_Products
        SET is_sync = 1, master_product_id = ?
        WHERE sku_id = ? AND store_id = ?`,
        [masterProductId, product.sku_id, product.store_id]
      );
      console.log('Product sync completed.');
    }
    console.log("Grocery_Products sync completed.");
  } catch (error) {
    console.error("Error during Grocery_Products sync:", error);
    throw error;
  }
}

// Modular sync function for Orders
async function syncOrders(localConnection, globalConnection) {
  if (!isGlobalConnectionEstablished()) {
    console.warn("Global database not connected. Skipping Orders sync.");
    return;
  }
  console.log("Starting Orders sync...");
  try {
    const [orders] = await localConnection.query('SELECT * FROM Orders WHERE is_sync = 0');

    for (const order of orders) {
      const globalUserId = await getGlobalUserId(order.user_id, localConnection);

      if (!globalUserId) {
        console.log('Global user id not found for order, skipping order sync.');
        continue;
      }

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
          order.total_amount, order.cart_id, order.order_id, POS_ID, STORE_ID
        ]
      );
      const globalOrderId = orderResult.insertId;
      console.log('Global order Id: ', globalOrderId);
      // Audit trail for Orders insert
      const transactionIdOrderInsert = generateTransactionId();
      await insertAuditTrail(transactionIdOrderInsert, 'Orders', globalOrderId, '*', null, JSON.stringify(order), 'INSERT', changed_by_user);

      const [items] = await localConnection.query(
        'SELECT * FROM OrderItems WHERE order_id = ? AND is_sync = 0', [order.order_id]
      );

      for (const item of items) {
        const localProductId = item.product_id;

        const [globalProduct] = await localConnection.query(
          'SELECT master_product_id FROM Grocery_Products WHERE product_id = ?', [localProductId]
        );

        const globalProductId = globalProduct[0].master_product_id;

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
        console.log('Global order item Id: ', globalOrderItemId);
        // Audit trail for OrderItems insert
        const transactionIdOrderItemInsert = generateTransactionId();
        await insertAuditTrail(transactionIdOrderItemInsert, 'OrderItems', globalOrderItemId, '*', null, JSON.stringify(item), 'INSERT', changed_by_user);

        await localConnection.query(
          `UPDATE OrderItems
          SET master_order_item_id = ?, master_order_id = ?, last_sync_date = NOW(), is_sync = 1
          WHERE order_item_id = ?`,
          [globalOrderItemId, globalOrderId, item.order_item_id]
        );
        // Audit trail for OrderItems update (master_order_item_id, master_order_id)
        const transactionIdOrderItemUpdate = generateTransactionId();
        await insertAuditTrail(transactionIdOrderItemUpdate, 'OrderItems', item.order_item_id, 'master_order_item_id', null, globalOrderItemId, 'UPDATE', changed_by_user);
        await insertAuditTrail(transactionIdOrderItemUpdate, 'OrderItems', item.order_item_id, 'master_order_id', null, globalOrderId, 'UPDATE', changed_by_user);
      }

      await localConnection.query(
        `UPDATE Orders
        SET master_order_id = ?, last_sync_date = NOW(), is_sync = 1
        WHERE order_id = ?`,
        [globalOrderId, order.order_id]
      );
      // Audit trail for Orders update (master_order_id)
      const transactionIdOrderUpdate = generateTransactionId();
      await insertAuditTrail(transactionIdOrderUpdate, 'Orders', order.order_id, 'master_order_id', null, globalOrderId, 'UPDATE', changed_by_user);
      console.log('Full update of order id: ', order.order_id, 'complete.');
    }
    console.log("Orders sync completed.");
  } catch (error) {
    console.error("Error during Orders sync:", error);
    throw error;
  }
}

// Modular sync function for Points_Event
async function syncPointsEvents(localConnection, globalConnection) {
  if (!isGlobalConnectionEstablished()) {
    console.warn("Global database not connected. Skipping Points_Event sync.");
    return;
  }
  console.log("Starting Points_Event sync...");
  try {
    const [pointsEvents] = await localConnection.query(
      `SELECT pe.*, ua.master_user_id, o.master_order_id
     FROM pos_poc.Points_Event pe
     JOIN pos_poc.UserAccounts ua ON pe.user_id = ua.user_id
     LEFT JOIN pos_poc.Orders o ON pe.order_id = o.order_id
     WHERE pe.is_sync = 0
     ORDER BY pe.created_at ASC,pe.id ASC`
    );

    for (const event of pointsEvents) {
      if (!event.master_user_id) {
        console.warn(`Skipping Points_Event ${event.id}: master_user_id not found for local user_id ${event.user_id}`);
        continue;
      }

      // Insert into global Points_Event table
      const [insertResult] = await globalConnection.query(
        `INSERT INTO Points_Event (
          master_user_id, activity_type_id, master_order_id, points, activity_desc, 
          created_at, pos_id, store_id,is_sync,last_sync_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?,1,NOW())`,
        [
          event.master_user_id,
          event.activity_type_id,
          event.master_order_id, // Use master_order_id
          event.points,
          event.activity_desc,
          event.created_at,
          event.pos_id,
          event.store_id
        ]
      );
      const masterPointsEventId = insertResult.insertId;
      // Audit trail for Points_Event insert
      const transactionIdPointsEventInsert = generateTransactionId();
      await insertAuditTrail(transactionIdPointsEventInsert, 'Points_Event', masterPointsEventId, '*', null, JSON.stringify(event), 'INSERT', changed_by_user);

      // Recalculate global balance_after
      const [masterBalanceRows] = await globalConnection.query(
        `SELECT SUM(points) AS master_balance_after FROM Points_Event 
      WHERE master_user_id = ? GROUP BY master_user_id`,
        [event.master_user_id]
      );
      const masterBalanceAfter = masterBalanceRows.length > 0 ? masterBalanceRows[0].master_balance_after : 0;

      // Update the balance_after in the newly inserted global record
      await globalConnection.query(
        `UPDATE Points_Event SET master_balance_after = ? WHERE id = ?`,
        [masterBalanceAfter, masterPointsEventId]
      );
      // Audit trail for Points_Event update (master_balance_after)
      const transactionIdPointsEventUpdate = generateTransactionId();
      await insertAuditTrail(transactionIdPointsEventUpdate, 'Points_Event', masterPointsEventId, 'master_balance_after', null, masterBalanceAfter, 'UPDATE', changed_by_user);

      // Update TotalPoints in global UserAccounts table for this user
      await globalConnection.query(
        `UPDATE UserAccounts SET TotalPoints = ? WHERE user_id = ?`,
        [masterBalanceAfter, event.master_user_id]
      );
      // Audit trail for UserAccounts update (TotalPoints)
      const transactionIdUserAccountsUpdate = generateTransactionId();
      await insertAuditTrail(transactionIdUserAccountsUpdate, 'UserAccounts', event.master_user_id, 'TotalPoints', null, masterBalanceAfter, 'UPDATE', changed_by_user);

      // Update local Points_Event to mark as synced and store global_points_event_id
      await localConnection.query(
        `UPDATE pos_poc.Points_Event SET is_sync = 1,last_sync_date=NOW() WHERE id = ?`,
        [event.id]
      );
      console.log(`Points_Event ${event.id} synced.`);
    }
    console.log("Points_Event sync completed.");
  } catch (error) {
    console.error("Error during Points_Event sync:", error);
    throw error;
  }
}

// Main syncData function to orchestrate modular syncs
async function syncData() {
  try {
    if (!isGlobalConnectionEstablished()) {
      console.warn("Global database not connected during syncData. Skipping synchronization.");
      throw new Error("Global DB not connected.");
    }

    await syncUserAccounts(localConnection, globalConnection);
    await syncGroceryProducts(localConnection, globalConnection);
    await syncOrders(localConnection, globalConnection);
    await syncPointsEvents(localConnection, globalConnection);

    console.log("All sync operations completed.");

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

app.post('/api/send-bill-email', async (req, res) => {
  const { toEmail, orderId, cartGrandTotal } = req.body;

  if (!toEmail || !orderId || cartGrandTotal === undefined) {
    return res.status(400).json({ message: 'Missing required fields: toEmail, orderId, cartGrandTotal.' });
  }

  try {
    // Assuming the receipt PDF is already generated and saved by the generate-receipt endpoint.
    // Construct the path to the receipt.
    const filename = `receipt_${orderId}.pdf`;
    const receiptPath = path.join(__dirname, '..', 'frontend', 'public', 'invoices', filename);

    // Check if the file actually exists before attempting to send it
    if (!fs.existsSync(receiptPath)) {
      // Attempt to generate the receipt if it doesn't exist
      // This might involve re-using the logic from /api/generate-receipt/:orderId
      // For now, we'll just log an error and indicate it's not found
      console.warn(`Receipt file not found at ${receiptPath}. Attempting to generate on demand.`);

      // This part would ideally trigger the receipt generation logic if not already present.
      // For this implementation, we'll assume it's created by the 'Print Bill' action.
      // If you want to automatically generate it here, you'd need to call the receipt generation function.
      // For now, if it's not found, we'll send the email without an attachment but with a link.
      // A robust solution would call the generation logic here.
    }

    const frontendReceiptUrl = `${process.env.FRONTEND_URL}/invoices/${filename}`;

    const emailResult = await sendBillByEmail(toEmail, orderId, cartGrandTotal, frontendReceiptUrl);

    if (emailResult.success) {
      res.status(200).json({ message: emailResult.message });
    } else {
      res.status(500).json({ message: emailResult.message, error: emailResult.error });
    }

  } catch (error) {
    console.error('Error in /api/send-bill-email:', error);
    res.status(500).json({ message: 'Internal server error sending bill email.', error: error.message });
  }
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
    globalConnected: isGlobalConnectionEstablished(),
  });
});

app.get('/api/products', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const offset = (page - 1) * limit;
  const category = req.query.category;
  const searchTerm = req.query.search;
  const isSync = req.query.isSync; // New: Get isSync filter from query
  const brand = req.query.brand; // New: Get brand filter from query

  let query = `SELECT product_id, Sku_id, product, category, brand, sale_price, market_price, category_id, quantity, is_sync FROM pos_poc.Grocery_Products`;
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
  if (isSync !== undefined) {
    conditions.push(`is_sync = ?`);
    queryParams.push(isSync);
  }
  if (brand && brand !== 'all') {
    conditions.push(`brand = ?`);
    queryParams.push(brand);
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

app.get('/api/brands', async (req, res) => {
  try {
    const [brands] = await localConnection.query(
      `SELECT DISTINCT brand FROM pos_poc.Grocery_Products WHERE brand IS NOT NULL AND brand != '' ORDER BY brand`
    );
    res.json(brands.map(row => row.brand));
  } catch (err) {
    console.error('Error fetching brands:', err);
    res.status(500).json({ error: 'Error fetching brands' });
  }
});

app.put('/api/products/:product_id/price', async (req, res) => {
  const productId = req.params.product_id;
  const { sale_price } = req.body;

  const query = `UPDATE pos_poc.Grocery_Products SET sale_price = ? WHERE product_id = ?`;
  try {
    const [oldProductRows] = await localConnection.query(`SELECT sale_price FROM pos_poc.Grocery_Products WHERE product_id = ?`, [productId]);
    const old_sale_price = oldProductRows.length > 0 ? oldProductRows[0].sale_price : null;

    const [results] = await localConnection.query(query, [sale_price, productId]);
    if (results.affectedRows === 0) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    // Audit trail for Grocery_Products price update
    const transactionId = generateTransactionId();
    await insertAuditTrail(transactionId, 'Grocery_Products', productId, 'sale_price', old_sale_price, sale_price, 'UPDATE', changed_by_user);
    res.json({ message: `Sale price for product ID ${productId} updated to ${sale_price}` });
  } catch (err) {
    console.error('Error updating product price:', err);
    res.status(500).json({ error: 'Error updating product price' });
  }
});

app.put('/api/products/:product_id', async (req, res) => {
  const productId = req.params.product_id;
  const { product, quantity, sale_price, market_price } = req.body;

  try {
    // Fetch old values for audit trail
    const [oldProductRows] = await localConnection.query(
      `SELECT product, quantity, sale_price, market_price FROM pos_poc.Grocery_Products WHERE product_id = ?`,
      [productId]
    );
    const oldProduct = oldProductRows.length > 0 ? oldProductRows[0] : {};

    const query = `UPDATE pos_poc.Grocery_Products SET product = ?, quantity = ?, sale_price = ?, market_price = ? WHERE product_id = ?`;
    const [results] = await localConnection.query(query, [product, quantity, sale_price, market_price, productId]);
    if (results.affectedRows === 0) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    // Audit trail for Grocery_Products update
    const transactionId = generateTransactionId();
    if (oldProduct.product !== product) {
      await insertAuditTrail(transactionId, 'Grocery_Products', productId, 'product', oldProduct.product, product, 'UPDATE', changed_by_user);
    }
    if (oldProduct.quantity !== quantity) {
      await insertAuditTrail(transactionId, 'Grocery_Products', productId, 'quantity', oldProduct.quantity, quantity, 'UPDATE', changed_by_user);
    }
    if (oldProduct.sale_price !== sale_price) {
      await insertAuditTrail(transactionId, 'Grocery_Products', productId, 'sale_price', oldProduct.sale_price, sale_price, 'UPDATE', changed_by_user);
    }
    if (oldProduct.market_price !== market_price) {
      await insertAuditTrail(transactionId, 'Grocery_Products', productId, 'market_price', oldProduct.market_price, market_price, 'UPDATE', changed_by_user);
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
      // Audit trail for UserAccounts insert
      const transactionId = generateTransactionId();
      await insertAuditTrail(transactionId, 'UserAccounts', userId, '*', null, JSON.stringify({ mobile_number, store_id: STORE_ID }), 'INSERT', changed_by_user);
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
        // Audit trail for Orders insert
        const transactionIdOrder = generateTransactionId();
        await insertAuditTrail(transactionIdOrder, 'Orders', orderId, '*', null, JSON.stringify(req.body), 'INSERT', changed_by_user);

        // 2. Create OrderItems records
        for (const item of cart_items) {
            // Retrieve sku_id and sale_price from Grocery_Products based on product_id
            const [productInfo] = await localConnection.query(
              `SELECT Sku_id, sale_price, quantity FROM pos_poc.Grocery_Products WHERE product_id = ?`,
              [item.product_id]
            );

            if (productInfo.length === 0) {
              throw new Error(`Product with ID ${item.product_id} not found.`);
            }
            const oldQuantity = productInfo[0].quantity;

            const [insertOrderItemResult] = await localConnection.query(
              `INSERT INTO pos_poc.OrderItems (
                order_id, product_id, sku_id, quantity, sale_price, adjusted_price
              ) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                orderId, item.product_id, productInfo[0].Sku_id,
                item.quantity, productInfo[0].sale_price, productInfo[0].sale_price // adjusted_price same as sale_price for now
              ]
            );
            const orderItemId = insertOrderItemResult.insertId;
            // Audit trail for OrderItems insert
            const transactionIdOrderItem = generateTransactionId();
            await insertAuditTrail(transactionIdOrderItem, 'OrderItems', orderItemId, '*', null, JSON.stringify(item), 'INSERT', changed_by_user);

            // Decrement quantity in Grocery_Products table
            const newQuantity = oldQuantity - item.quantity;
            await localConnection.query(
              `UPDATE pos_poc.Grocery_Products SET quantity = ?,is_sync=0 WHERE Sku_id = ?`,
              [newQuantity, productInfo[0].Sku_id]
            );
            // Audit trail for Grocery_Products quantity update
            const transactionIdProductQuantity = generateTransactionId();
            await insertAuditTrail(transactionIdProductQuantity, 'Grocery_Products', item.product_id, 'quantity', oldQuantity, newQuantity, 'UPDATE', changed_by_user);
        }

        // 2.a. If points are redeemed, insert entry in Points_Event table (activity_type_id=5)
        if (points_redeemed > 0) {
          const newBalanceAfterRedemption = currentPointsBalance - points_redeemed;
          const [insertPointsEventRedeemResult] = await localConnection.query(
            `INSERT INTO pos_poc.Points_Event (user_id, activity_type_id, order_id, points, balance_after, activity_desc, created_at, pos_id, store_id)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
            [userId, 5, orderId, -points_redeemed, newBalanceAfterRedemption,'Points redeemed', POS_ID, STORE_ID]
          );
          // Audit trail for Points_Event insert (redemption)
          const transactionIdPointsRedeem = generateTransactionId();
          await insertAuditTrail(transactionIdPointsRedeem, 'Points_Event', insertPointsEventRedeemResult.insertId, '*', null, JSON.stringify({ userId, activity_type_id: 5, order_id: orderId, points: -points_redeemed, balance_after: newBalanceAfterRedemption, activity_desc: 'Points redeemed', pos_id: POS_ID, store_id: STORE_ID }), 'INSERT', changed_by_user);
          currentPointsBalance = newBalanceAfterRedemption; // Update balance for next event

          // Update TotalPoints in local UserAccounts table for this user
          await localConnection.query(
            `UPDATE pos_poc.UserAccounts SET TotalPoints = ? WHERE user_id = ?`,
            [newBalanceAfterRedemption, userId]
          );
          // Audit trail for UserAccounts update (TotalPoints) in local DB
          const transactionIdLocalUserAccountsUpdate = generateTransactionId();
          await insertAuditTrail(transactionIdLocalUserAccountsUpdate, 'UserAccounts', userId, 'TotalPoints', null, newBalanceAfterRedemption, 'UPDATE', changed_by_user);
        }

        
        // 2.b. Insert entry in Points_Event table for order creation (activity_type_id=4)
        const pointsEarned = Math.floor(cartGrandTotal / 100) * 5;
        if (pointsEarned > 0) {
          const newBalanceAfterOrder = currentPointsBalance + pointsEarned;
          const [insertPointsEventEarnResult] = await localConnection.query(
            `INSERT INTO pos_poc.Points_Event (user_id, activity_type_id, order_id, points, balance_after, activity_desc, created_at, pos_id, store_id)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
            [userId, 4, orderId, pointsEarned, newBalanceAfterOrder, 'Points earned from order', POS_ID, STORE_ID]
          );
          // Audit trail for Points_Event insert (earning)
          const transactionIdPointsEarn = generateTransactionId();
          await insertAuditTrail(transactionIdPointsEarn, 'Points_Event', insertPointsEventEarnResult.insertId, '*', null, JSON.stringify({ userId, activity_type_id: 4, order_id: orderId, points: pointsEarned, balance_after: newBalanceAfterOrder, activity_desc: 'Points earned from order', pos_id: POS_ID, store_id: STORE_ID }), 'INSERT', changed_by_user);
          currentPointsBalance = newBalanceAfterOrder; // Update balance for next event
 
          // Update TotalPoints in local UserAccounts table for this user
          await localConnection.query(
            `UPDATE pos_poc.UserAccounts SET TotalPoints = ? WHERE user_id = ?`,
            [newBalanceAfterOrder, userId]
          );
          // Audit trail for UserAccounts update (TotalPoints) in local DB
          const transactionIdLocalUserAccountsUpdate = generateTransactionId();
          await insertAuditTrail(transactionIdLocalUserAccountsUpdate, 'UserAccounts', userId, 'TotalPoints', null, newBalanceAfterOrder, 'UPDATE', changed_by_user);
        }

        // Increment total_redeems for the used discount code
        if (discount_code) {
          const [oldDiscountCouponRows] = await localConnection.query(
            `SELECT total_redeems FROM pos_poc.DiscountCoupons WHERE discount_code = ?`,
            [discount_code]
          );
          const oldTotalRedeems = oldDiscountCouponRows.length > 0 ? oldDiscountCouponRows[0].total_redeems : 0;

          await localConnection.query(
            `UPDATE pos_poc.DiscountCoupons SET total_redeems = total_redeems + 1 WHERE discount_code = ?`,
            [discount_code]
          );
          // Audit trail for DiscountCoupons update
          const transactionIdDiscountCoupon = generateTransactionId();
          await insertAuditTrail(transactionIdDiscountCoupon, 'DiscountCoupons', discount_code, 'total_redeems', oldTotalRedeems, oldTotalRedeems + 1, 'UPDATE', changed_by_user);
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
        o.payment_method,
        o.is_sync
      FROM 
        pos_poc.Orders o
      JOIN 
        pos_poc.UserAccounts ua ON o.user_id = ua.user_id
      JOIN 
        pos_poc.OrderItems oi ON o.order_id = oi.order_id
      GROUP BY
        o.order_id, o.total_amount, ua.mobile_number, o.payment_method, o.is_sync
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
         o.item_total_amount,
         o.order_date,
         o.last_sync_date,
         o.is_sync
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
    let currentPointsBalance = 0;

    if (isGlobalConnectionEstablished()) {
      // Attempt to fetch from global database first
      const globalDb = getConnections().globalConnection;
      if (globalDb) {
        const [userAccountRows] = await globalDb.query(
          `SELECT user_id FROM UserAccounts WHERE mobile_number = ?`,
          [mobile_number]
        );

        if (userAccountRows.length > 0 && userAccountRows[0].user_id) {
          const globalUserId = userAccountRows[0].user_id;
          const [globalPointsRows] = await globalDb.query(
            `SELECT master_balance_after FROM Points_Event WHERE master_user_id = ? ORDER BY id DESC,created_at DESC LIMIT 1`,
            [globalUserId]
          );
          if (globalPointsRows.length > 0) {
            currentPointsBalance = globalPointsRows[0].master_balance_after;
            return res.status(200).json({ balance_after: currentPointsBalance });
          }
        }
      }
    }

    // Fallback to local database if global fetching fails or not connected
    const [userRows] = await localConnection.query(
      `SELECT user_id FROM pos_poc.UserAccounts WHERE mobile_number = ?`,
      [mobile_number]
    );

    if (userRows.length === 0) {
      return res.status(200).json({ balance_after: 0, message: 'User not found. No points to redeem.' });
    }

    const userId = userRows[0].user_id;

    const [pointsRows] = await localConnection.query(
      `SELECT balance_after FROM pos_poc.Points_Event WHERE user_id = ? ORDER BY id DESC,created_at DESC LIMIT 1`,
      [userId]
    );

    if (pointsRows.length === 0) {
      return res.status(200).json({ balance_after: 0, message: 'No points events found for this user.' });
    }

    currentPointsBalance = pointsRows[0].balance_after;
    res.status(200).json({ balance_after: currentPointsBalance });

  } catch (error) {
    console.error('Error fetching points balance:', error);
    res.status(500).json({ message: 'Internal server error fetching points balance.' });
  }
});

app.get('/api/discounts', async (req, res) => {
  try {
    const query = `
      SELECT
        discount_code,
        discount_type,
        discount_value,
        min_cart_value,
        max_cart_applicable,
        usage_limit,
        start_date,
        expiry_date,
        total_redeems,
        status,
        is_sync
      FROM
        pos_poc.DiscountCoupons
    `;
    const [results] = await localConnection.query(query);
    res.json(results);
  } catch (error) {
    console.error('Error fetching discount coupons:', error);
    res.status(500).json({ error: 'Internal server error fetching discount coupons' });
  }
});

app.put('/api/discounts/:discount_code', async (req, res) => {
  const discountCode = req.params.discount_code;
  const { expiry_date, usage_limit, status } = req.body;

  const queryParams = [];
  const updates = [];

  try {
    // Fetch old values for audit trail
    const [oldCouponRows] = await localConnection.query(
      `SELECT expiry_date, usage_limit, status FROM pos_poc.DiscountCoupons WHERE discount_code = ?`,
      [discountCode]
    );
    const oldCoupon = oldCouponRows.length > 0 ? oldCouponRows[0] : {};

    if (expiry_date !== undefined) {
      updates.push(`expiry_date = ?`);
      queryParams.push(expiry_date);
    }
    if (usage_limit !== undefined) {
      updates.push(`usage_limit = ?`);
      queryParams.push(usage_limit);
    }
    if (status !== undefined) {
      updates.push(`status = ?`);
      queryParams.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No update fields provided.' });
    }

    queryParams.push(discountCode);

    const query = `UPDATE pos_poc.DiscountCoupons SET ${updates.join(', ')} WHERE discount_code = ?`;

    const [results] = await localConnection.query(query, queryParams);
    if (results.affectedRows === 0) {
      res.status(404).json({ message: 'Discount coupon not found.' });
      return;
    }
    // Audit trail for DiscountCoupons update
    const transactionId = generateTransactionId();
    if (oldCoupon.expiry_date !== expiry_date && expiry_date !== undefined) {
      await insertAuditTrail(transactionId, 'DiscountCoupons', discountCode, 'expiry_date', oldCoupon.expiry_date, expiry_date, 'UPDATE', changed_by_user);
    }
    if (oldCoupon.usage_limit !== usage_limit && usage_limit !== undefined) {
      await insertAuditTrail(transactionId, 'DiscountCoupons', discountCode, 'usage_limit', oldCoupon.usage_limit, usage_limit, 'UPDATE', changed_by_user);
    }
    if (oldCoupon.status !== status && status !== undefined) {
      await insertAuditTrail(transactionId, 'DiscountCoupons', discountCode, 'status', oldCoupon.status, status, 'UPDATE', changed_by_user);
    }
    res.json({ message: `Discount coupon ${discountCode} updated successfully.` });
  } catch (error) {
    console.error('Error updating discount coupon:', error);
    res.status(500).json({ error: 'Internal server error updating discount coupon.' });
  }
});

const PDFDocument = require('pdfkit');

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