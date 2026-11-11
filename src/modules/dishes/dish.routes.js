const express = require("express");
const router = express.Router();

const controller = require("./dish.controller");
const authenticate = require("../auth/auth.middleware");
const { uploadImage } = require("../shared/upload.middleware");

router.post("/restaurants/:restaurantId/dishes", authenticate, controller.create);

router.get("/restaurants/:restaurantId/dishes", controller.list);

router.get("/dishes/:dishId", controller.getById);

router.put("/dishes/:dishId", authenticate, controller.update);

router.delete("/dishes/:dishId", authenticate, controller.remove);

router.post("/dishes/:dishId/image", authenticate, uploadImage("image"), controller.uploadImage);
router.delete("/dishes/:dishId/image", authenticate, controller.removeImage);

module.exports = router;