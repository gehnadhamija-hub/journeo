import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Undo2,
  X,
  CheckCircle2,
  Compass,
  Clock,
  ChevronRight
} from 'lucide-react';
import { OptimizedItineraryResponse } from '../features/itinerary/services/itineraryOptimizer';
import {
  AssistantChatMessage,
  AssistantConversationContext,
  processTripAssistantMessage
} from '../services/tripAssistantService';

interface TripAssistantDrawerProps {
  itinerary: OptimizedItineraryResponse;
  onApplyItineraryUpdate: (updated: OptimizedItineraryResponse) => void;
  onUndoLastUpdate?: () => boolean;
  canUndo?: boolean;
  defaultOpen?: boolean;
}

export const TripAssistantDrawer: React.FC<TripAssistantDrawerProps> = ({
  itinerary,
  onApplyItineraryUpdate,
  onUndoLastUpdate,
  canUndo = false,
  defaultOpen = false
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const [input, setInput] = useState<string>('');
  const [context, setContext] = useState<AssistantConversationContext>({
    lastReferencedDayNumber: 1
  });
  const [messages, setMessages] = useState<AssistantChatMessage[]>(() => [
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: `Hi! I'm your **${itinerary.destinationCity} Trip Assistant**. I understand your ${itinerary.days.length}-day route, preferences, and budget.\n\nAsk me to remove or swap stops, make a day more relaxed, add local cafes or street food, or explain why any place was selected!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestions: [
        'Make Day 1 more relaxed',
        'Avoid crowded tourist places',
        'Focus more on street food and local markets',
        'How much does this trip cost?'
      ]
    }
  ]);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = (textToProcess?: string) => {
    const prompt = (textToProcess ?? input).trim();
    if (!prompt) return;

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: AssistantChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: nowTime
    };

    const result = processTripAssistantMessage(prompt, itinerary, context);
    setContext(result.updatedContext);

    if (result.modified && result.updatedItinerary) {
      onApplyItineraryUpdate(result.updatedItinerary);
    }

    const assistantMsg: AssistantChatMessage = {
      id: `assistant-${Date.now() + 1}`,
      role: 'assistant',
      content: result.reply,
      timestamp: nowTime,
      actionApplied: result.action,
      modifiedTrip: result.modified,
      referencedDayNumber: result.updatedContext.lastReferencedDayNumber,
      referencedPlaceId: result.updatedContext.lastReferencedPlaceId,
      suggestions: result.suggestions
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    if (!textToProcess) {
      setInput('');
    }
  };

  const handleUndo = () => {
    if (!onUndoLastUpdate) return;
    const restored = onUndoLastUpdate();
    if (restored) {
      setMessages(prev => [
        ...prev,
        {
          id: `undo-${Date.now()}`,
          role: 'assistant',
          content: `Restored your previous **${itinerary.destinationCity}** itinerary snapshot!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modifiedTrip: true,
          suggestions: ['What is on Day 1 now?', 'Make Day 1 more relaxed']
        }
      ]);
    }
  };

  return (
    <>
      {/* Floating Launcher Pill */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-deep-green hover:bg-deep-green/95 text-white px-5 py-3.5 rounded-full shadow-soft-xl border border-sage/30 transition-all hover:scale-[1.02]"
        >
          <div className="w-7 h-7 rounded-full bg-terracotta flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <span className="text-xs font-bold block leading-tight">
              AI Trip Assistant
            </span>
            <span className="text-[10px] text-sage-light block">
              Modify {itinerary.destinationCity} Route Live
            </span>
          </div>
        </button>
      )}

      {/* Slide-Over / Docked Assistant Panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] max-h-[82vh] bg-white rounded-3xl border border-border shadow-soft-xl flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="bg-deep-green text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-terracotta/90 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-sm leading-tight flex items-center gap-1.5">
                  <span>{itinerary.destinationCity} Trip Assistant</span>
                  <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-sage/30 text-sage-light font-sans font-bold">
                    Live Sync
                  </span>
                </h3>
                <p className="text-[11px] text-ivory/75">
                  {itinerary.days.length} {itinerary.days.length === 1 ? 'Day' : 'Days'} • {itinerary.stops.length} Stops • Context-Aware
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {canUndo && onUndoLastUpdate && (
                <button
                  type="button"
                  onClick={handleUndo}
                  className="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  title="Undo last itinerary change"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Close Trip Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Context Bar */}
          <div className="bg-ivory px-4 py-2 border-b border-border flex items-center justify-between text-[11px] text-text-muted">
            <span className="flex items-center gap-1 font-semibold text-deep-green">
              <Compass className="w-3.5 h-3.5 text-terracotta" />
              Active Focus: Day {context.lastReferencedDayNumber || 1} in {itinerary.destinationCity}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Pace: {itinerary.tripConfig?.travelPace || 'balanced'}
            </span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-[420px] bg-ivory/30">
            {messages.map(m => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-deep-green text-white rounded-br-sm'
                      : 'bg-white text-charcoal border border-border shadow-soft-sm rounded-bl-sm'
                  }`}
                >
                  {m.modifiedTrip && m.actionApplied && (
                    <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Itinerary Updated: {m.actionApplied.type.replace(/_/g, ' ')}</span>
                    </div>
                  )}

                  <div className="whitespace-pre-line">{m.content}</div>
                </div>

                <span className="text-[10px] text-text-subtle mt-1 px-1">
                  {m.role === 'user' ? 'You' : 'Journeo Assistant'} • {m.timestamp}
                </span>

                {/* Follow-up Quick Chips */}
                {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(sug)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-ivory hover:bg-sage/20 text-deep-green border border-border transition-colors flex items-center gap-1"
                      >
                        <span>{sug}</span>
                        <ChevronRight className="w-3 h-3 text-terracotta" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={scrollEndRef} />
          </div>

          {/* Input Box */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-border flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`e.g. "Remove the museum from Day 1" or "Make it more relaxed"`}
              className="flex-1 bg-ivory border border-border rounded-xl px-3.5 py-2.5 text-xs text-charcoal placeholder:text-text-subtle focus:outline-none focus:border-deep-green"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2.5 rounded-xl bg-deep-green hover:bg-deep-green/90 disabled:opacity-40 text-white transition-all"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

