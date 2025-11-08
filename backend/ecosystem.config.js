module.exports = {
  apps: [
    {
      name: 'rivelya-backend',
      script: 'server.js',
      cwd: '/var/www/rivelya/backend',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
