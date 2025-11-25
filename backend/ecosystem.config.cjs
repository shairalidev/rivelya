const fs = require('fs');
const path = require('path');

const appConfig = {
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
};

// Load env per environment (PM2 expects a string or object, not an array)
const envFileDev = path.join(__dirname, '.env');
const envFileProd = path.join(__dirname, '.env.production');

appConfig.env_file = {
  development: fs.existsSync(envFileDev) ? envFileDev : undefined,
  production: fs.existsSync(envFileProd) ? envFileProd : undefined
};

module.exports = {
  apps: [appConfig]
};
