const { body } = require("express-validator");
const { mongoIdParam } = require("./common");

const createMonthlyExpenseValidator = [
  body("name").trim().notEmpty().withMessage("name is required").isLength({ max: 100 }),
  body("price")
    .notEmpty()
    .withMessage("price is required")
    .isFloat({ min: 0 })
    .withMessage("price must be a non-negative number"),
  body("month")
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage("month must be a valid date"),
];

// updateMonthlyExpense only ever reads name/price off the body (it forks a
// new version rather than accepting arbitrary fields) — validate exactly that.
const updateMonthlyExpenseValidator = [
  mongoIdParam(),
  body("name").optional().trim().isLength({ min: 1, max: 100 }),
  body("price").optional().isFloat({ min: 0 }).withMessage("price must be a non-negative number"),
  body().custom((value) => {
    if (value.name == null && value.price == null) {
      throw new Error("name or price is required");
    }
    return true;
  }),
];

const monthlyExpenseIdParamValidator = [mongoIdParam()];

module.exports = {
  createMonthlyExpenseValidator,
  updateMonthlyExpenseValidator,
  monthlyExpenseIdParamValidator,
};