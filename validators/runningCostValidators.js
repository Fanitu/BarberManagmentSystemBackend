const { body } = require("express-validator");

const createRunningCostValidator = [
  body("name").trim().notEmpty().withMessage("name is required").isLength({ max: 100 }),
  body("price")
    .notEmpty()
    .withMessage("price is required")
    .isFloat({ min: 0 })
    .withMessage("price must be a non-negative number"),
];

module.exports = { createRunningCostValidator };