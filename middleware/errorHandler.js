const notFound = (req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error(err);

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      message: "Duplicate value",
      field: Object.keys(err.keyPattern || {}),
    });
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: Object.values(err.errors)
        .map((e) => e.message)
        .join(", "),
    });
  }

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({ message: err.message || "Server error" });
};

module.exports = { notFound, errorHandler };
