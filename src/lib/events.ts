import type { CampusEvent, EventRegistration, SportSection } from '@prisma/client';

export const EVENT_CATEGORIES = ['Хакатон', 'Митап', 'Карьера', 'Наука', 'Клубы'] as const;
export const SPORT_TYPES = ['Плавание', 'Скалолазание', 'Футбол', 'Баскетбол', 'Настольный теннис', 'Тренажёрный зал', 'Киберспорт'] as const;

/** Публичная карточка события + персональное состояние зрителя (билет — только свой). */
export function serializeEvent(e: CampusEvent, mine: EventRegistration | null | undefined, today: string) {
  return {
    id: e.id,
    title: e.title,
    category: e.category,
    description: e.description,
    date: e.date,
    timeRange: e.timeRange,
    location: e.location,
    organizer: e.organizer,
    capacity: e.capacity,
    registeredCount: e.registeredCount,
    spotsLeft: Math.max(0, e.capacity - e.registeredCount),
    tags: e.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    isPast: e.date < today,
    isRegistered: !!mine,
    ticketCode: mine?.ticketCode ?? null,
    registeredAt: mine?.createdAt.toISOString() ?? null,
  };
}

export function serializeSection(s: SportSection, currentSectionId: string | null) {
  return {
    id: s.id,
    sportType: s.sportType,
    title: s.title,
    coachName: s.coachName,
    campusLocation: s.campusLocation,
    scheduleText: s.scheduleText,
    capacity: s.capacity,
    enrolledCount: s.enrolledCount,
    spotsLeft: Math.max(0, s.capacity - s.enrolledCount),
    isCurrent: s.id === currentSectionId,
  };
}
