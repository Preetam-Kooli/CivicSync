// Unknown /api/... URLs
export function notFound(req, res) {
  res.status(404).json({ message: 'Not found' });
}

// Express identifies error handlers by having exactly 4 parameters
export function errorHandler(err, req, res, next) {
  // Malformed JSON in the request body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON in request body' });
  }

  // Errors we threw on purpose: safe to show
  if (err.isOperational) {
    return res.status(err.status).json({ message: err.message });
  }

  // Anything else is a bug. Log details for us, show nothing to the client.
  console.error('Unexpected error:', err);
  res.status(500).json({ message: 'Something went wrong' });
}