const write = (stream, message) => {
  stream.write(`${message}\n`);
};

const logger = {
  info: (message) => write(process.stdout, message),
  warn: (message) => write(process.stderr, message),
  error: (message) => write(process.stderr, message),
};

module.exports = logger;
