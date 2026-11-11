const express = require("express");
const cors = require("cors");
const path = require("path");

const restaurantRoutes = require("./modules/restaurant/restaurant.routes");
const authRoutes = require("./modules/auth/auth.routes")
const dishRoutes = require("./modules/dishes/dish.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));

// Imagens otimizadas pelo image.service ficam acessíveis em /uploads/...
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));


app.use("/auth", authRoutes); 
app.use(dishRoutes);
app.use("/restaurants", restaurantRoutes);
    


module.exports = app;