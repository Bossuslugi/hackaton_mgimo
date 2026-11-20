import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { HttpError, json, parseBody, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { createBookingSchema } from '@/lib/validation';
import { serializeBooking } from '@/lib/serializers';
import {
  BOOKING_HORIZON_DAYS,
  MAX_ACTIVE_BOOKINGS,
  ROOMS_CATALOG,
  TIME_SLOTS,
  isSlotUpcoming,
  moscowDate,
  slotKey,
} from '@/lib/domain';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/bookings[?date=YYYY-MM-DD]
 * myBookings — свои брони; allBookingsToday — все активные брони на сегодня (чужие обезличены);
 * roomsCatalog — каталог с сеткой свободных слотов на выбранную дату.
 */
export const GET = route(async (req) => {
  const session = await requireSession();
  const today = moscowDate(0);
  const dateParam = new URL(req.url).searchParams.get('date');
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : today;

  const [mine, todayAll, onDate] = await Promise.all([
    prisma.roomBooking.findMany({ where: { userId: session.userId }, orderBy: [{ date: 'desc' }, { timeSlot: 'asc' }] }),
    prisma.roomBooking.findMany({ where: { date: today, status: 'CONFIRMED' }, orderBy: { timeSlot: 'asc' } }),
    date === today
      ? Promise.resolve(null)
      : prisma.roomBooking.findMany({ where: { date, status: 'CONFIRMED' } }),
  ]);
  const busy = new Set((onDate ?? todayAll).map((b) => slotKey(b.roomName, b.date, b.timeSlot)));

  const roomsCatalog = ROOMS_CATALOG.map((room) => ({
    ...room,
    slots: TIME_SLOTS.map((timeSlot) => {
      const taken = busy.has(slotKey(room.roomName, date, timeSlot));
      return { timeSlot, available: !taken && isSlotUpcoming(date, timeSlot), taken };
    }),
  }));

  return json({
    date,
    today,
    timeSlots: TIME_SLOTS,
    myBookings: mine.map((b) => serializeBooking(b, session.userId)),
    allBookingsToday: todayAll.map((b) => serializeBooking(b, session.userId)),
    roomsCatalog,
  });
});

/** POST /api/bookings — бронь от session.userId; занятый слот → 409. */
export const POST = route(async (req) => {
  const session = await requireSession();
  const body = await parseBody(req, createBookingSchema);

  const room = ROOMS_CATALOG.find((r) => r.roomName === body.roomName);
  if (!room) throw new HttpError(400, `Помещение «${body.roomName}» не найдено в каталоге`);
  if (!(TIME_SLOTS as readonly string[]).includes(body.timeSlot)) {
    throw new HttpError(400, `Слот: одно из ${TIME_SLOTS.join(', ')}`);
  }
  const today = moscowDate(0);
  if (body.date < today || body.date > moscowDate(BOOKING_HORIZON_DAYS)) {
    throw new HttpError(400, `Бронировать можно на сегодня и до ${BOOKING_HORIZON_DAYS} дней вперёд`);
  }
  if (!isSlotUpcoming(body.date, body.timeSlot)) {
    throw new HttpError(409, 'Этот слот уже начался или прошёл — выберите более позднее время');
  }
  if (body.participantsCount > room.capacity) {
    throw new HttpError(400, `В «${room.roomName}» не больше ${room.capacity} участников`);
  }

  const key = slotKey(room.roomName, body.date, body.timeSlot);
  const busyMsg = `Помещение «${room.roomName}» уже занято ${formatDate(body.date)} в слот ${body.timeSlot}. Выберите другое время или помещение.`;

  const taken = await prisma.roomBooking.findUnique({ where: { activeSlotKey: key } });
  if (taken) throw new HttpError(409, busyMsg);

  const active = await prisma.roomBooking.findMany({
    where: { userId: session.userId, status: 'CONFIRMED', date: { gte: today } },
  });
  if (active.filter((b) => isSlotUpcoming(b.date, b.timeSlot)).length >= MAX_ACTIVE_BOOKINGS) {
    throw new HttpError(409, `У вас уже ${MAX_ACTIVE_BOOKINGS} активные брони — отмените одну, чтобы создать новую`);
  }

  try {
    const booking = await prisma.roomBooking.create({
      data: {
        userId: session.userId, // владелец — только из сессии
        roomName: room.roomName,
        building: room.building, // корпус — из каталога, а не из тела запроса
        date: body.date,
        timeSlot: body.timeSlot,
        purpose: body.purpose,
        participantsCount: body.participantsCount,
        status: 'CONFIRMED',
        activeSlotKey: key,
      },
    });
    return json({ booking: serializeBooking(booking, session.userId) }, 201);
  } catch (e) {
    // Гонка: параллельный запрос успел занять слот — уникальный индекс activeSlotKey.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new HttpError(409, busyMsg);
    throw e;
  }
});

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
