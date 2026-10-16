const successResponse = (data, extra = {}) => {
  const payload = {
    success: true,
    status: 'success',
  };

  if (data !== undefined) {
    payload.data = data;
  }

  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined) {
      payload[key] = value;
    }
  });

  return payload;
};

const errorResponse = (message, extra = {}) => {
  const payload = {
    success: false,
    status: 'error',
    message,
    error: {
      message,
    },
  };

  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined) {
      payload[key] = value;
    }
  });

  return payload;
};

module.exports = {
  successResponse,
  errorResponse,
};
