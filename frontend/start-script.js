const { spawn } = require('child_process');

const child = spawn('react-scripts', ['start'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: { ...process.env, PORT: 3001 }
});

child.on('error', (error) => {
  console.error(`Error starting react-scripts: ${error}`);
});

child.on('exit', (code, signal) => {
  if (code !== 0) {
    console.error(`react-scripts exited with code ${code} and signal ${signal}`);
  }
});