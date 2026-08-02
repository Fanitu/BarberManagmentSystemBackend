const { mongoIdParam } = require("./common");

const payBarberValidator = [mongoIdParam("barberId")];

module.exports = { payBarberValidator };