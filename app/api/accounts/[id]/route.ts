import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";

async function lastAdminGuard(targetId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { error: "Account not found", status: 404 };
  if (target.role === "ADMIN" && target.isActive) {
    const others = await prisma.user.count({
      where: { role: "ADMIN", isActive: true, id: { not: targetId } },
    });
    if (others === 0) return { error: "Cannot remove the last admin account", status: 400 };
  }
  return null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  const body = await req.json();

  const demoting = body.role === "STAFF" || body.isActive === false;

  if (id === me.id && demoting) {
    return NextResponse.json({ error: "You cannot disable or demote your own account" }, { status: 400 });
  }
  if (demoting) {
    const guard = await lastAdminGuard(id);
    if (guard) return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const data: Record<string, unknown> = {};
  if (body.role === "ADMIN" || body.role === "STAFF") data.role = body.role;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.name) data.name = body.name;
  if (body.email) data.email = body.email;
  if (body.password) {
    if (body.password.length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
    }
    data.passwordHash = await hashPassword(body.password);
  }

  try {
    const user = await prisma.user.update({ where: { id }, data });
    if (body.isActive === false) {
      await prisma.session.deleteMany({ where: { userId: id } });
    }
    return NextResponse.json({ ok: true, role: user.role, isActive: user.isActive });
  } catch (e: unknown) {
    if (typeof e === "object" && e && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "This email is already used by another account" }, { status: 400 });
    }
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;

  if (id === me.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }
  const guard = await lastAdminGuard(id);
  if (guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  // Unlink any staff profile, then remove the account (sessions cascade)
  await prisma.staff.updateMany({ where: { userId: id }, data: { userId: null } });
  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
