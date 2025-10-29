module.exports = {
  apps: [
    {
      name: 'aigle-send',
      script: './build/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
    },
  ],
}
