const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const prisma = require("../../database/prisma");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
const SALT_ROUNDS = 10;

// Campos que podem sair do service. A senha (hash) nunca é exposta.
const publicUserFields = {
  id: true,
  name: true,
  email: true,
  createdAt: true
};

function gerarToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function register({ name, email, password }) {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), password: hash },
    select: publicUserFields
  });

  // Já devolve o token: quem acabou de se cadastrar entra direto no app.
  return { token: gerarToken(user), user };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (!user) {
    return null;
  }

  const senhaConfere = await bcrypt.compare(password, user.password);

  if (!senhaConfere) {
    return null;
  }

  return {
    token: gerarToken(user),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
    }
  };
}

async function findById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: publicUserFields
  });
}

async function countRestaurantsByUser(userId) {
  return prisma.restaurant.count({ where: { ownerId: userId } });
}

module.exports = {
  register,
  login,
  findById,
  countRestaurantsByUser
};
