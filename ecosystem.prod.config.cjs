module.exports = {
  apps: [
    {
      name: "api",
      script: "./src/server.js",
      cwd: "/var/www/fiesta/server",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
    },
  ],
};
