const mysql2 = require('mysql2');

let localConnectionEstablished = false;
let globalConnectionEstablished = false;

const localConnection = mysql2.createConnection({
  host: 'localhost',
  port: 3307,
  user: 'root',
  password: 'Tink@2Mink',
  database: 'pos_poc'
});

const globalConnection = mysql2.createConnection({
  host: 'demo-poc.c1a2si8mm232.ap-south-1.rds.amazonaws.com',
  port: 3308,
  user: 'admin',
  password: 'Tink&7Mink',
  database: 'pos_poc_master'
});

const connectDB = () => {
  return new Promise((resolve, reject) => {
    localConnection.connect((err) => {
      if (err) {
        console.error('Error connecting to the local POS database:', err);
        localConnectionEstablished = false;
        return reject(err);
      }
      console.log('Connected to the MySQL local POS database!');
      localConnectionEstablished = true;
      if (globalConnectionEstablished) {
        resolve();
      }
    });

    globalConnection.connect((err) => {
      if (err) {
        console.error('Error connecting to the central POS database:', err);
        globalConnectionEstablished = false;
        return reject(err);
      }
      console.log('Connected to the MySQL global POS database!');
      globalConnectionEstablished = true;
      if (localConnectionEstablished) {
        resolve();
      }
    });
  });
};

module.exports = {
  localConnection: localConnection.promise(),
  globalConnection: globalConnection.promise(),
  connectDB
};