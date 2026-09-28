function validate(schema, property = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[property]);
    if (!result.success) {
      return res.status(400).json({ error: 'invalid_request' });
    }
    req[property] = result.data;
    next();
  };
}

module.exports = { validate };
