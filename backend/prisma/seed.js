import crypto from 'node:crypto';
import { prisma, SQLITE_DB_PATH } from '../src/database/prisma.js';
import { INDIA_DESTINATIONS } from '../../src/data/indiaDestinations.ts';

export async function seedDatabase() {
  console.log(`🌱 Seeding Journeo SQLite Database at ${SQLITE_DB_PATH}...`);

  // Clear existing data cleanly
  await prisma.chatMessage.deleteMany();
  await prisma.itineraryStop.deleteMany();
  await prisma.savedDestination.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.user.deleteMany();
  await prisma.destination.deleteMany();

  // Seed all verified places from INDIA_DESTINATIONS into SQLite Destination table
  const createdDestinations = [];
  for (const d of INDIA_DESTINATIONS) {
    const dest = await prisma.destination.create({
      data: {
        id: d.id,
        destinationKey: d.destinationId,
        name: d.name,
        city: d.city,
        state: d.state,
        description: d.description,
        historicalSignificance: d.historicalSignificance || null,
        category: d.category,
        subcategory: d.subcategory || null,
        interestTags: JSON.stringify(d.interestTags),
        latitude: d.latitude,
        longitude: d.longitude,
        averageVisitDuration: d.averageVisitDuration,
        imageUrl: d.imageUrl,
        imageSource: d.imageSource,
        officialSource: d.officialSource || d.originalData?.source || null,
        googlePlaceId: d.providerPlaceId || null,
        openingHours: d.openingHours,
        entryFeeINR: d.entryFeeINR,
        highlights: JSON.stringify(d.highlights || []),
        isMustVisit: d.isMustVisit,
        bestTimeOfDay: d.bestTimeOfDay || 'morning',
        area: d.area,
        isMealStop: Boolean(d.isMealStop),
        mealType: d.mealType || null,
        dietaryOptions: JSON.stringify(d.dietaryOptions || []),
        cuisineType: d.cuisineType || null,
        averageCostPerPersonINR: d.averageCostPerPersonINR || 0,
        rating: d.rating || 4.5,
        ratingCount: d.ratingCount || 5000,
        popularityScore: d.popularityScore || 85,
        originalDataJson: d.originalData ? JSON.stringify(d.originalData) : null,
        enrichmentJson: d.enrichment ? JSON.stringify(d.enrichment) : null
      }
    });
    createdDestinations.push(dest);
  }

  console.log(`✅ Seeded ${createdDestinations.length} verified places across 10 destinations in SQLite.`);

  // Create default Demo Traveler User
  const passwordHash = crypto.createHash('sha256').update('journeo123').digest('hex');
  const demoUser = await prisma.user.create({
    data: {
      id: 'usr_demo_aarav_01',
      name: 'Aarav Sharma',
      email: 'aarav@journeo.in',
      passwordHash,
      preferences: {
        create: {
          interests: JSON.stringify(['Historical Monuments', 'Ancient Architecture', 'Photography', 'Local Food']),
          travelStyle: 'balanced',
          budgetPreference: 'medium',
          transportPreference: 'cab',
          idealExperience: 'Explore UNESCO Mughal architecture in the morning with authentic Old Delhi culinary stops.'
        }
      }
    },
    include: { preferences: true }
  });

  // Create a sample Trip in SQLite
  const redFort = createdDestinations.find(d => d.id === 'delhi_red_fort');
  const jamaMasjid = createdDestinations.find(d => d.id === 'delhi_jama_masjid');
  const humayunTomb = createdDestinations.find(d => d.id === 'delhi_humayun_tomb');
  const qutubMinar = createdDestinations.find(d => d.id === 'delhi_qutub_minar');

  const sampleTrip = await prisma.trip.create({
    data: {
      id: 'trip_demo_delhi_01',
      userId: demoUser.id,
      title: 'Imperial Delhi & Heritage Odyssey',
      destinationCity: 'Delhi',
      startDate: '2026-11-15',
      endDate: '2026-11-16',
      startingLocation: 'Connaught Place, New Delhi',
      budget: 18500,
      groupSize: 2,
      transportation: 'cab',
      travelStyle: 'balanced',
      status: 'ONGOING',
      optimizationScore: 98,
      totalDistanceKm: 23.4,
      totalDurationMin: 465,
      stops: {
        create: [
          {
            destinationId: redFort.id,
            dayNumber: 1,
            sequenceNumber: 1,
            plannedArrival: '09:00',
            plannedDeparture: '11:00',
            visitDuration: 120,
            visitStatus: 'VISITED',
            isMustVisit: true,
            selectionReason: 'Matches History & Mughal Architecture preference',
            transitInstruction: 'Take Yellow Line Metro to Lal Qila Station (14 mins)',
            transitMinutes: 14,
            distanceFromPrevKm: 4.8
          },
          {
            destinationId: jamaMasjid.id,
            dayNumber: 1,
            sequenceNumber: 2,
            plannedArrival: '11:15',
            plannedDeparture: '12:15',
            visitDuration: 60,
            visitStatus: 'VISITED',
            isMustVisit: false,
            selectionReason: 'Adjacent Old Delhi architectural landmark',
            transitInstruction: 'Short cycle-rickshaw ride across Netaji Subhash Marg (8 mins)',
            transitMinutes: 8,
            distanceFromPrevKm: 1.1
          },
          {
            destinationId: humayunTomb.id,
            dayNumber: 1,
            sequenceNumber: 3,
            plannedArrival: '13:30',
            plannedDeparture: '15:10',
            visitDuration: 100,
            visitStatus: 'PENDING',
            isMustVisit: true,
            selectionReason: 'UNESCO Charbagh Garden Tomb matching Architecture & Photography',
            transitInstruction: 'Private cab south via Mathura Road (22 mins)',
            transitMinutes: 22,
            distanceFromPrevKm: 7.4
          },
          {
            destinationId: qutubMinar.id,
            dayNumber: 1,
            sequenceNumber: 4,
            plannedArrival: '15:45',
            plannedDeparture: '17:15',
            visitDuration: 90,
            visitStatus: 'PENDING',
            isMustVisit: true,
            selectionReason: '12th-century UNESCO Victory Tower matching History',
            transitInstruction: 'Cab via Aurobindo Marg to Mehrauli (26 mins)',
            transitMinutes: 26,
            distanceFromPrevKm: 10.1
          }
        ]
      }
    }
  });

  console.log(`🎉 Seeded Demo User (${demoUser.email}) and Sample Trip (${sampleTrip.id}) in SQLite.`);
  return {
    destinationsCount: createdDestinations.length,
    demoUserId: demoUser.id,
    sampleTripId: sampleTrip.id
  };
}

// Run directly when executed from CLI
if (process.argv.some(arg => arg.endsWith('seed.js'))) {
  seedDatabase().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}
