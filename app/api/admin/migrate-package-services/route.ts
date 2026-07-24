import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// One-off: create the Package↔Service join table and backfill every existing
// package's current service into it. Safe to run more than once.
async function migrate() {

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_PackageServices" (
      "A" TEXT NOT NULL,
      "B" TEXT NOT NULL
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "_PackageServices_AB_unique" ON "_PackageServices"("A", "B");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "_PackageServices_B_index" ON "_PackageServices"("B");
  `);

  // Foreign keys — added separately so a re-run doesn't fail on duplicates
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "_PackageServices"
        ADD CONSTRAINT "_PackageServices_A_fkey"
        FOREIGN KEY ("A") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "_PackageServices"
        ADD CONSTRAINT "_PackageServices_B_fkey"
        FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // Backfill: every package covers at least the service it was created with
  const backfilled = await prisma.$executeRawUnsafe(`
    INSERT INTO "_PackageServices" ("A", "B")
    SELECT p."id", p."serviceId" FROM "Package" p
    ON CONFLICT DO NOTHING;
  `);

  const total = await prisma.package.count();
  return NextResponse.json({ ok: true, packages: total, backfilled });
}

// GET as well as POST so it can be run by opening the URL while logged in
export async function GET() {
  await requireAdmin();
  return migrate();
}

export async function POST() {
  await requireAdmin();
  return migrate();
}
