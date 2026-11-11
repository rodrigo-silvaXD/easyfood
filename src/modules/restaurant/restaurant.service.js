const prisma = require("../../database/prisma");
const emailService = require("../shared/email.service");
const activityService = require("../shared/activity.service");
const imageService = require("../shared/image.service");
const validate = require("../shared/validation");

// Para quem o comercial recebe os avisos (no futuro, virá do .env ou do banco)
const COMERCIAL_EMAIL = "felipe.oliveira@pro.fecaf.com.br";

async function listRestaurants() {
  const restaurants = await prisma.restaurant.findMany({
    include: { _count: { select: { reviews: true } } },
    orderBy: { id: "asc" }
  });

  return restaurants.map(({ _count, ...restaurant }) => ({ ...restaurant, reviewsCount: _count.reviews }));
}

async function createRestaurant(data, user) {
  // O mesmo dono não pode ter dois restaurantes com o mesmo nome
  const duplicate = await prisma.restaurant.findFirst({
    where: { ownerId: user.id, name: { equals: data.name, mode: "insensitive" } }
  });
  if (duplicate) {
    const error = new Error("Você já tem um restaurante com esse nome");
    error.statusCode = 409;
    throw error;
  }

  // 1) O que realmente importa: cadastrar o restaurante
  const restaurant = await prisma.restaurant.create({
    data: {
      name: data.name,
      category: data.category,
      rating: 0, // a nota nasce zerada e vem das avaliações dos clientes (ADR-004)
      ownerId: user.id // ⬅️ grava o dono (quem está logado, vindo do token)
    }
  });

  // 2) Ações secundárias — cada uma isolada por try/catch.
  //    Se qualquer uma falhar, o cadastro NÃO é afetado.

  // E-mail de boas-vindas (usa o serviço genérico)
  try {
    await emailService.sendEmail({
      to: user.email, // e-mail de quem cadastrou (vindo do token)
      toName: restaurant.name,
      subject: `Bem-vindo à EasyFood, ${restaurant.name}!`,
      header: `Olá, ${restaurant.name}!`,
      body: `Seu restaurante <strong>${restaurant.name}</strong> foi cadastrado com sucesso na EasyFood. Categoria: ${restaurant.category}.`,
      footer: "Equipe EasyFood"
    });
  } catch (error) {
    console.error("Erro ao enviar e-mail de boas-vindas:", error.message);
  }

  // Registro da atividade
  try {
    await activityService.log("RESTAURANT_CREATED", `Restaurante: ${restaurant.name}`);
  } catch (error) {
    console.error("Erro ao registrar atividade:", error.message);
  }

  // Alerta para o comercial (MESMA função genérica, outro conteúdo)
  try {
    await emailService.sendEmail({
      to: COMERCIAL_EMAIL,
      toName: "Comercial EasyFood",
      subject: `Novo restaurante cadastrado: ${restaurant.name}`,
      header: "Novo restaurante na plataforma",
      body: `Nome: ${restaurant.name}<br/>Categoria: ${restaurant.category}<br/>Avaliação: ${restaurant.rating}`,
      footer: "Notificação automática — EasyFood"
    });
  } catch (error) {
    console.error("Erro ao notificar o comercial:", error.message);
  }

  // 3) O restaurante volta independente do resultado das ações acima
  return { ...restaurant, reviewsCount: 0 };

  // --- Envio de sms função 
}


// --------createrestaurant.event

// Só o dono gerencia a capa: 404 se o restaurante não existe, 403 se não for dele
async function getOwnedRestaurant(restaurantId, userId) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: validate.id(restaurantId) } });

  if (!restaurant) {
    const error = new Error("Restaurante não encontrado");
    error.statusCode = 404;
    throw error;
  }
  if (restaurant.ownerId !== userId) {
    const error = new Error("Você não tem permissão para gerenciar este restaurante");
    error.statusCode = 403;
    throw error;
  }

  return restaurant;
}

async function updateRestaurantImage(restaurantId, buffer, userId) {
  const restaurant = await getOwnedRestaurant(restaurantId, userId);

  return imageService.replaceImage(
    buffer,
    { folder: "restaurants", width: 1200, height: 600 },
    restaurant.imageUrl,
    (imageUrl) => prisma.restaurant.update({ where: { id: restaurant.id }, data: { imageUrl } })
  );
}

async function removeRestaurantImage(restaurantId, userId) {
  const restaurant = await getOwnedRestaurant(restaurantId, userId);

  return imageService.clearImage(restaurant.imageUrl, () =>
    prisma.restaurant.update({ where: { id: restaurant.id }, data: { imageUrl: null } })
  );
}

module.exports = {
  listRestaurants,
  createRestaurant,
  updateRestaurantImage,
  removeRestaurantImage
};