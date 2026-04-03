/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * P4: Weekly activity Kanban — calendar week vs rolling 7 days, Mon–Sun columns, CRUD, DnD, detail modal.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarRange, GripVertical, LayoutGrid } from 'lucide-react';
import type { WeeklyActivityCardRow } from '@/lib/supabase/admin/trainer-client-weekly-board';
import {
  addDaysDateOnly,
  isValidDateOnly,
  mondayOfWeekContainingLocal,
  rollingSevenDatesEndingToday,
  truncateCardTitle,
  uniqueMondaysForDates,
} from '@/lib/performance-lab/weekly-board-dates';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';

type ViewMode = 'calendar_week' | 'rolling_7';

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dropIdForDate(dateStr: string): string {
  return `drop-${dateStr}`;
}

function parseDropId(id: string): string | null {
  if (!id.startsWith('drop-')) return null;
  const rest = id.slice('drop-'.length);
  return isValidDateOnly(rest) ? rest : null;
}

function formatColumnTitle(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    const wd = WEEKDAY_SHORT[(d.getDay() + 6) % 7];
    const rest = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${wd} ${rest}`;
  } catch {
    return dateStr;
  }
}

interface BoardPayload {
  boardId: string;
  weekStartDate: string;
  cards: WeeklyActivityCardRow[];
}

interface PerformanceLabWeekSectionProps {
  userId: string;
}

function SortableWeekCard({
  card,
  busy,
  onOpenDetail,
}: {
  card: WeeklyActivityCardRow;
  busy: boolean;
  onOpenDetail: (c: WeeklyActivityCardRow) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-1 rounded border border-white/10 bg-black/40 p-2 text-sm ${
        isDragging ? 'z-10 opacity-60 ring-1 ring-orange-light/40' : ''
      }`}
    >
      <button
        type="button"
        className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-white/40 hover:bg-white/10 hover:text-white/70 active:cursor-grabbing"
        aria-label="Drag to reorder or move day"
        disabled={!!busy}
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => onOpenDetail(card)}
        className="min-w-0 flex-1 rounded px-0.5 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-orange-light/50"
      >
        <div className="truncate font-medium text-white" title={card.title}>
          {truncateCardTitle(card.title, 20)}
        </div>
        <div className="mt-0.5 truncate text-[10px] text-white/45">
          {card.activityType}
          {card.durationMinutes != null ? ` · ${card.durationMinutes} min` : ''}
        </div>
        <span
          className={`mt-1 inline-block rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${
            card.status === 'done'
              ? 'bg-emerald-500/20 text-emerald-300'
              : card.status === 'skipped'
                ? 'bg-white/10 text-white/50'
                : 'bg-orange-light/15 text-orange-light'
          }`}
        >
          {card.status}
        </span>
      </button>
    </div>
  );
}

