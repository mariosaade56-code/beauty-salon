import { prisma } from "./db";
import { addMinutes, format, isWithinInterval, parseISO, setHours, setMinutes } from "date-fns";

export const SALON_HOURS = { open: 9, close: 18 }; // 9am–6pm
export const SLOT_INTERVAL = 30; // minutes

export async function getAvailableSlots(
  date: Date,
  serviceId: string,
  staffId?: string
): Promise<{ time: string; staffId: string; staffName: string }[]> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return [];

  // Check salon closure
  const dayOff = await prisma.dayOff.findFirst({
    where: {
      date: {
        gte: new Date(date.toDateString()),
        lt: new Date(new Date(date.toDateString()).getTime() + 86400000),
      },
      allStaff: true,
    },
  });
  if (dayOff) return [];

  // Get settings for staff selection mode
  const staffSelectionSetting = await prisma.setting.findUnique({
    where: { key: "staff_selection_enabled" },
  });
  const staffSelectionEnabled = staffSelectionSetting?.value !== "false";

  // Get applicable staff
  const staffList = await prisma.staff.findMany({
    where: {
      isActive: true,
      ...(staffId ? { id: staffId } : {}),
    },
  });

  const dayStart = setHours(setMinutes(new Date(date), 0), SALON_HOURS.open);
  const dayEnd = setHours(setMinutes(new Date(date), 0), SALON_HOURS.close);

  const results: { time: string; staffId: string; staffName: string }[] = [];

  for (const staff of staffList) {
    // Check staff day off
    const staffDayOff = await prisma.dayOff.findFirst({
      where: {
        staffId: staff.id,
        date: {
          gte: new Date(date.toDateString()),
          lt: new Date(new Date(date.toDateString()).getTime() + 86400000),
        },
      },
    });
    if (staffDayOff) continue;

    // Get existing appointments for this staff on this day
    const appointments = await prisma.appointment.findMany({
      where: {
        staffId: staff.id,
        status: { notIn: ["CANCELLED"] },
        startTime: {
          gte: new Date(date.toDateString()),
          lt: new Date(new Date(date.toDateString()).getTime() + 86400000),
        },
      },
    });

    // Get breaks for this staff on this day
    const breaks = await prisma.break.findMany({
      where: {
        staffId: staff.id,
        OR: [
          { dayOfWeek: date.getDay() },
          {
            startTime: {
              gte: new Date(date.toDateString()),
              lt: new Date(new Date(date.toDateString()).getTime() + 86400000),
            },
          },
        ],
      },
    });

    // Generate slots
    let current = new Date(dayStart);
    while (addMinutes(current, service.duration) <= dayEnd) {
      const slotEnd = addMinutes(current, service.duration);
      const slotStr = format(current, "HH:mm");

      const blocked =
        appointments.some(
          (a) =>
            current < a.endTime && slotEnd > a.startTime
        ) ||
        breaks.some((b) => {
          const breakStart = b.dayOfWeek
            ? setHours(setMinutes(new Date(date), b.startTime.getMinutes()), b.startTime.getHours())
            : b.startTime;
          const breakEnd = b.dayOfWeek
            ? setHours(setMinutes(new Date(date), b.endTime.getMinutes()), b.endTime.getHours())
            : b.endTime;
          return current < breakEnd && slotEnd > breakStart;
        });

      if (!blocked) {
        // Avoid duplicates when not filtering by staff
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

  return results.sort((a: { time: string }, b: { time: string }) => a.time.localeCompare(b.time));
}
