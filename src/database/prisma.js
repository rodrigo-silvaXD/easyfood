const { PrismaClient } = require("@prisma/client");

// Camada Database: única responsabilidade é disponibilizar a conexão
// com o banco para o restante da aplicação. Nenhuma regra de negócio aqui.
const prisma = new PrismaClient();

module.exports = prisma;
