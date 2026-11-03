const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
export const SQLITE_DB_PATH = path.resolve(currentDirPath, '../../prisma/dev.db');

const db = new DatabaseSync(SQLITE_DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

// Initialize SQLite schema matching backend/prisma/schema.prisma
db.exec(`
  CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS "UserPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "interests" TEXT NOT NULL,
    "travelStyle" TEXT NOT NULL DEFAULT 'balanced',
    "budgetPreference" TEXT NOT NULL DEFAULT 'medium',
    "transportPreference" TEXT NOT NULL DEFAULT 'cab',
    "idealExperience" TEXT,
    "updatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "Destination" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "destinationKey" TEXT NOT NULL DEFAULT 'delhi',
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'India',
    "description" TEXT NOT NULL,
    "historicalSignificance" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "interestTags" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "averageVisitDuration" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageSource" TEXT,
    "officialSource" TEXT,
    "googlePlaceId" TEXT,
    "openingHours" TEXT NOT NULL DEFAULT '09:00 - 17:30',
    "entryFeeINR" INTEGER NOT NULL DEFAULT 0,
    "highlights" TEXT NOT NULL DEFAULT '[]',
    "isMustVisit" INTEGER NOT NULL DEFAULT 0,
    "bestTimeOfDay" TEXT DEFAULT 'morning',
    "area" TEXT NOT NULL DEFAULT 'Central',
    "isMealStop" INTEGER NOT NULL DEFAULT 0,
    "mealType" TEXT,
    "dietaryOptions" TEXT NOT NULL DEFAULT '[]',
    "cuisineType" TEXT,
    "averageCostPerPersonINR" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL DEFAULT 4.5,
    "ratingCount" INTEGER NOT NULL DEFAULT 5000,
    "popularityScore" INTEGER NOT NULL DEFAULT 85,
    "originalDataJson" TEXT,
    "enrichmentJson" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS "Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Delhi Royal Heritage Circuit',
    "destinationCity" TEXT NOT NULL DEFAULT 'Delhi',
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "startingLocation" TEXT NOT NULL DEFAULT 'Connaught Place, Central Delhi',
    "budget" REAL,
    "groupSize" INTEGER NOT NULL DEFAULT 1,
    "transportation" TEXT NOT NULL DEFAULT 'cab',
    "travelStyle" TEXT NOT NULL DEFAULT 'balanced',
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "optimizationScore" INTEGER NOT NULL DEFAULT 95,
    "totalDistanceKm" REAL NOT NULL DEFAULT 0,
    "totalDurationMin" INTEGER NOT NULL DEFAULT 0,
    "preferencesJson" TEXT,
    "itineraryJson" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
    "updatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "ItineraryStop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL DEFAULT 1,
    "sequenceNumber" INTEGER NOT NULL,
    "plannedArrival" TEXT NOT NULL,
    "plannedDeparture" TEXT NOT NULL,
    "visitDuration" INTEGER NOT NULL,
    "visitStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "isMustVisit" INTEGER NOT NULL DEFAULT 0,
    "selectionReason" TEXT,
    "transitInstruction" TEXT,
    "transitMinutes" INTEGER NOT NULL DEFAULT 15,
    "distanceFromPrevKm" REAL NOT NULL DEFAULT 3.0,
    FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE,
    FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "SavedDestination" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE ("userId", "destinationId"),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "actionsJson" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE
  );
`);

function normalizeDestinationRow(row) {
  if (!row) return null;
  return {
    ...row,
    isMustVisit: Boolean(row.isMustVisit),
    isMealStop: Boolean(row.isMealStop)
  };
}

function normalizeStopRow(row, include) {
  if (!row) return null;
  const normalized = {
    ...row,
    isMustVisit: Boolean(row.isMustVisit)
  };
  if (include?.destination) {
    const dest = db.prepare('SELECT * FROM "Destination" WHERE "id" = ?').get(row.destinationId);
    normalized.destination = normalizeDestinationRow(dest);
  }
  return normalized;
}

function normalizeTripRow(row, include) {
  if (!row) return null;
  const trip = { ...row };
  if (include?.stops) {
    const stopInclude = typeof include.stops === 'object' ? include.stops.include : undefined;
    const rows = db
      .prepare('SELECT * FROM "ItineraryStop" WHERE "tripId" = ? ORDER BY "dayNumber" ASC, "sequenceNumber" ASC')
      .all(row.id);
    trip.stops = rows.map(s => normalizeStopRow(s, stopInclude));
  }
  if (include?.chatMessages) {
    trip.chatMessages = db
      .prepare('SELECT * FROM "ChatMessage" WHERE "tripId" = ? ORDER BY "createdAt" ASC')
      .all(row.id);
  }
  return trip;
}

export const prisma = {
  $rawDb: db,
  $disconnect: async () => {
    // Keep SQLite connection ready
  },

  user: {
    findUnique: async ({ where, include }) => {
      let row = null;
      if (where.id) {
        row = db.prepare('SELECT * FROM "User" WHERE "id" = ?').get(where.id);
      } else if (where.email) {
        row = db.prepare('SELECT * FROM "User" WHERE LOWER("email") = LOWER(?)').get(where.email);
      }
      if (!row) return null;
      const user = { ...row };
      if (include?.preferences) {
        user.preferences = db.prepare('SELECT * FROM "UserPreference" WHERE "userId" = ?').get(user.id) || null;
      }
      if (include?.trips) {
        const rows = db.prepare('SELECT * FROM "Trip" WHERE "userId" = ? ORDER BY "createdAt" DESC').all(user.id);
        user.trips = rows.map(r => normalizeTripRow(r, include.trips.include));
      }
      if (include?.savedDestinations) {
        const saved = db.prepare('SELECT * FROM "SavedDestination" WHERE "userId" = ?').all(user.id);
        user.savedDestinations = saved.map(s => ({
          ...s,
          destination: include.savedDestinations.include?.destination
            ? normalizeDestinationRow(db.prepare('SELECT * FROM "Destination" WHERE "id" = ?').get(s.destinationId))
            : undefined
        }));
      }
      if (include?._count) {
        const tripsCount = db.prepare('SELECT COUNT(*) as c FROM "Trip" WHERE "userId" = ?').get(user.id).c;
        const savedCount = db.prepare('SELECT COUNT(*) as c FROM "SavedDestination" WHERE "userId" = ?').get(user.id).c;
        user._count = { trips: tripsCount, savedDestinations: savedCount };
      }
      return user;
    },
    create: async ({ data, include }) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO "User" ("id", "name", "email", "passwordHash", "createdAt") VALUES (?, ?, ?, ?, ?)'
      ).run(id, data.name, data.email, data.passwordHash, now);
      if (data.preferences?.create) {
        const pref = data.preferences.create;
        db.prepare(
          'INSERT INTO "UserPreference" ("id", "userId", "interests", "travelStyle", "budgetPreference", "transportPreference", "idealExperience", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          crypto.randomUUID(),
          id,
          pref.interests || '[]',
          pref.travelStyle || 'balanced',
          pref.budgetPreference || 'medium',
          pref.transportPreference || 'cab',
          pref.idealExperience || null,
          now
        );
      }
      return prisma.user.findUnique({ where: { id }, include });
    },
    update: async ({ where, data, include }) => {
      if (data.name) {
        db.prepare('UPDATE "User" SET "name" = ? WHERE "id" = ?').run(data.name, where.id);
      }
      return prisma.user.findUnique({ where, include });
    },
    deleteMany: async () => {
      db.prepare('DELETE FROM "User"').run();
    }
  },

  userPreference: {
    findUnique: async ({ where }) => {
      return db.prepare('SELECT * FROM "UserPreference" WHERE "userId" = ?').get(where.userId) || null;
    },
    upsert: async ({ where, create, update }) => {
      const existing = db.prepare('SELECT * FROM "UserPreference" WHERE "userId" = ?').get(where.userId);
      const now = new Date().toISOString();
      if (!existing) {
        const id = crypto.randomUUID();
        db.prepare(
          'INSERT INTO "UserPreference" ("id", "userId", "interests", "travelStyle", "budgetPreference", "transportPreference", "idealExperience", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          id,
          create.userId,
          create.interests || '[]',
          create.travelStyle || 'balanced',
          create.budgetPreference || 'medium',
          create.transportPreference || 'cab',
          create.idealExperience || null,
          now
        );
      } else {
        db.prepare(
          'UPDATE "UserPreference" SET "interests" = ?, "travelStyle" = ?, "budgetPreference" = ?, "transportPreference" = ?, "idealExperience" = ?, "updatedAt" = ? WHERE "userId" = ?'
        ).run(
          update.interests ?? existing.interests,
          update.travelStyle ?? existing.travelStyle,
          update.budgetPreference ?? existing.budgetPreference,
          update.transportPreference ?? existing.transportPreference,
          update.idealExperience ?? existing.idealExperience,
          now,
          where.userId
        );
      }
      return db.prepare('SELECT * FROM "UserPreference" WHERE "userId" = ?').get(where.userId);
    },
    deleteMany: async () => {
      db.prepare('DELETE FROM "UserPreference"').run();
    }
  },

  destination: {
    count: async (args) => {
      if (args?.where?.destinationKey) {
        return db
          .prepare('SELECT COUNT(*) as c FROM "Destination" WHERE LOWER("destinationKey") = LOWER(?)')
          .get(args.where.destinationKey).c;
      }
      return db.prepare('SELECT COUNT(*) as c FROM "Destination"').get().c;
    },
    findMany: async (args = {}) => {
      const where = args.where || {};
      let rows = db.prepare('SELECT * FROM "Destination"').all().map(normalizeDestinationRow);
      if (where.destinationKey) {
        const key = String(where.destinationKey).toLowerCase();
        rows = rows.filter(
          r => r.destinationKey.toLowerCase() === key || r.city.toLowerCase() === key
        );
      }
      if (where.city) {
        const c = String(where.city).toLowerCase();
        rows = rows.filter(
          r => r.city.toLowerCase() === c || r.destinationKey.toLowerCase() === c
        );
      }
      if (where.category && where.category !== 'All') {
        rows = rows.filter(r => r.category.toLowerCase() === String(where.category).toLowerCase());
      }
      if (where.OR && Array.isArray(where.OR)) {
        rows = rows.filter(r =>
          where.OR.some(cond => {
            if (cond.name?.contains) {
              return r.name.toLowerCase().includes(cond.name.contains.toLowerCase());
            }
            if (cond.description?.contains) {
              return r.description.toLowerCase().includes(cond.description.contains.toLowerCase());
            }
            if (cond.interestTags?.contains) {
              return r.interestTags.toLowerCase().includes(cond.interestTags.contains.toLowerCase());
            }
            return false;
          })
        );
      }
      if (args.orderBy?.isMustVisit === 'desc') {
        rows.sort((a, b) => Number(b.isMustVisit) - Number(a.isMustVisit));
      }
      return rows;
    },
    findUnique: async ({ where }) => {
      const row = db.prepare('SELECT * FROM "Destination" WHERE "id" = ?').get(where.id);
      return normalizeDestinationRow(row);
    },
    create: async ({ data }) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT OR REPLACE INTO "Destination" (
          "id", "destinationKey", "name", "city", "state", "description", "historicalSignificance",
          "category", "subcategory", "interestTags", "latitude", "longitude",
          "averageVisitDuration", "imageUrl", "imageSource", "officialSource", "googlePlaceId",
          "openingHours", "entryFeeINR", "highlights", "isMustVisit", "bestTimeOfDay", "area",
          "isMealStop", "mealType", "dietaryOptions", "cuisineType", "averageCostPerPersonINR",
          "rating", "ratingCount", "popularityScore", "originalDataJson", "enrichmentJson", "createdAt"
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.destinationKey || (data.city || 'delhi').toLowerCase(),
        data.name,
        data.city,
        data.state || data.city || 'India',
        data.description,
        data.historicalSignificance || null,
        data.category,
        data.subcategory || null,
        typeof data.interestTags === 'string' ? data.interestTags : JSON.stringify(data.interestTags || []),
        data.latitude,
        data.longitude,
        data.averageVisitDuration,
        data.imageUrl,
        data.imageSource || null,
        data.officialSource || null,
        data.googlePlaceId || null,
        data.openingHours || '09:00 - 17:30',
        data.entryFeeINR ?? 0,
        typeof data.highlights === 'string' ? data.highlights : JSON.stringify(data.highlights || []),
        data.isMustVisit ? 1 : 0,
        data.bestTimeOfDay || 'morning',
        data.area || 'Central',
        data.isMealStop ? 1 : 0,
        data.mealType || null,
        typeof data.dietaryOptions === 'string' ? data.dietaryOptions : JSON.stringify(data.dietaryOptions || []),
        data.cuisineType || null,
        data.averageCostPerPersonINR ?? 0,
        data.rating ?? 4.5,
        data.ratingCount ?? 5000,
        data.popularityScore ?? 85,
        data.originalDataJson || null,
        data.enrichmentJson || null,
        now
      );
      return prisma.destination.findUnique({ where: { id } });
    },
    deleteMany: async () => {
      db.prepare('DELETE FROM "Destination"').run();
    }
  },

  trip: {
    findMany: async ({ where, include } = {}) => {
      const rows = where?.userId
        ? db.prepare('SELECT * FROM "Trip" WHERE "userId" = ? ORDER BY "createdAt" DESC').all(where.userId)
        : db.prepare('SELECT * FROM "Trip" ORDER BY "createdAt" DESC').all();
      return rows.map(r => normalizeTripRow(r, include));
    },
    findFirst: async ({ where, include } = {}) => {
      let row = null;
      if (where?.id && where?.userId) {
        row = db.prepare('SELECT * FROM "Trip" WHERE "id" = ? AND "userId" = ?').get(where.id, where.userId);
      } else if (where?.id) {
        row = db.prepare('SELECT * FROM "Trip" WHERE "id" = ?').get(where.id);
      } else if (where?.userId) {
        row = db.prepare('SELECT * FROM "Trip" WHERE "userId" = ? ORDER BY "createdAt" DESC LIMIT 1').get(where.userId);
      }
      return normalizeTripRow(row, include);
    },
    findUnique: async ({ where, include }) => {
      const row = db.prepare('SELECT * FROM "Trip" WHERE "id" = ?').get(where.id);
      return normalizeTripRow(row, include);
    },
    create: async ({ data, include }) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO "Trip" (
          "id", "userId", "title", "destinationCity", "startDate", "endDate",
          "startingLocation", "budget", "groupSize", "transportation", "travelStyle",
          "status", "optimizationScore", "totalDistanceKm", "totalDurationMin",
          "preferencesJson", "itineraryJson", "createdAt", "updatedAt"
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.userId,
        data.title || 'Journeo Personalized Circuit',
        data.destinationCity || 'Delhi',
        data.startDate || '2026-11-15',
        data.endDate || '2026-11-16',
        data.startingLocation || 'City Center',
        data.budget ?? null,
        data.groupSize ?? 1,
        data.transportation || 'cab',
        data.travelStyle || 'balanced',
        data.status || 'UPCOMING',
        data.optimizationScore ?? 95,
        data.totalDistanceKm ?? 0,
        data.totalDurationMin ?? 0,
        data.preferencesJson || null,
        data.itineraryJson || null,
        now,
        now
      );

      if (data.stops?.create && Array.isArray(data.stops.create)) {
        for (const s of data.stops.create) {
          db.prepare(`
            INSERT INTO "ItineraryStop" (
              "id", "tripId", "destinationId", "dayNumber", "sequenceNumber",
              "plannedArrival", "plannedDeparture", "visitDuration", "visitStatus",
              "isMustVisit", "selectionReason", "transitInstruction", "transitMinutes", "distanceFromPrevKm"
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            s.id || crypto.randomUUID(),
            id,
            s.destinationId,
            s.dayNumber ?? 1,
            s.sequenceNumber ?? 1,
            s.plannedArrival || '09:30',
            s.plannedDeparture || '11:00',
            s.visitDuration ?? 60,
            s.visitStatus || 'PENDING',
            s.isMustVisit ? 1 : 0,
            s.selectionReason || null,
            s.transitInstruction || null,
            s.transitMinutes ?? 15,
            s.distanceFromPrevKm ?? 3.0
          );
        }
      }
      return prisma.trip.findUnique({ where: { id }, include });
    },
    update: async ({ where, data, include }) => {
      const existing = db.prepare('SELECT * FROM "Trip" WHERE "id" = ?').get(where.id);
      if (!existing) throw new Error(`Trip ${where.id} not found`);
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE "Trip" SET
          "title" = ?,
          "status" = ?,
          "travelStyle" = ?,
          "transportation" = ?,
          "optimizationScore" = ?,
          "totalDistanceKm" = ?,
          "totalDurationMin" = ?,
          "preferencesJson" = ?,
          "itineraryJson" = ?,
          "updatedAt" = ?
        WHERE "id" = ?
      `).run(
        data.title ?? existing.title,
        data.status ?? existing.status,
        data.travelStyle ?? existing.travelStyle,
        data.transportation ?? existing.transportation,
        data.optimizationScore ?? existing.optimizationScore,
        data.totalDistanceKm ?? existing.totalDistanceKm,
        data.totalDurationMin ?? existing.totalDurationMin,
        data.preferencesJson ?? existing.preferencesJson,
        data.itineraryJson ?? existing.itineraryJson,
        now,
        where.id
      );
      return prisma.trip.findUnique({ where, include });
    },
    delete: async ({ where }) => {
      db.prepare('DELETE FROM "Trip" WHERE "id" = ?').run(where.id);
    },
    deleteMany: async () => {
      db.prepare('DELETE FROM "Trip"').run();
    }
  },

  itineraryStop: {
    findFirst: async ({ where }) => {
      if (where.id && where.tripId) {
        return normalizeStopRow(
          db.prepare('SELECT * FROM "ItineraryStop" WHERE "id" = ? AND "tripId" = ?').get(where.id, where.tripId)
        );
      }
      return null;
    },
    create: async ({ data, include }) => {
      const id = data.id || crypto.randomUUID();
      db.prepare(`
        INSERT INTO "ItineraryStop" (
          "id", "tripId", "destinationId", "dayNumber", "sequenceNumber",
          "plannedArrival", "plannedDeparture", "visitDuration", "visitStatus",
          "isMustVisit", "selectionReason", "transitInstruction", "transitMinutes", "distanceFromPrevKm"
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.tripId,
        data.destinationId,
        data.dayNumber ?? 1,
        data.sequenceNumber ?? 1,
        data.plannedArrival || '09:30',
        data.plannedDeparture || '11:00',
        data.visitDuration ?? 60,
        data.visitStatus || 'PENDING',
        data.isMustVisit ? 1 : 0,
        data.selectionReason || null,
        data.transitInstruction || null,
        data.transitMinutes ?? 15,
        data.distanceFromPrevKm ?? 3.0
      );
      const row = db.prepare('SELECT * FROM "ItineraryStop" WHERE "id" = ?').get(id);
      return normalizeStopRow(row, include);
    },
    update: async ({ where, data, include }) => {
      const existing = db.prepare('SELECT * FROM "ItineraryStop" WHERE "id" = ?').get(where.id);
      if (!existing) throw new Error(`ItineraryStop ${where.id} not found`);
      db.prepare(`
        UPDATE "ItineraryStop" SET
          "sequenceNumber" = ?,
          "plannedArrival" = ?,
          "plannedDeparture" = ?,
          "visitDuration" = ?,
          "visitStatus" = ?,
          "isMustVisit" = ?,
          "selectionReason" = ?,
          "transitInstruction" = ?,
          "transitMinutes" = ?,
          "distanceFromPrevKm" = ?
        WHERE "id" = ?
      `).run(
        data.sequenceNumber ?? existing.sequenceNumber,
        data.plannedArrival ?? existing.plannedArrival,
        data.plannedDeparture ?? existing.plannedDeparture,
        data.visitDuration ?? existing.visitDuration,
        data.visitStatus ?? existing.visitStatus,
        data.isMustVisit !== undefined ? (data.isMustVisit ? 1 : 0) : existing.isMustVisit,
        data.selectionReason ?? existing.selectionReason,
        data.transitInstruction ?? existing.transitInstruction,
        data.transitMinutes ?? existing.transitMinutes,
        data.distanceFromPrevKm ?? existing.distanceFromPrevKm,
        where.id
      );
      const row = db.prepare('SELECT * FROM "ItineraryStop" WHERE "id" = ?').get(where.id);
      return normalizeStopRow(row, include);
    },
    deleteMany: async (args) => {
      if (args?.where?.tripId) {
        db.prepare('DELETE FROM "ItineraryStop" WHERE "tripId" = ?').run(args.where.tripId);
      } else {
        db.prepare('DELETE FROM "ItineraryStop"').run();
      }
    }
  },

  savedDestination: {
    findMany: async ({ where, include } = {}) => {
      const rows = where?.userId
        ? db.prepare('SELECT * FROM "SavedDestination" WHERE "userId" = ?').all(where.userId)
        : db.prepare('SELECT * FROM "SavedDestination"').all();
      return rows.map(r => ({
        ...r,
        destination: include?.destination
          ? normalizeDestinationRow(db.prepare('SELECT * FROM "Destination" WHERE "id" = ?').get(r.destinationId))
          : undefined
      }));
    },
    findUnique: async ({ where }) => {
      const key = where.userId_destinationId;
      if (key) {
        return (
          db
            .prepare('SELECT * FROM "SavedDestination" WHERE "userId" = ? AND "destinationId" = ?')
            .get(key.userId, key.destinationId) || null
        );
      }
      return null;
    },
    create: async ({ data }) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO "SavedDestination" ("id", "userId", "destinationId", "createdAt") VALUES (?, ?, ?, ?)').run(
        id,
        data.userId,
        data.destinationId,
        now
      );
      return db.prepare('SELECT * FROM "SavedDestination" WHERE "id" = ?').get(id);
    },
    delete: async ({ where }) => {
      db.prepare('DELETE FROM "SavedDestination" WHERE "id" = ?').run(where.id);
    },
    deleteMany: async () => {
      db.prepare('DELETE FROM "SavedDestination"').run();
    }
  },

  chatMessage: {
    findMany: async ({ where } = {}) => {
      if (where?.tripId) {
        return db
          .prepare('SELECT * FROM "ChatMessage" WHERE "tripId" = ? ORDER BY "createdAt" ASC')
          .all(where.tripId);
      }
      return db.prepare('SELECT * FROM "ChatMessage" ORDER BY "createdAt" ASC').all();
    },
    create: async ({ data }) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO "ChatMessage" ("id", "tripId", "sender", "messageText", "actionsJson", "createdAt") VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        id,
        data.tripId,
        data.sender,
        data.messageText,
        data.actionsJson || null,
        now
      );
      return db.prepare('SELECT * FROM "ChatMessage" WHERE "id" = ?').get(id);
    },
    deleteMany: async (args) => {
      if (args?.where?.tripId) {
        db.prepare('DELETE FROM "ChatMessage" WHERE "tripId" = ?').run(args.where.tripId);
      } else {
        db.prepare('DELETE FROM "ChatMessage"').run();
      }
    }
  }
};
