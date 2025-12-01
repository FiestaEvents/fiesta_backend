module.exports = {
  apps: [
    {
      name: "api-dev", // Distinct name
      script: "./src/server.js", // Check if your file is index.js or server.js
      cwd: "/var/www/fiesta_dev/server", // Locked to Dev folder
      env: {
        NODE_ENV: "production", // Use prod mode for realistic testing
        PORT: 5001, // Locked to Port 5001
      },
    },
  ],
};
