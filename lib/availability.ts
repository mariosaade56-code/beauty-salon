import { prisma } from "./db";
import { addMinutes } from "date-fns";
import { beirutToUtc, beirutDayRange, beirutHHmm, beirutDateStr } from "./timezone";

export const SALON_HOURS = { open: 9, close: 18 }; // 9am–6pm Beirut time
export const SLOT_INTERVAL = 30; // minutes

export async function getAvailableSlots(
  dateInput: Date | string,
  serviceIdOrIds: string | string[],
  staffId?: string
): Promise<{ time: string; staffId: string; staffName: string }[]> {
  // Normalize to a Beirut calendar date, however the caller passed it
  const dateStr = typeof dateInput === "string" ? dateInput.slice(0, 10) : beirutDateStr(dateInput);

  // Multiple services are booked back-to-back: the slot must fit the total duration
  const ids = Array.isArray(serviceIdOrIds) ? serviceIdOrIds : [serviceIdOrIds];
  const servicesFound = await prisma.service.findMany({ where: { id: { in: ids } } });
  if (servicesFound.length !== ids.length || ids.length === 0) return [];
  const totalDuration = servicesFound.reduce((sum, s) => sum + s.duration, 0);

  // The appointment window for this Beirut day, as real UTC instants
  const dayRange = beirutDayRange(dateStr);
  // DayOff.date is a date-only column (stored at UTC midnight)
  const dateOnlyStart = new Date(`${dateStr}T00:00:00Z`);
  const dateOnly = { gte: dateOnlyStart, lt: new Date(dateOnlyStart.getTime() + 86400000) };
  const weekday = dateOnlyStart.getUTCDay();

  // Salon-wide closure
  const dayOff = await prisma.dayOff.findFirst({
    where: { date: dateOnly, allStaff: true },
  });
  if (dayOff) return [];

  const staffSelectionSetting = await prisma.setting.findUnique({
    where: { key: "staff_selection_enabled" },
  });
  const staffSelectionEnabled = staffSelectionSetting?.value === "true";

  const staffList = await prisma.staff.findMany({
    where: {
      isActive: true,
      ...(staffId ? { id: staffId } : {}),
    },
  });

  const dayStart = beirutToUtc(`${dateStr}T${String(SALON_HOURS.open).padStart(2, "0")}:00:00`);
  const dayEnd = beirutToUtc(`${dateStr}T${String(SALON_HOURS.close).padStart(2, "0")}:00:00`);

  const results: { time: string; staffId: string; staffName: string }[] = [];

  for (const staff of staffList) {
    const staffDayOff = await prisma.dayOff.findFirst({
      where: { staffId: staff.id, date: dateOnly },
    });
    if (staffDayOff) continue;

    const appointments = await prisma.appointment.findMany({
      where: {
        staffId: staff.id,
        status: { notIn: ["CANCELLED"] },
        startTime: dayRange,
      },
    });

    const breaks = await prisma.break.findMany({
      where: {
        staffId: staff.id,
        OR: [
          { dayOfWeek: weekday },
          { startTime: dayRange },
        ],
      },
    });

    let current = new Date(dayStart);
    while (addMinutes(current, totalDuration) <= dayEnd) {
      const slotEnd = addMinutes(current, totalDuration);
      const slotStr = beirutHHmm(current);

      const blocked =
        appointments.some((a) => current < a.endTime && slotEnd > a.startTime) ||
        breaks.some((b) => {
          // Recurring breaks store a time of day; project it onto this Beirut day
          const breakStart = b.dayOfWeek != null
            ? beirutToUtc(`${dateStr}T${beirutHHmm(b.startTime)}:00`)
            : b.startTime;
          const breakEnd = b.dayOfWeek != null
            ? beirutToUtc(`${dateStr}T${beirutHHmm(b.endTime)}:00`)
            : b.endTime;
          return current < breakEnd && slotEnd > breakStart;
        });

      if (!blocked) {
        if (!staffSelectionEnabled || !staffId) {
          if (!results.find((r) => r.time === slotStr)) {
            results.push({ time: slotStr, staffId: staff.id, staffName: staff.name });
          }
        } else {
          results.push({ time: slotStr, staffId: staff.id, staffName: staff.name });
        }
      }

      current = addMinutes(current, SLOT_INTERVAL);
    }
  }

  return results.sort((a, b) => a.time.localeCompare(b.time));
}
