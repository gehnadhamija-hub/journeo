import React, { useState, useEffect } from 'react';
import {
  ExpenseCategory,
  TripExpenseRecord,
  TripBudgetBreakdown,
  getTripExpenses,
  addTripExpense,
  updateTripExpense,
  deleteTripExpense,
  summarizeTripExpenses
} from '../services/expenseService';
import {
  Wallet,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  IndianRupee,
  X
} from 'lucide-react';

interface TripExpenseTrackerPanelProps {
  tripId: string;
  userId?: string;
  travellers: number;
  budgetBreakdown?: TripBudgetBreakdown;
  stops?: any[];
  compact?: boolean;
}

const EXPENSE_CATEGORY_LABELS: { id: ExpenseCategory; label: string }[] = [
  { id: 'intercity_transport', label: 'Intercity Transport' },
  { id: 'accommodation', label: 'Accommodation' },
  { id: 'local_transport', label: 'Local Transport' },
  { id: 'food', label: 'Food & Dining' },
  { id: 'attractions', label: 'Attractions & Tickets' },
  { id: 'shopping', label: 'Shopping & Souvenirs' },
  { id: 'miscellaneous', label: 'Miscellaneous' }
];

export const TripExpenseTrackerPanel: React.FC<TripExpenseTrackerPanelProps> = ({
  tripId,
  userId = 'guest',
  travellers = 2,
  budgetBreakdown,
  stops = []
}) => {
  const [expenses, setExpenses] = useState<TripExpenseRecord[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [placeId, setPlaceId] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');

  const plannedBudget = budgetBreakdown?.totalBudget || 25000;

  const refreshExpenses = () => {
    const list = getTripExpenses(tripId);
    setExpenses(list);
  };

  useEffect(() => {
    refreshExpenses();
  }, [tripId]);

  const summary = summarizeTripExpenses(tripId, plannedBudget, travellers);

  const resetForm = () => {
    setCategory('food');
    setAmount('');
    setDescription('');
    setPlaceId('');
    setNotes('');
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmt = Number(amount);
    if (!numericAmt || numericAmt <= 0) return;

    const matchedStop = stops.find(
      s => (s.placeId || s.destination?.id || s.id) === placeId
    );
    const placeName = matchedStop?.destination?.name || matchedStop?.name || undefined;

    if (editingId) {
      updateTripExpense(tripId, editingId, {
        category,
        amount: numericAmt,
        description: description.trim() || EXPENSE_CATEGORY_LABELS.find(c => c.id === category)?.label || 'Expense',
        placeId: placeId || undefined,
        placeName,
        expenseDate,
        notes
      });
    } else {
      addTripExpense({
        tripId,
        userId,
        category,
        amount: numericAmt,
        description: description.trim() || EXPENSE_CATEGORY_LABELS.find(c => c.id === category)?.label || 'Expense',
        placeId: placeId || undefined,
        placeName,
        expenseDate,
        notes
      });
    }

    refreshExpenses();
    resetForm();
  };

  const handleStartEdit = (rec: TripExpenseRecord) => {
    setEditingId(rec.id);
    setCategory(rec.category);
    setAmount(String(rec.amount));
    setDescription(rec.description);
    setPlaceId(rec.placeId || '');
    setExpenseDate(rec.expenseDate);
    setNotes(rec.notes || '');
    setShowAddForm(true);
  };

  const handleDelete = (id: string) => {
    deleteTripExpense(tripId, id);
    refreshExpenses();
  };

  const est = budgetBreakdown?.estimatedExpenses;

  return (
    <div className="bg-white rounded-3xl border border-border p-6 sm:p-7 shadow-soft-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-deep-green bg-sage/20 px-2.5 py-0.5 rounded-full">
            Budget & Live Expense Tracker
          </span>
          <h3 className="font-serif text-xl sm:text-2xl font-bold text-text mt-1 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-terracotta" />
            Planned Budget, Estimates & Actual Spend
          </h3>
        </div>

        <button
          type="button"
          onClick={() => {
            if (showAddForm) resetForm();
            else setShowAddForm(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-deep-green hover:bg-deep-green-dark text-white text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto transition-all shadow-xs"
        >
          {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{showAddForm ? 'Close Form' : 'Log Trip Expense'}</span>
        </button>
      </div>

      {/* Top 4 Financial KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-ivory border border-border/80">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-subtle block">
            Planned Total Budget
          </span>
          <span className="text-lg font-serif font-bold text-text mt-0.5 block">
            ₹{plannedBudget.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-text-muted">
            ₹{Math.round(plannedBudget / Math.max(1, travellers)).toLocaleString('en-IN')}/person ({travellers} pax)
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-ivory border border-border/80">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-subtle block">
            Estimated Itinerary Cost
          </span>
          <span className="text-lg font-serif font-bold text-deep-green mt-0.5 block">
            ₹{(est?.totalEstimated || 0).toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-text-muted">
            Pre-trip estimate (₹{(est?.perPersonEstimated || 0).toLocaleString('en-IN')}/pax)
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-ivory border border-border/80">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-subtle block">
            Actual Logged Spend
          </span>
          <span className="text-lg font-serif font-bold text-terracotta mt-0.5 block">
            ₹{summary.totalActualSpent.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-text-muted">
            ₹{summary.perPersonActualSpent.toLocaleString('en-IN')}/person ({expenses.length} items)
          </span>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            summary.isActualOverBudget || budgetBreakdown?.isEstimatedOverBudget
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-75 block">
            {summary.totalActualSpent > 0 ? 'Remaining vs Actual' : 'Remaining vs Estimate'}
          </span>
          <span className="text-lg font-serif font-bold mt-0.5 block">
            {summary.totalActualSpent > 0
              ? summary.isActualOverBudget
                ? `-₹${summary.amountOverPlannedBudget.toLocaleString('en-IN')}`
                : `₹${summary.remainingFromPlannedBudget.toLocaleString('en-IN')}`
              : budgetBreakdown?.isEstimatedOverBudget
              ? `-₹${budgetBreakdown.overBudgetAmount.toLocaleString('en-IN')}`
              : `₹${(budgetBreakdown?.remainingEstimatedBudget ?? plannedBudget).toLocaleString('en-IN')}`}
          </span>
          <span className="text-[11px] font-medium flex items-center gap-1">
            {summary.isActualOverBudget || budgetBreakdown?.isEstimatedOverBudget ? (
              <>
                <AlertTriangle className="w-3 h-3" /> Over Budget Alert
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3" /> Within Planned Budget
              </>
            )}
          </span>
        </div>
      </div>

      {/* Category Breakdown Grid (Estimated vs Actual) */}
      {est && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs">
          {[
            { key: 'intercity_transport', label: 'Intercity Transit', estVal: est.intercityTransport, actVal: summary.byCategory.intercity_transport },
            { key: 'accommodation', label: 'Accommodation', estVal: est.accommodation, actVal: summary.byCategory.accommodation },
            { key: 'local_transport', label: 'Local Transport', estVal: est.localTransport, actVal: summary.byCategory.local_transport },
            { key: 'food', label: 'Food & Cafes', estVal: est.food, actVal: summary.byCategory.food },
            { key: 'attractions', label: 'Attractions', estVal: est.attractions, actVal: summary.byCategory.attractions },
            { key: 'miscellaneous', label: 'Misc & Shopping', estVal: est.miscellaneous, actVal: summary.byCategory.miscellaneous + summary.byCategory.shopping }
          ].map(cat => (
            <div key={cat.key} className="p-3 rounded-xl bg-ivory/60 border border-border/70">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-subtle block truncate">
                {cat.label}
              </span>
              <span className="text-xs font-bold text-text mt-0.5 block">
                Est: ₹{cat.estVal.toLocaleString('en-IN')}
              </span>
              {cat.actVal > 0 && (
                <span className="text-[11px] font-bold text-terracotta block">
                  Actual: ₹{cat.actVal.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Over-budget warnings & suggestions */}
      {budgetBreakdown?.isEstimatedOverBudget && budgetBreakdown.savingSuggestions.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{budgetBreakdown.warnings[0]}</span>
          </div>
          <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
            {budgetBreakdown.savingSuggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Add / Edit Expense Form */}
      {showAddForm && (
        <form
          onSubmit={handleSaveExpense}
          className="bg-ivory p-5 rounded-2xl border border-border space-y-4 animate-fade-in"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-deep-green">
              {editingId ? 'Edit Logged Expense' : 'Record New Trip Expense'}
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-text-muted mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as ExpenseCategory)}
                className="w-full bg-white border border-border rounded-xl px-3 py-2.5 text-xs font-bold text-text"
              >
                {EXPENSE_CATEGORY_LABELS.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-muted mb-1">
                Amount (₹ INR)
              </label>
              <div className="relative">
                <IndianRupee className="w-3.5 h-3.5 text-text-subtle absolute left-3 top-3" />
                <input
                  type="number"
                  min={1}
                  required
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="e.g. 650"
                  className="w-full bg-white border border-border rounded-xl pl-8 pr-3 py-2.5 text-xs font-bold text-text"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-muted mb-1">
                Date
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
                className="w-full bg-white border border-border rounded-xl px-3 py-2.5 text-xs font-medium text-text"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-muted mb-1">
                Description
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Goan Thali Lunch / Entry Tickets"
                className="w-full bg-white border border-border rounded-xl px-3 py-2.5 text-xs font-medium text-text"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-muted mb-1">
                Associated Place (Optional)
              </label>
              <select
                value={placeId}
                onChange={e => setPlaceId(e.target.value)}
                className="w-full bg-white border border-border rounded-xl px-3 py-2.5 text-xs font-medium text-text"
              >
                <option value="">General Trip Expense</option>
                {stops.map((s, idx) => {
                  const pid = s.placeId || s.destination?.id || s.id;
                  const pname = s.destination?.name || s.name || `Stop ${idx + 1}`;
                  return (
                    <option key={`${pid}-${idx}`} value={pid}>
                      {pname}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-muted mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Shared by group / UPI"
                className="w-full bg-white border border-border rounded-xl px-3 py-2.5 text-xs font-medium text-text"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-xl border border-border bg-white text-xs font-bold text-text-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-deep-green text-white text-xs font-bold"
            >
              {editingId ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      )}

      {/* Logged Expenses List */}
      {expenses.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-text-muted">
            <span>Recorded Expenses ({expenses.length})</span>
            <span>Total: ₹{summary.totalActualSpent.toLocaleString('en-IN')}</span>
          </div>
          <div className="divide-y divide-border/60 border border-border rounded-2xl overflow-hidden bg-ivory/40">
            {expenses.map(exp => (
              <div
                key={exp.id}
                className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-white transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text">{exp.description}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sage/15 text-deep-green">
                      {exp.category.replace('_', ' ')}
                    </span>
                    {exp.placeName && (
                      <span className="text-[10px] text-terracotta font-medium truncate">
                        @ {exp.placeName}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-subtle mt-0.5">
                    {exp.expenseDate} {exp.notes ? `• ${exp.notes}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-serif font-bold text-sm text-charcoal">
                    ₹{exp.amount.toLocaleString('en-IN')}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(exp)}
                    className="p-1 text-stone-400 hover:text-deep-green"
                    title="Edit expense"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(exp.id)}
                    className="p-1 text-stone-400 hover:text-red-600"
                    title="Delete expense"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

