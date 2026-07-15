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

// Enable/disable the login or change its role
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json();

  const staff = await prisma.staff.findUnique({ where: { id }, include: { user: true } });
  if (!staff?.user) return NextResponse.json({ error: "This staff member has no login" }, { status: 404 });

  // Never allow removing or disabling the last active admin
  const removesAdmin =
    staff.user.role === "ADMIN" && (body.role === "STAFF" || body.isActive === false);
  if (removesAdmin) {
    const otherAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true, id: { not: staff.user.id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json({ error: "Cannot remove the last admin account" }, { status: 400 });
    }
  }

  const data: { role?: "ADMIN" | "STAFF"; isActive?: boolean } = {};
  if (body.role === "ADMIN" || body.role === "STAFF") data.role = body.role;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  const user = await prisma.user.update({ where: { id: staff.user.id }, data });

  // Disabling kicks them out of any open session immediately
  if (body.isActive === false) {
    await prisma.session.deleteMany({ where: { userId: staff.user.id } });
  }

  return NextResponse.json({ ok: true, role: user.role, isActive: user.isActive });
}
