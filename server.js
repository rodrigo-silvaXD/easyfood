require("dotenv").config();

const app = require("./src/app");

const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET não definido. Copie .env.example para .env antes de iniciar.");
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`EasyFood rodando na porta ${PORT}`);
  console.log(`Interface: http://localhost:${PORT}`);
});
