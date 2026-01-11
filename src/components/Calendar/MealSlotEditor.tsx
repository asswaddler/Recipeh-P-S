import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { DayOfWeek, MealSlot, Recipe } from '../../types';
import { Modal, SearchInput, Button } from '../common';
import './MealSlotEditor.css';

interface MealSlotEditorProps {
  day: DayOfWeek;
  mealSlot: MealSlot;
  onClose: () => void;
}

export function MealSlotEditor({ day, mealSlot, onClose }: MealSlotEditorProps) {
  const { state, actions } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const currentEntry = actions.getMealForSlot(day, mealSlot);
  const currentRecipe = currentEntry?.recipeId
    ? actions.getRecipeById(currentEntry.recipeId)
    : null;
  const [servings, setServings] = useState<number | undefined>(
    currentEntry?.servingsOverride ?? currentRecipe?.servingsDefault
  );

  // Filter recipes by search query
  const filteredRecipes = useMemo(() => {
    if (!searchQuery) return state.recipes;

    const query = searchQuery.toLowerCase();
    return state.recipes.filter(
      recipe =>
        recipe.name.toLowerCase().includes(query) ||
        recipe.category?.toLowerCase().includes(query)
    );
  }, [state.recipes, searchQuery]);

  // Group recipes by category
  const groupedRecipes = useMemo(() => {
    const groups: Record<string, Recipe[]> = {};

    filteredRecipes.forEach(recipe => {
      const category = recipe.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(recipe);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRecipes]);

  const handleSelectRecipe = (recipe: Recipe) => {
    actions.setMeal(day, mealSlot, recipe.recipeId, servings);
    onClose();
  };

  const handleClearRecipe = () => {
    actions.setMeal(day, mealSlot, null);
    onClose();
  };

  const handleServingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setServings(isNaN(value) || value < 1 ? undefined : value);
  };

  const handleUpdateServings = () => {
    if (currentEntry?.recipeId && servings) {
      actions.setServingsOverride(day, mealSlot, servings);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`${day} - ${mealSlot}`}
      size="large"
    >
      <div className="meal-slot-editor">
        {currentRecipe && (
          <div className="current-recipe">
            <div className="current-recipe-info">
              <span className="current-label">Current:</span>
              <span className="current-name">{currentRecipe.name}</span>
            </div>
            <div className="servings-editor">
              <label htmlFor="servings">Servings:</label>
              <input
                id="servings"
                type="number"
                min="1"
                max="20"
                value={servings ?? ''}
                onChange={handleServingsChange}
                className="servings-input"
              />
              <Button
                size="small"
                onClick={handleUpdateServings}
                disabled={servings === currentEntry?.servingsOverride}
              >
                Update
              </Button>
            </div>
            <Button variant="danger" size="small" onClick={handleClearRecipe}>
              Remove Recipe
            </Button>
          </div>
        )}

        <div className="recipe-search">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search recipes..."
            autoFocus
          />
        </div>

        <div className="recipe-list">
          {groupedRecipes.length === 0 ? (
            <div className="no-recipes">
              {searchQuery ? 'No recipes found' : 'No recipes available'}
            </div>
          ) : (
            groupedRecipes.map(([category, recipes]) => (
              <div key={category} className="recipe-group">
                <h3 className="recipe-group-title">{category}</h3>
                <div className="recipe-group-items">
                  {recipes.map(recipe => (
                    <button
                      key={recipe.recipeId}
                      className={`recipe-item ${currentRecipe?.recipeId === recipe.recipeId ? 'selected' : ''}`}
                      onClick={() => handleSelectRecipe(recipe)}
                    >
                      <span className="recipe-item-name">{recipe.name}</span>
                      <span className="recipe-item-servings">
                        {recipe.servingsDefault} servings
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
