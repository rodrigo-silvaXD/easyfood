require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const restaurantes = [
  { name: "Pizzaria Napoli", category: "Pizza", rating: 4.8 },
  { name: "Burger House", category: "Burger", rating: 4.7 },
  { name: "Sushi Express", category: "Japonesa", rating: 4.9 },
  { name: "Cantina da Nona", category: "Italiana", rating: 4.6 },
  { name: "Taco Loco", category: "Mexicana", rating: 4.3 },
  { name: "Green Bowl", category: "Saudável", rating: 4.5 },
  { name: "Boteco do Zé", category: "Brasileira", rating: 4.4 },
  { name: "Padoca Central", category: "Padaria", rating: 4.2 },
  { name: "Wok & Roll", category: "Japonesa", rating: 4.1 },
  { name: "Forno de Minas", category: "Brasileira", rating: 4.7 }
];

async function main() {
  const existentes = await prisma.restaurant.count();

  if (existentes > 0) {
    console.log(`Banco já possui ${existentes} restaurante(s). Seed ignorado.`);
    return;
  }

  await prisma.restaurant.createMany({ data: restaurantes });

  console.log(`${restaurantes.length} restaurantes inseridos com sucesso!`);
}

main()
  .catch((error) => {
    console.error("Erro ao executar o seed:", error.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
