const { body } = require("express-validator");
const { mongoIdParam } = require("./common");

const createShopValidator = [
  body("name").trim().notEmpty().withMessage("name is required").isLength({ max: 100 }),
  body("ownerName").optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body("ownerPhone").optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
];

const shopIdParamValidator = [mongoIdParam()];

const createShopAdminValidator = [
  mongoIdParam(),
  body("name").trim().notEmpty().withMessage("name is required").isLength({ max: 100 }),
  body("password")
    .notEmpty()
    .withMessage("password is required")
    .isLength({ min: 6 })
    .withMessage("password must be at least 6 characters"),
];

module.exports = { createShopValidator, shopIdParamValidator, createShopAdminValidator };