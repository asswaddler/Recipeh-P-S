import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { DayOfWeek, MealSlot } from '../../types';
import { getWeekDays, getWeekDisplayRange, formatDayShort, isCurrentWeek } from '../../utils/dateUtils';
import { DayCard } from './DayCard';
import { MealSlotEditor } from './MealSlotEditor';
import { Button } from '../common';
import './WeeklyCalendar.css';

export function WeeklyCalendar() {
  const { state, actions } = useApp();
  const [selectedSlot, setSelectedSlot] = useState<{
    day: DayOfWeek;
    mealSlot: MealSlot;
  } | null>(null);

  const weekDays = getWeekDays(state.currentWeekId);
  const weekRange = getWeekDisplayRange(state.currentWeekId);
  const isCurrent = isCurrentWeek(state.currentWeekId);

  const handleSlotClick = (day: DayOfWeek, mealSlot: MealSlot) => {
    setSelectedSlot({ day, mealSlot });
  };

  const handleCloseEditor = () => {
    setSelectedSlot(null);
  };

  const handleSave = async () => {
    const success = await actions.saveCurrentPlan();
    if (success) {
      // Could show toast here
    }
  };

  return (
    <div className="weekly-calendar">
      <div className="calendar-header">
        <button
          className="week-nav-btn"
          onClick={() => actions.navigateWeek('prev')}
          aria-label="Previous week"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="week-info">
          <span className="week-id">{state.currentWeekId}</span>
          <span className="week-range">{weekRange}</span>
          {isCurrent && <span className="current-week-badge">This Week</span>}
        </div>

        <button
          className="week-nav-btn"
          onClick={() => actions.navigateWeek('next')}
          aria-label="Next week"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {state.isLoading ? (
        <div className="calendar-loading">
          <div className="loading-spinner" />
          <span>Loading meal plan...</span>
        </div>
      ) : state.error ? (
        <div className="calendar-error">
          <p>{state.error}</p>
          <Button onClick={() => actions.loadData(true)}>Retry</Button>
        </div>
      ) : (
        <>
          <div className="days-grid">
            {weekDays.map(({ day, date, isToday }) => (
              <DayCard
                key={day}
                day={day}
                date={date}
                label={formatDayShort(date)}
                isToday={isToday}
                onSlotClick={(mealSlot) => handleSlotClick(day, mealSlot)}
              />
            ))}
          </div>

          <div className="calendar-actions">
            <Button
              variant="ghost"
              onClick={() => actions.loadData(true)}
              disabled={state.isLoading}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={state.isSaving}
              disabled={!state.hasUnsavedChanges}
            >
              {state.hasUnsavedChanges ? 'Save Plan' : 'Saved'}
            </Button>
          </div>

          {state.saveSuccess === true && (
            <div className="save-feedback success">Plan saved successfully!</div>
          )}
          {state.saveSuccess === false && (
            <div className="save-feedback error">Failed to save plan</div>
          )}
        </>
      )}

      {selectedSlot && (
        <MealSlotEditor
          day={selectedSlot.day}
          mealSlot={selectedSlot.mealSlot}
          onClose={handleCloseEditor}
        />
      )}
    </div>
  );
}
