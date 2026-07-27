import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// Every visit this client has had, newest first, with enough detail for the
// client file to filter them by service type.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const appointments = await prisma.appointment.findMany({
    where: { clientId: id },
    select: {
      id: true,
      startTime: true,
      status: true,
      paymentStatus: true,
      amountPaid: true,
      notes: true,
      clientPackageId: true,
      service: { select: { name: true, category: true, price: true } },
      staff: { select: { name: true } },
    },
    orderBy: { startTime: "desc" },
  });
  return NextResponse.json(appointments);
}
