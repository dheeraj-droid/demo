// pm2 process config for the always-on (home machine / Pi) deployment path.
//   pm2 start ecosystem.config.cjs
//   pm2 logs qc-bot        # watch the QR on first run
//   pm2 save && pm2 startup # survive reboots
module.exports = {
  apps: [
    {
      name: 'qc-bot',
      script: 'src/index.js',
      // ESM entrypoint — pm2 runs it via node, which honors "type":"module".
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      // Chromium can leak memory over long runs; recycle if it balloons.
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
