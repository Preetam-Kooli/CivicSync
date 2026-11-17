// Unknown /api/... URLs
export function notFound(req, res) {
  res.status(404).json({ message: 'Not found' });
}

// Express identifies error handlers by having exactly 4 parameters
export function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON in request body' });
  }

  // Upload problems (file too large, too many files...)
  if (err.name === 'MulterError') {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res
      .status(tooBig ? 413 : 400)
      .json({ message: tooBig ? 'Photo is too large (maximum 5 MB)' : 'Invalid upload' });
  }

  if (err.isOperational) {
    return res.status(err.status).json({ message: err.message });
  }

  console.error('Unexpected error:', err);
  res.status(500).json({ message: 'Something went wrong' });
}