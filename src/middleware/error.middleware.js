const { errorResponse } = require('../utils/apiResponse');

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

const createHttpError = (statusCode, message) => new HttpError(statusCode, message);

const normalizeError = (error) => {
  if (error instanceof HttpError) {
    return error;
  }

  if (error && error.name === 'TokenExpiredError') {
    return createHttpError(401, 'Token expired');
  }

  if (error && typeof error.code === 'string') {
    const code = error.code;

    if (code === '23505') {
      return createHttpError(409, 'Duplicate data');
    }

    if (code === '23502' || code === '23503') {
      return createHttpError(400, 'Invalid data');
    }

    if (code.startsWith('23')) {
      return createHttpError(400, 'Invalid data');
    }

    return createHttpError(500, 'Internal server error');
  }

  if (error && Number.isInteger(error.statusCode) && error.statusCode >= 400) {
    return new HttpError(error.statusCode, error.message || 'Request failed');
  }

  return createHttpError(500, 'Internal server error');
};

const notFoundHandler = (req, res, next) => {
  next(createHttpError(404, 'Route not found'));
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const normalizedError = normalizeError(error);
  const statusCode = normalizedError.statusCode || 500;
  const safeMessage = statusCode >= 500 ? 'Internal server error' : normalizedError.message;

  return res.status(statusCode).json(errorResponse(safeMessage, { status: 'error' }));
};

module.exports = {
  HttpError,
  createHttpError,
  normalizeError,
  notFoundHandler,
  errorHandler,
};