function WeekColumn({
  dateStr,
  cards,
  busy,
  onOpenDetail,
}: {
  dateStr: string;
  cards: WeeklyActivityCardRow[];
  busy: boolean;
  onOpenDetail: (c: WeeklyActivityCardRow) => void;
}) {
  const dropId = dropIdForDate(dateStr);
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  const ids = useMemo(() => cards.map((c) => c.id), [cards]);

  return (
    <div className="flex min-h-[12rem] flex-col rounded-lg border border-white/10 bg-black/30 p-2">
      <div className="mb-2 border-b border-white/10 pb-2 font-mono text-[11px] font-bold uppercase text-orange-light/90">
        {formatColumnTitle(dateStr)}
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[6rem] flex-1 flex-col gap-2 overflow-y-auto rounded-md p-0.5 ${
          isOver ? 'bg-orange-light/5 ring-1 ring-orange-light/30' : ''
        }`}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <SortableWeekCard key={c.id} card={c} busy={!!busy} onOpenDetail={onOpenDetail} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

const PerformanceLabWeekSection: React.FC<PerformanceLabWeekSectionProps> = ({ userId }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar_week');
  const [calendarWeekStart, setCalendarWeekStart] = useState(() =>
    mondayOfWeekContainingLocal(new Date())
  );
  const [columnDates, setColumnDates] = useState<string[]>(() => {
    const mon = mondayOfWeekContainingLocal(new Date());
    return Array.from({ length: 7 }, (_, i) => addDaysDateOnly(mon, i));
  });
  const [cardsByDate, setCardsByDate] = useState<Record<string, WeeklyActivityCardRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newDayIndex, setNewDayIndex] = useState(0);
  const [newActivityType, setNewActivityType] = useState('activity');
  const [newDuration, setNewDuration] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const [detailCard, setDetailCard] = useState<WeeklyActivityCardRow | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [modalActivityType, setModalActivityType] = useState('');
  const [modalDuration, setModalDuration] = useState('');
  const detailSeedIdRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const recomputeColumnDates = useCallback(() => {
    if (viewMode === 'calendar_week') {
      setColumnDates(Array.from({ length: 7 }, (_, i) => addDaysDateOnly(calendarWeekStart, i)));
    } else {
      setColumnDates(rollingSevenDatesEndingToday());
    }
  }, [viewMode, calendarWeekStart]);

  useEffect(() => {
    recomputeColumnDates();
  }, [recomputeColumnDates]);

  const mondaysToFetch = useMemo(() => uniqueMondaysForDates(columnDates), [columnDates]);

  const syncDetailFromMap = useCallback(
    (map: Record<string, WeeklyActivityCardRow[]>) => {
      setDetailCard((prev) => {
        if (!prev) return null;
        for (const d of columnDates) {
          const c = map[d]?.find((x) => x.id === prev.id);
          if (c) return c;
        }
        return null;
      });
    },
    [columnDates]
  );

  const loadBoards = useCallback(async () => {
    if (!userId || columnDates.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const auth = await missionControlApiAuthHeaders();
      const payloads: BoardPayload[] = [];
      for (const ws of mondaysToFetch) {
        const res = await fetch(
          `/api/trainer/clients/${encodeURIComponent(userId)}/weekly-board?weekStart=${encodeURIComponent(ws)}`,
          { credentials: 'include', headers: { ...auth } }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof body.error === 'string' ? body.error : 'Failed to load board');
          setCardsByDate({});
          return;
        }
        payloads.push(body as BoardPayload);
      }
      const map: Record<string, WeeklyActivityCardRow[]> = {};
      for (const d of columnDates) {
        map[d] = [];
      }
      for (const p of payloads) {
        for (const c of p.cards) {
          const ds = c.scheduledDate;
          if (map[ds]) map[ds].push(c);
        }
      }
      for (const d of columnDates) {
        map[d].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
      }
      setCardsByDate(map);
      syncDetailFromMap(map);
    } catch {
      setError('Failed to load board');
      setCardsByDate({});
    } finally {
      setLoading(false);
    }
  }, [userId, columnDates, mondaysToFetch, syncDetailFromMap]);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    if (!detailCard) {
      detailSeedIdRef.current = null;
      return;
    }
    if (detailSeedIdRef.current === detailCard.id) return;
    detailSeedIdRef.current = detailCard.id;
    setModalTitle(detailCard.title);
    setModalNotes(detailCard.notes ?? '');
    setModalActivityType(detailCard.activityType);
    setModalDuration(
      detailCard.durationMinutes != null ? String(detailCard.durationMinutes) : ''
    );
  }, [detailCard]);

  useEffect(() => {
    if (!detailCard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailCard(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailCard]);

  const scheduledDateForNewCard = columnDates[newDayIndex] ?? columnDates[0];
  const weekStartForNewCard =
    scheduledDateForNewCard != null
      ? mondayOfWeekContainingLocal(new Date(scheduledDateForNewCard + 'T12:00:00'))
      : calendarWeekStart;

  const createCard = async () => {
    if (!userId || !scheduledDateForNewCard || !newTitle.trim()) return;
    setBusy('create');
    try {
      const auth = await missionControlApiAuthHeaders();
      const dur = newDuration.trim() ? parseInt(newDuration, 10) : null;
      const res = await fetch(
        `/api/trainer/clients/${encodeURIComponent(userId)}/weekly-board`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            weekStartDate: weekStartForNewCard,
            scheduledDate: scheduledDateForNewCard,
            title: newTitle.trim(),
            activityType: newActivityType.trim() || 'activity',
            durationMinutes: dur != null && Number.isFinite(dur) ? dur : null,
            notes: newNotes.trim() || null,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof body.error === 'string' ? body.error : 'Could not create card');
        return;
      }
      setNewTitle('');
      setNewNotes('');
      setNewDuration('');
      await loadBoards();
    } finally {
      setBusy(null);
    }
  };

  const patchCard = async (
    cardId: string,
    patch: Partial<{
      status: WeeklyActivityCardRow['status'];
      title: string;
      notes: string | null;
      scheduledDate: string;
      sortOrder: number;
      activityType: string;
      durationMinutes: number | null;
    }>
  ) => {
    if (!userId) return false;
    setBusy(`patch:${cardId}`);
    try {
      const auth = await missionControlApiAuthHeaders();
      const res = await fetch(
        `/api/trainer/clients/${encodeURIComponent(userId)}/weekly-board/cards/${encodeURIComponent(cardId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof body.error === 'string' ? body.error : 'Could not update');
        return false;
      }
      await loadBoards();
      return true;
    } finally {
      setBusy(null);
    }
  };

  const persistColumnOrder = async (dateStr: string, ordered: WeeklyActivityCardRow[]) => {
    if (!userId) return;
    const auth = await missionControlApiAuthHeaders();
    await Promise.all(
      ordered.map((c, i) => {
        if (c.scheduledDate === dateStr && c.sortOrder === i) {
          return Promise.resolve();
        }
        return fetch(
          `/api/trainer/clients/${encodeURIComponent(userId)}/weekly-board/cards/${encodeURIComponent(c.id)}`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduledDate: dateStr, sortOrder: i }),
          }
        ).then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(typeof body.error === 'string' ? body.error : 'Update failed');
          }
        });
      })
    );
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const colOfCard = (cardId: string) =>
      columnDates.find((d) => (cardsByDate[d] ?? []).some((c) => c.id === cardId));

    const activeCol = colOfCard(activeId);
    if (!activeCol) return;

    const dropDate = parseDropId(overId);
    const overCardCol = colOfCard(overId);
    const targetCol = dropDate ?? overCardCol ?? null;
    if (!targetCol) return;

    try {
      setBusy('dnd');
      if (activeCol === targetCol) {
        const list = [...(cardsByDate[activeCol] ?? [])];
        const oldIndex = list.findIndex((c) => c.id === activeId);
        let newIndex: number;
        if (dropDate === activeCol) {
          newIndex = list.length - 1;
        } else {
          newIndex = list.findIndex((c) => c.id === overId);
        }
        if (oldIndex < 0 || newIndex < 0) return;
        if (oldIndex === newIndex) return;
        const reordered = arrayMove(list, oldIndex, newIndex);
        await persistColumnOrder(activeCol, reordered);
      } else {
        const sourceList = [...(cardsByDate[activeCol] ?? [])];
        const targetList = [...(cardsByDate[targetCol] ?? [])];
        const moved = sourceList.find((c) => c.id === activeId);
        if (!moved) return;
        const sourceWithout = sourceList.filter((c) => c.id !== activeId);
        const destFiltered = targetList.filter((c) => c.id !== activeId);
        let insertIdx: number;
        if (dropDate === targetCol) {
          insertIdx = destFiltered.length;
        } else {
          insertIdx = destFiltered.findIndex((c) => c.id === overId);
          if (insertIdx < 0) insertIdx = destFiltered.length;
        }
        const newTarget = [...destFiltered];
        newTarget.splice(insertIdx, 0, moved);
        await persistColumnOrder(activeCol, sourceWithout);
        await persistColumnOrder(targetCol, newTarget);
      }
      await loadBoards();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Reorder failed');
      await loadBoards();
    } finally {
      setBusy(null);
    }
  };

  const deleteCard = async (cardId: string) => {
    if (!userId) return;
    if (!window.confirm('Delete this activity card?')) return;
    setBusy(`del:${cardId}`);
    try {
      const auth = await missionControlApiAuthHeaders();
      const res = await fetch(
        `/api/trainer/clients/${encodeURIComponent(userId)}/weekly-board/cards/${encodeURIComponent(cardId)}`,
        { method: 'DELETE', credentials: 'include', headers: { ...auth } }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof body.error === 'string' ? body.error : 'Could not delete');
        return;
      }
      setDetailCard((d) => (d?.id === cardId ? null : d));
      await loadBoards();
    } finally {
      setBusy(null);
    }
  };

  const saveDetailModal = async () => {
    if (!detailCard) return;
    const t = modalTitle.trim();
    if (!t) {
      window.alert('Title required');
      return;
    }
    const dur = modalDuration.trim() ? parseInt(modalDuration, 10) : null;
    const ok = await patchCard(detailCard.id, {
      title: t,
      notes: modalNotes.trim() || null,
      activityType: modalActivityType.trim() || 'activity',
      durationMinutes: dur != null && Number.isFinite(dur) ? dur : null,
    });
    if (ok) setDetailCard(null);
  };

  const shiftCalendarWeek = (deltaWeeks: number) => {
    setCalendarWeekStart((prev) => {
      const d = new Date(prev + 'T12:00:00');
      d.setDate(d.getDate() + deltaWeeks * 7);
      return mondayOfWeekContainingLocal(d);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-black/20 p-4 backdrop-blur-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <LayoutGrid className="mt-0.5 h-6 w-6 shrink-0 text-orange-light" />
          <div>
            <h2 className="font-heading text-xl font-bold">Weekly activity</h2>
            <p className="mt-1 text-sm text-white/60">
              Plan activities by day. Drag cards by the grip to reorder or move days. Click a card for
              full details. Clients on your program roster can view the board and mark items done or
              skipped. Weeks start on Monday (local).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase text-white/45">View</span>
          <button
            type="button"
            onClick={() => setViewMode('calendar_week')}
            className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold uppercase ${
              viewMode === 'calendar_week'
                ? 'bg-orange-light/20 text-orange-light'
                : 'border border-white/15 text-white/60 hover:bg-white/5'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <CalendarRange className="h-3.5 w-3.5" />
              Calendar week
            </span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('rolling_7')}
            className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold uppercase ${
              viewMode === 'rolling_7'
                ? 'bg-orange-light/20 text-orange-light'
                : 'border border-white/15 text-white/60 hover:bg-white/5'
            }`}
          >
            Rolling 7 days
          </button>
        </div>
      </div>

      {viewMode === 'calendar_week' && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => shiftCalendarWeek(-1)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            ← Prev week
          </button>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <span className="font-mono text-[10px] uppercase text-white/45">Week starts</span>
            <input
              type="date"
              value={calendarWeekStart}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setCalendarWeekStart(mondayOfWeekContainingLocal(new Date(v + 'T12:00:00')));
              }}
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-white"
            />
          </label>
          <button
            type="button"
            onClick={() => shiftCalendarWeek(1)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            Next week →
          </button>
        </div>
      )}

      {viewMode === 'rolling_7' && (
        <p className="text-sm text-white/50">
          Showing the last seven calendar days ending today. Activities may load from two ISO weeks if
          the range crosses a Monday boundary; dragging across that boundary updates the stored week
          automatically.
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wide text-white/50">Add card</h3>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase text-white/50">Day</label>
            <select
              value={newDayIndex}
              onChange={(e) => setNewDayIndex(parseInt(e.target.value, 10))}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            >
              {columnDates.map((d, i) => (
                <option key={d} value={i}>
                  {formatColumnTitle(d)}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[10rem] flex-1">
            <label className="mb-1 block font-mono text-[10px] uppercase text-white/50">Title</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Easy run"
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase text-white/50">Type</label>
            <input
              value={newActivityType}
              onChange={(e) => setNewActivityType(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white lg:w-28"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase text-white/50">Minutes</label>
            <input
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              inputMode="numeric"
              placeholder="—"
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white lg:w-20"
            />
          </div>
          <div className="min-w-[12rem] flex-[2]">
            <label className="mb-1 block font-mono text-[10px] uppercase text-white/50">Notes</label>
            <input
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            type="button"
            disabled={!!busy || !newTitle.trim() || loading}
            onClick={() => void createCard()}
            className="rounded-lg border border-orange-light/40 bg-orange-light/10 px-4 py-2 font-mono text-xs font-bold uppercase text-orange-light hover:bg-orange-light/20 disabled:opacity-40"
          >
            {busy === 'create' ? '…' : 'Add'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-white/50">Loading board…</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={(e) => void handleDragEnd(e)}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
            {columnDates.map((dateStr) => (
              <WeekColumn
                key={dateStr}
                dateStr={dateStr}
                cards={cardsByDate[dateStr] ?? []}
                busy={!!busy}
                onOpenDetail={setDetailCard}
              />
            ))}
          </div>
        </DndContext>
      )}

      {detailCard ? (
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/70"
            aria-hidden
            onClick={() => setDetailCard(null)}
          />
          <div className="fixed inset-0 z-[101] flex items-end justify-center p-4 pointer-events-none sm:items-center">
            <div
              className="pointer-events-auto flex max-h-[min(560px,90vh)] w-full max-w-lg flex-col rounded-xl border border-white/15 bg-bg-dark shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="week-card-detail-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h2
                  id="week-card-detail-title"
                  className="font-heading text-lg font-bold text-white"
                >
                  Activity
                </h2>
                <button
                  type="button"
                  onClick={() => setDetailCard(null)}
                  className="rounded-lg px-2 py-1 font-mono text-xs text-white/60 hover:bg-white/10 hover:text-white"
                >
                  Close
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm text-white/80">
                <p className="font-mono text-[10px] uppercase text-white/45">
                  Scheduled · {formatColumnTitle(detailCard.scheduledDate)} ({detailCard.scheduledDate})
                </p>
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase text-white/50">
                    Title
                  </label>
                  <input
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase text-white/50">
                    Type
                  </label>
                  <input
                    value={modalActivityType}
                    onChange={(e) => setModalActivityType(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase text-white/50">
                    Minutes
                  </label>
                  <input
                    value={modalDuration}
                    onChange={(e) => setModalDuration(e.target.value)}
                    inputMode="numeric"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase text-white/50">
                    Notes
                  </label>
                  <textarea
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    rows={3}
                    className="w-full resize-y rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <span className="mb-2 block font-mono text-[10px] uppercase text-white/50">
                    Status
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(['planned', 'done', 'skipped'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={!!busy}
                        onClick={() => void patchCard(detailCard.id, { status: s })}
                        className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold uppercase ${
                          detailCard.status === s
                            ? 'border-orange-light/50 bg-orange-light/20 text-orange-light'
                            : 'border-white/15 text-white/70 hover:bg-white/5'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void deleteCard(detailCard.id)}
                  className="rounded-lg border border-red-500/40 px-3 py-2 font-mono text-xs font-bold uppercase text-red-300 hover:bg-red-500/10"
                >
                  Delete
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void saveDetailModal()}
                  className="rounded-lg border border-orange-light/40 bg-orange-light/15 px-4 py-2 font-mono text-xs font-bold uppercase text-orange-light hover:bg-orange-light/25"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default PerformanceLabWeekSection;
