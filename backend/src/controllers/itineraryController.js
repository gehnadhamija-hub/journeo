import { prisma } from '../database/prisma.js';
import { generateItineraryPlan } from '../algorithms/itineraryOptimizer.js';
import { runAdaptiveReplanning } from '../algorithms/adaptiveReplanner.js';
import { parseNaturalLanguagePreferences } from '../services/aiService.js';

export async function generateItinerary(req, res) {
  try {
    const {
      city = 'Delhi',
      destinationIds = [],
      mustVisitIds = [],
      excludedIds = [],
      startingLocation,
      startTime = '09:00',
      availableHours = 8,
      transportMode = 'cab',
      travelStyle = 'balanced',
      naturalLanguagePrompt,
      interests = []
    } = req.body;

    let effectiveStyle = travelStyle;
    let effectiveTransport = transportMode;
    let effectiveInterests = interests;
    let aiExplanation = null;

    if (naturalLanguagePrompt) {
      const parsed = await parseNaturalLanguagePreferences(naturalLanguagePrompt);
      effectiveStyle = parsed.travelStyle || travelStyle;
      effectiveTransport = parsed.transportPreference || transportMode;
      if (parsed.extractedInterests?.length > 0) {
        effectiveInterests = parsed.extractedInterests;
      }
      aiExplanation = parsed.summary;
    }

    // Fetch candidate destinations
    let candidates = [];
    if (destinationIds && destinationIds.length > 0) {
      candidates = await prisma.destination.findMany({
        where: { id: { in: destinationIds } }
      });
    } else {
      candidates = await prisma.destination.findMany({
        where: { city: { contains: city } }
      });
    }

    const plan = generateItineraryPlan({
      destinations: candidates,
      mustVisitIds,
      excludedIds,
      startingLocation: startingLocation || { lat: 28.6328, lng: 77.2197, address: 'Connaught Place, Central Delhi' },
      startTime,
      availableHours: Number(availableHours) || 8,
      transportMode: effectiveTransport,
      travelStyle: effectiveStyle,
      interests: effectiveInterests,
      naturalLanguagePrompt,
      seedVariation: req.body.seedVariation || 0
    });

    res.json({
      title: `${city} Royal Heritage Circuit`,
      destinationCity: city,
      plan,
      aiExplanation,
      appliedPreferences: {
        travelStyle: effectiveStyle,
        transportMode: effectiveTransport,
        interests: effectiveInterests
      }
    });
  } catch (err) {
    console.error('generateItinerary error:', err);
    res.status(500).json({ error: 'Failed to generate optimized itinerary.' });
  }
}

export async function replanItinerary(req, res) {
  try {
    const { tripId } = req.params;
    const { delayedStopIndex = 0, delayMinutes = 45, reason = 'running_late', stops: clientStops } = req.body;

    let currentStops = clientStops;

    if (!currentStops && tripId && tripId !== 'preview') {
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        include: { stops: { include: { destination: true }, orderBy: { sequenceNumber: 'asc' } } }
      });
      if (trip) {
        currentStops = trip.stops;
      }
    }

    if (!currentStops || currentStops.length === 0) {
      return res.status(400).json({ error: 'No itinerary stops provided for replanning.' });
    }

    const scenario = runAdaptiveReplanning({
      currentStops,
      delayedStopIndex: Number(delayedStopIndex),
      delayMinutes: Number(delayMinutes),
      reason
    });

    res.json(scenario);
  } catch (err) {
    console.error('replanItinerary error:', err);
    res.status(500).json({ error: 'Failed to run adaptive replanner.' });
  }
}

export async function applyAdaptiveStrategy(req, res) {
  try {
    const { tripId } = req.params;
    const { updatedStops } = req.body;

    if (!updatedStops || updatedStops.length === 0) {
      return res.status(400).json({ error: 'Updated stops are required.' });
    }

    if (tripId && tripId !== 'preview') {
      // Re-create stops for the persisted trip
      await prisma.itineraryStop.deleteMany({ where: { tripId } });

      for (let i = 0; i < updatedStops.length; i++) {
        const s = updatedStops[i];
        await prisma.itineraryStop.create({
          data: {
            tripId,
            destinationId: s.destinationId || s.destination?.id,
            sequenceNumber: i + 1,
            plannedArrival: s.plannedArrival,
            plannedDeparture: s.plannedDeparture,
            visitDuration: s.visitDuration,
            visitStatus: s.visitStatus || 'PENDING',
            isMustVisit: Boolean(s.isMustVisit),
            transitInstruction: s.transitInstruction,
            transitMinutes: s.transitMinutes || 15,
            distanceFromPrevKm: s.distanceFromPrevKm || 3.0
          }
        });
      }

      await prisma.trip.update({
        where: { id: tripId },
        data: { updatedAt: new Date() }
      });
    }

    res.json({ message: 'Adaptive strategy applied successfully.', updatedStops });
  } catch (err) {
    console.error('applyAdaptiveStrategy error:', err);
    res.status(500).json({ error: 'Failed to apply adaptive strategy.' });
  }
}

export async function updateStopStatus(req, res) {
  try {
    const { stopId } = req.params;
    const { status } = req.body; // PENDING, VISITED, SKIPPED

    if (!['PENDING', 'VISITED', 'SKIPPED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid visit status.' });
    }

    const updated = await prisma.itineraryStop.update({
      where: { id: stopId },
      data: { visitStatus: status }
    });

    res.json({ message: 'Stop status updated.', stop: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update stop status.' });
  }
}
