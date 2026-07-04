import { prisma } from "./db";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const session = await prisma.session.create({
    data: { userId, expiresAt },
  });
  return session.token;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { staffProfile: true } } },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function requireAdmin() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAuth() {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  return user;
}
