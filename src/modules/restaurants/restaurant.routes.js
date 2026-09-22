const express = require("express");

const controller = require("./restaurant.controller");
const authenticate = require("../auth/auth.middleware");

const router = express.Router();

// Rotas públicas
router.get("/", controller.list);
router.get("/categories", controller.categories);

// Rotas protegidas por JWT
router.get("/mine", authenticate, controller.mine);
router.post("/", authenticate, controller.create);
router.delete("/:id", authenticate, controller.remove);

// Precisa ficar por último para não capturar /categories e /mine
router.get("/:id", controller.show);

module.exports = router;
