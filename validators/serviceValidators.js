const { body } = require("express-validator");
const { mongoIdParam } = require("./common");

const createServiceValidator = [
  body("name").trim().notEmpty().withMessage("name is required").isLength({ max: 100 }),
  body("price")
    .notEmpty()
    .withMessage("price is required")
    .isFloat({ min: 0 })
    .withMessage("price must be a non-negative number"),
  body("shopPercent")
    .notEmpty()
    .withMessage("shopPercent is required")
    .isFloat({ min: 0, max: 100 })
    .withMessage("shopPercent must be between 0 and 100"),
];

const updateServiceValidator = [
  mongoIdParam(),
  body("name").optional().trim().isLength({ min: 1, max: 100 }),
  body("price").optional().isFloat({ min: 0 }).withMessage("price must be a non-negative number"),
  body("shopPercent")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("shopPercent must be between 0 and 100"),
  body("isActive").optional().isBoolean(),
];

const serviceIdParamValidator = [mongoIdParam()];

const submitServiceLogValidator = [
  body("barberId").isMongoId().withMessage("a valid barberId is required"),
  body("serviceId").isMongoId().withMessage("a valid serviceId is required"),
  body("price")
    .notEmpty()
    .withMessage("price is required")
    .isFloat({ min: 0 })
    .withMessage("price must be a non-negative number"),
];

const updateServiceLogValidator = [
  mongoIdParam(),
  body("barberId").isMongoId().withMessage("a valid barberId is required"),
  body("serviceId").isMongoId().withMessage("a valid serviceId is required"),
  body("price")
    .notEmpty()
    .withMessage("price is required")
    .isFloat({ min: 0 })
    .withMessage("price must be a non-negative number"),
];

module.exports = {
  createServiceValidator,
  updateServiceValidator,
  serviceIdParamValidator,
  submitServiceLogValidator,
  updateServiceLogValidator,
};
