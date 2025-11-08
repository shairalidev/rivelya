export const notFound = (req, res, next) => next({ status: 404, message: 'Route not found' });

export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const payload = {
    message: err.message || 'Internal server error'
  };
  if (process.env.NODE_ENV !== 'production' && err.stack) payload.stack = err.stack;
  res.status(status).json(payload);
};
