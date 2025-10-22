const mysql2 = require('mysql2');

let localConnection;
let globalConnection;
let localConnectionEstablished = false;
let globalConnectionEstablished = false;
let isGlobalConnectionInProgress = false;

const createLocalConnection = () => {
  localConnection = mysql2.createConnection({
    host: 'localhost',
    port: 3307,
    user: 'root',
    password: 'Tink@2Mink',
    database: 'pos_poc'
  });

  localConnection.on('error', (err) => {
    console.error('Local DB error:', err.code);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'EADDRNOTAVAIL') {
      console.log('Attempting to reconnect to local DB...');
      localConnectionEstablished = false;
      setTimeout(connectLocalDB, 5000); // Reconnect after 5 seconds
    } else {
      throw err; // Re-throw other errors
    }
  });
};

const createGlobalConnection = () => {
  globalConnection = mysql2.createConnection({
    host: 'demo-poc.c1a2si8mm232.ap-south-1.rds.amazonaws.com', // Fallback to localhost if not set
    port: 3308,
    user: 'admin',
    password: 'Tink&7Mink',
    database: 'pos_poc_master'
  });

  globalConnection.on('error', (err) => {
    console.error('Global DB error:', err.code);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'EADDRNOTAVAIL' || err.code === 'ENOTFOUND') {
      console.log('Global DB connection lost.');
      globalConnectionEstablished = false;
      isGlobalConnectionInProgress = false;
      globalConnection = null; // Invalidate the connection object
      // Do not attempt to reconnect here automatically. Reconnection will be triggered externally.
    } else {
      throw err; // Re-throw other errors
    }
  });
};

const connectLocalDB = () => {
  return new Promise((resolve, reject) => {
    if (!localConnection) {
      createLocalConnection();
    }
    localConnection.connect((err) => {
      if (err) {
        console.error('Error connecting to the local POS database:', err);
        localConnectionEstablished = false;
        return reject(err);
      }
      console.log('Connected to the MySQL local POS database!');
      localConnectionEstablished = true;
      resolve();
    });
  });
};

const connectGlobalDB = () => {
  return new Promise((resolve, reject) => {
    if (globalConnectionEstablished) {
      return resolve();
    }
    if (!globalConnection || (globalConnection && globalConnection._closing)) {
      createGlobalConnection();
    }
    if (isGlobalConnectionInProgress) {
      return resolve();
    }
    isGlobalConnectionInProgress = true;
    globalConnection.connect((err) => {
      if (err) {
        console.error('Error connecting to the central POS database:', err);
        globalConnectionEstablished = false;
        isGlobalConnectionInProgress = false;
        globalConnection = null; // Ensure new connection is created next time
        return reject(err); // Reject on error to signal failure
      }
      console.log('Connected to the MySQL global POS database!');
      globalConnectionEstablished = true;
      isGlobalConnectionInProgress = false;
      resolve();
    });
  });
};

const reconnectGlobalDB = async () => {
  if (!globalConnectionEstablished && !isGlobalConnectionInProgress) {
    console.log("Attempting to reconnect to global DB...");
    try {
      await connectGlobalDB();
      return true; // Indicate success
    } catch (error) {
      console.error("Failed to reconnect global DB:", error.message);
      return false; // Indicate failure
    }
  }
  return globalConnectionEstablished(); // If already connected or in progress, return current status
};

const connectDB = async () => {
  try {
    await connectLocalDB();
    console.log("Local database connected!");
  } catch (error) {
    console.error("Failed to connect to local database:", error);
    throw error; // Re-throw local DB connection errors as it's critical
  }

  // Attempt to connect to global DB, but don't block startup or exit on failure
  try {
    await connectGlobalDB();
    console.log("Global database connected!");
  } catch (error) {
    console.warn("Could not connect to global database, operating in local-only mode:", error.message);
    globalConnectionEstablished = false;
  }
}; 

const connectGlobalDBFailed = async() =>{
  console.log('Global DB connection lost.');
  globalConnectionEstablished = false;
  isGlobalConnectionInProgress = false;
  globalConnection = null; // Invalidate the connection object
}

module.exports = {
  connectDB,
  getConnections: () => ({ localConnection: localConnection ? localConnection.promise() : null, globalConnection: globalConnection ? globalConnection.promise() : null }),
  localConnectionEstablished: () => localConnectionEstablished,
  globalConnectionEstablished: () => globalConnectionEstablished,
  reconnectGlobalDB,
  connectGlobalDBFailed,
};
