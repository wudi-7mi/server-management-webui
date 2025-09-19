module.exports = {
    apps: [{
      name: 'model-server',
      script: 'server.js',
      cwd: './',
      user: 'root',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    }]
  }