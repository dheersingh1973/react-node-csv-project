const { override } = require('customize-cra');

module.exports = override(
  (config, env) => {
    // Add your custom webpack configurations here
    if (env === 'development') {
      config.devServer = {
        ...config.devServer,
        setupMiddlewares: (middlewares, devServer) => {
          if (!devServer) {
            throw new Error('webpack-dev-server is not defined');
          }
          // Your custom middleware logic here
          // Example: devServer.app.get('/api', (req, res) => res.send('Hello from API!'));
          return middlewares;
        },
      };
    }
    return config;
  }
);
