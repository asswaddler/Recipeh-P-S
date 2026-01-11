import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import type { DayOfWeek, MealSlot } from '../../types';
import './DayCard.css';

interface DayCardProps {
  day: DayOfWeek;
  date: Date;
  label: string;
  isToday: boolean;
  onSlotClick: (mealSlot: MealSlot) => void;
}

const MEAL_SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner'];

export function DayCard({ day, date: _date, label, isToday, onSlotClick }: DayCardProps) {
  const navigate = useNavigate();
  const { actions } = useApp();

  const renderMealSlot = (mealSlot: MealSlot) => {
    const entry = actions.getMealForSlot(day, mealSlot);
    const recipe = entry?.recipeId ? actions.getRecipeById(entry.recipeId) : null;

    const handleRecipeClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (recipe) {
        navigate(`/recipe/${recipe.recipeId}`, {
          state: { fromPlan: true, day, mealSlot, servingsOverride: entry?.servingsOverride }
        });
      }
    };

    return (
      <div
        key={mealSlot}
        className={`meal-slot ${recipe ? 'has-recipe' : 'empty'}`}
        onClick={() => onSlotClick(mealSlot)}
      >
        <span className="meal-slot-label">{mealSlot}</span>
        {recipe ? (
          <div className="meal-slot-recipe" onClick={handleRecipeClick}>
            <span className="recipe-name">{recipe.name}</span>
            {entry?.servingsOverride && (
              <span className="servings-badge">{entry.servingsOverride} servings</span>
            )}
          </div>
        ) : (
          <span className="meal-slot-empty">+ Add</span>
        )}
      </div>
    );
  };

  return (
    <div className={`day-card ${isToday ? 'is-today' : ''}`}>
      <div className="day-header">
        <span className="day-label">{label}</span>
        {isToday && <span className="today-indicator">Today</span>}
      </div>
      <div className="meal-slots">
        {MEAL_SLOTS.map(renderMealSlot)}
      </div>
    </div>
  );
}
