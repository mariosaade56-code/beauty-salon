import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// One-time setup: create the PendingWork table ("Still to do" items).
// Admin only, no user input, idempotent — safe to call twice. This route
// is removed again once the table exists.
export async function POST() {
  await requireAdmin();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PendingWork" (
      "id" TEXT NOT NULL,
      "clientId" TEXT NOT NULL,
      "appointmentId" TEXT,
      "fromService" TEXT,
      "description" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "doneAt" TIMESTAMP(3),
      CONSTRAINT "PendingWork_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PendingWork_clientId_idx" ON "PendingWork"("clientId");
  `);

  // Cascade deletes with the client; ignore if the constraint already exists
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "PendingWork"
        ADD CONSTRAINT "PendingWork_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "Client"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  const count = await prisma.pendingWork.count();
  return NextResponse.json({ ok: true, table: "PendingWork", existingRows: count });
}
