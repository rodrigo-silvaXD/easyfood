const express = require("express");
const controller = require("./restaurant.controller");
const authenticate = require("../auth/auth.middleware");
const { uploadImage } = require("../shared/upload.middleware");

const router = express.Router();

router.get("/", controller.list);
router.post("/", authenticate, controller.create);

// Capa do restaurante (só o dono)
router.post("/:restaurantId/image", authenticate, uploadImage("image"), controller.uploadImage);
router.delete("/:restaurantId/image", authenticate, controller.removeImage);

module.exports = router;