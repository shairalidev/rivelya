module.exports = {
  apps: [
    {
      name: "rivelya-backend",
      script: "server.js",
      cwd: "/var/www/rivelya/rivelya/backend",
      watch: false,

      // Default environment
      env: {
        NODE_ENV: "development"
      },

      // Production environment
      env_production: {
        NODE_ENV: "production"
      }
    }
  ]
};
