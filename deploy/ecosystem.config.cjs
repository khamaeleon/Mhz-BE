// PM2 설정: pm2 start deploy/ecosystem.config.cjs
// DailyNews 서버가 PM2 가 아니라 systemd·Docker 를 쓰면 deploy/mhz-api.service 를 참고
module.exports = {
  apps: [
    {
      name: 'mhz-api',
      cwd: __dirname + '/..',
      script: 'src/server.js',
      node_args: '--env-file=.env',
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
    },
  ],
};
