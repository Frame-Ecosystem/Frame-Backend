/**
 * @description pm2 configuration file.
 * @example
 *  production mode :: pm2 start ecosystem.config.js --only prod
 *  development mode :: pm2 start ecosystem.config.js --only dev
 */
 module.exports = {
  apps: [
    {
      name: 'frame-beauty-prod', // pm2 start App name
      script: 'dist/server.js',
      exec_mode: 'cluster', // 'cluster' or 'fork'
      instance_var: 'INSTANCE_ID', // instance variable
      instances: 'max', // Use all available CPU cores
      autorestart: true, // auto restart if process crash
      watch: false, // files change automatic restart
      ignore_watch: ['node_modules', 'logs'], // ignore files change
      max_memory_restart: '1G', // restart if process use more than 1G memory
      merge_logs: true, // if true, stdout and stderr will be merged and sent to pm2 log
      output: './logs/access.log', // pm2 log file
      error: './logs/error.log', // pm2 error log file
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z', // log date format
      env: { // environment variable
        PORT: 3000,
        NODE_ENV: 'production',
        // Production environment variables will be loaded from .env.production.local
      },
      // Production-specific PM2 settings
      node_args: '--max-old-space-size=4096', // Increase Node.js heap size
      kill_timeout: 5000, // Wait 5 seconds before force killing
      wait_ready: false, // App does not emit process ready signal
      listen_timeout: 10000, // Wait 10 seconds for app to listen
    },
    {
      name: 'frame-beauty-dev', // pm2 start App name
      script: 'ts-node', // ts-node
      args: '-r tsconfig-paths/register --transpile-only src/server.ts', // ts-node args
      exec_mode: 'cluster', // 'cluster' or 'fork'
      instance_var: 'INSTANCE_ID', // instance variable
      instances: 2, // pm2 instance count
      autorestart: true, // auto restart if process crash
      watch: false, // files change automatic restart
      ignore_watch: ['node_modules', 'logs'], // ignore files change
      max_memory_restart: '1G', // restart if process use more than 1G memory
      merge_logs: true, // if true, stdout and stderr will be merged and sent to pm2 log
      output: './logs/access.log', // pm2 log file
      error: './logs/error.log', // pm2 error log file
      env: { // environment variable
        PORT: 3000,
        NODE_ENV: 'development',
      },
    },
  ],
  deploy: {
    production: {
      user: process.env.DEPLOY_USER || 'deploy',
      host: process.env.DEPLOY_HOST || '0.0.0.0',
      ref: 'origin/main',
      repo: 'git@github.com:frame-enterprise/frame-beauty-api.git',
      path: '/var/www/frame-beauty-api',
      'post-deploy': 'npm ci --production && npm run build && pm2 reload ecosystem.config.js --only frame-beauty-prod',
    },
  },
};
