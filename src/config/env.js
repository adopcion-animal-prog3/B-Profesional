require('dotenv').config();

const config = {
  port: Number(process.env.PORT) || 3000,
};

module.exports = config;
