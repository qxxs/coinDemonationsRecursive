module.exports = {
  apps: [
    {
      name: "roblox-discord-bot",
      script: "./src/index.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: "10s",
      listen_timeout: 3000,
      kill_timeout: 5000,
    },
  ],
};
