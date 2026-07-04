import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Admin user
  const hash = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@salon.com" },
    update: {},
    create: { email: "admin@salon.com", name: "Admin", passwordHash: hash, role: "ADMIN" },
  });

  // Staff
  const staffData = [
    { name: "Maria", color: "#ec4899" },
    { name: "Sara", color: "#8b5cf6" },
    { name: "Lara", color: "#06b6d4" },
    { name: "Nour", color: "#10b981" },
  ];
  for (const s of staffData) {
    await prisma.staff.upsert({
      where: { id: s.name.toLowerCase() },
      update: {},
      create: { id: s.name.toLowerCase(), ...s },
    });
  }

  // Services
  const services = [
    { name: "Classic Manicure", category: "mani", duration: 45 },
    { name: "Gel Manicure", category: "mani", duration: 60 },
    { name: "Classic Pedicure", category: "pedi", duration: 60 },
    { name: "Spa Pedicure", category: "pedi", duration: 75 },
    { name: "Basic Facial", category: "facial", duration: 60 },
    { name: "Deep Cleanse Facial", category: "facial", duration: 90 },
    { name: "Body Slimming Session", category: "slimming", duration: 60 },
    { name: "Laser Hair Removal", category: "laser", duration: 30 },
  ];
  for (const s of services) {
    await prisma.service.create({ data: s }).catch(() => {});
  }

  // Default settings
  const defaults = [
    { key: "salon_name", value: "Beauty Salon" },
    { key: "staff_selection_enabled", value: "true" },
    { key: "whatsapp_ai_enabled", value: "true" },
    { key: "cancellation_open", value: "true" },
  ];
  for (const d of defaults) {
    await prisma.setting.upsert({ where: { key: d.key }, update: {}, create: d });
  }

  console.log("✅ Seed complete — admin@salon.com / admin123");
}

main().finally(() => prisma.$disconnect());
