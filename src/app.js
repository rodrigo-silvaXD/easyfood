const express = require("express");
const cors = require("cors");
const path = require("path");

const restaurantRoutes = require("./modules/restaurant/restaurant.routes");
const authRoutes = require("./modules/auth/auth.routes")
const dishRoutes = require("./modules/dishes/dish.routes");
const reviewRoutes = require("./modules/reviews/review.routes");

const app = express();

app.use(cors());
app.use(express.json());

// Sem corpo (ou sem Content-Type JSON) o Express 5 deixa req.body undefined;
// com um objeto vazio, os controllers respondem 400 em vez de quebrar com 500
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

app.use(express.static(path.join(__dirname, "../public")));

// Imagens otimizadas pelo image.service ficam acessíveis em /uploads/...
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));


app.use("/auth", authRoutes); 
app.use(dishRoutes);
app.use(reviewRoutes);
app.use("/restaurants", restaurantRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// Erros que escapam das rotas (ex.: JSON malformado) respondem em JSON, sem expor stack trace
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON inválido no corpo da requisição" });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Corpo da requisição muito grande" });
  }
  console.error("Erro não tratado:", error);
  res.status(500).json({ error: "Erro interno do servidor" });
});

module.exports = app;