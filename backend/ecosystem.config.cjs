const fs = require('fs');
const path = require('path');

// Allow PM2 to automatically load environment variables from .env files
const envFiles = ['.env', '.env.production']
  .map(file => path.join(__dirname, file))
  .filter(filePath => fs.existsSync(filePath));

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

if (envFiles.length > 0) {
  appConfig.env_file = envFiles;
}

module.exports = {
  apps: [appConfig]
};
