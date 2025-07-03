import { spawn } from 'child_process';

console.log('Testing MCP server startup...');

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send initialization request
const initRequest = {
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {}
  },
  id: 1
};

server.stdin.write(JSON.stringify(initRequest) + '\n');

// Handle responses
server.stdout.on('data', (data) => {
  console.log('Server response:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('Server log:', data.toString());
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
});

// Give it some time then kill it
setTimeout(() => {
  console.log('\nShutting down test server...');
  server.kill();
  process.exit(0);
}, 3000);