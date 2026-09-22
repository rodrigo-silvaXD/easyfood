const express = require("express");
const cors = require("cors");
const path = require("path");

const restaurantRoutes = require("./modules/restaurants/restaurant.routes");
const authRoutes = require("./modules/auth/auth.routes");

const app = express();

// Middlewares
app.use(cors({ exposedHeaders: ["X-Total-Count"] }));
app.use(express.json());

// Interface web (public/index.html)
app.use(express.static(path.join(__dirname, "../public")));

// Healthcheck — útil para saber se a API subiu antes de abrir o front
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "easyfood", timestamp: new Date().toISOString() });
});

// Rotas da aplicação
app.use("/auth", authRoutes);
app.use("/restaurants", restaurantRoutes);

// 404 para rotas de API que não existem
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// Tratador de erros: último middleware da cadeia
app.use((error, req, res, next) => {
  console.error("Erro não tratado:", error);
  res.status(500).json({ error: "Erro interno do servidor" });
});

module.exports = app;
