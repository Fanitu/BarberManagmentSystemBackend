const { validationResult } = require("express-validator");

// Drop this after any validator chain (an array from validators/*.js) —
// it inspects what those validators found and stops the request with a
// 400 if anything failed, instead of letting bad data reach a controller.
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = { handleValidationErrors };
