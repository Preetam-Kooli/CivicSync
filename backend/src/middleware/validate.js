export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  // Replace the body with the cleaned data. Zod drops any fields we
  // didn't declare (so a sneaky "role" field never gets through).
  req.body = result.data;
  next();
};