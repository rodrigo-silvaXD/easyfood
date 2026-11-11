const express = require("express");
const controller = require("./review.controller");
const authenticate = require("../auth/auth.middleware");

const router = express.Router();

// Avaliar exige login: a nota fica ligada ao usuário do token
router.post("/restaurants/:restaurantId/reviews", authenticate, controller.rate);
router.get("/restaurants/:restaurantId/reviews/me", authenticate, controller.mine);

module.exports = router;
