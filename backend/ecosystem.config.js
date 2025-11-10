module.exports = {
  apps: [
    {
      name: 'rivelya-backend',
      script: 'server.js',
      cwd: '/var/www/rivelya/rivelya/backend',
      watch: false,
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
