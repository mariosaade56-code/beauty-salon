import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";

// Create or update a login account for a staff member
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
  }

  const staff = await prisma.staff.findUnique({ where: { id }, include: { user: true } });
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const passwordHash = await hashPassword(password);

  try {
    if (staff.user) {
      await prisma.user.update({
        where: { id: staff.user.id },
        data: { email, passwordHash },
      });
    } else {
      const user = await prisma.user.create({
        data: { name: staff.name, email, passwordHash, role: "STAFF" },
      });
      await prisma.staff.update({ where: { id }, data: { userId: user.id } });
    }
  } catch (e: unknown) {
    if (typeof e === "object" && e && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "This email is already used by another account" }, { status: 400 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
