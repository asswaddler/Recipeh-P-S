import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { GroceryItem, ParsedIngredient } from '../../types';
import {
  scaleIngredient,
  formatIngredient,
  canCombineIngredients,
  combineIngredients
} from '../../utils/ingredientParser';
import { Button } from '../common';
import { AddItemModal } from './AddItemModal';
import './GroceryList.css';

interface AggregatedIngredient {
  key: string;
  ingredient: ParsedIngredient;
  sources: string[];
}

export function GroceryList() {
  const { state, actions } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [hideChecked, setHideChecked] = useState(false);

  // Generate grocery list from weekly plan
  const groceryItems = useMemo(() => {
    const ingredientMap = new Map<string, AggregatedIngredient>();

    // Process each meal in the plan
    state.weeklyPlan.entries.forEach(entry => {
      if (!entry.recipeId) return;

      const recipe = actions.getRecipeById(entry.recipeId);
      if (!recipe) return;

      const servings = entry.servingsOverride ?? recipe.servingsDefault;

      recipe.ingredients.forEach(ingredient => {
        // Scale the ingredient
        const scaled = scaleIngredient(ingredient, recipe.servingsDefault, servings);

        // Create a key for aggregation
        const ingredientKey = `${scaled.name.toLowerCase()}-${scaled.unit || 'unit'}`;

        const existing = ingredientMap.get(ingredientKey);

        if (existing) {
          // Try to combine
          if (canCombineIngredients(existing.ingredient, scaled)) {
            try {
              existing.ingredient = combineIngredients(existing.ingredient, scaled);
              if (!existing.sources.includes(recipe.name)) {
                existing.sources.push(recipe.name);
              }
            } catch {
              // Can't combine, add as separate entry
              const newKey = `${ingredientKey}-${Date.now()}`;
              ingredientMap.set(newKey, {
                key: newKey,
                ingredient: scaled,
                sources: [recipe.name]
              });
            }
          } else {
            // Different units, add as separate entry
            const newKey = `${ingredientKey}-${Date.now()}`;
            ingredientMap.set(newKey, {
              key: newKey,
              ingredient: scaled,
              sources: [recipe.name]
            });
          }
        } else {
          ingredientMap.set(ingredientKey, {
            key: ingredientKey,
            ingredient: scaled,
            sources: [recipe.name]
          });
        }
      });
    });

    // Convert to GroceryItem array
    const items: GroceryItem[] = Array.from(ingredientMap.values()).map(({ key, ingredient, sources }) => ({
      id: `recipe-${key}`,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      displayText: formatIngredient(ingredient),
      sources,
      isManual: false
    }));

    // Add manual additions
    state.manualAdditions.forEach(addition => {
      items.push({
        id: addition.id,
        name: addition.itemName,
        quantity: null,
        unit: null,
        displayText: addition.quantity
          ? `${addition.quantity} ${addition.itemName}`
          : addition.itemName,
        sources: ['Manual'],
        isManual: true
      });
    });

    // Sort alphabetically
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [state.weeklyPlan.entries, state.manualAdditions, actions]);

  const visibleItems = useMemo(() => {
    if (hideChecked) {
      return groceryItems.filter(item => !state.checkedGroceryItems.has(item.id));
    }
    return groceryItems;
  }, [groceryItems, hideChecked, state.checkedGroceryItems]);

  const checkedCount = groceryItems.filter(item =>
    state.checkedGroceryItems.has(item.id)
  ).length;

  const handleToggleItem = (id: string) => {
    actions.toggleGroceryItem(id);
  };

  const handleRemoveManual = (id: string) => {
    actions.removeManualItem(id);
  };

  return (
    <div className="grocery-list-page">
      <div className="grocery-header">
        <h1>Grocery List</h1>
        <span className="grocery-week">{state.currentWeekId}</span>
      </div>

      <div className="grocery-actions">
        <Button variant="secondary" onClick={() => setShowAddModal(true)}>
          + Add Item
        </Button>
        <Button
          variant="ghost"
          onClick={() => setHideChecked(!hideChecked)}
        >
          {hideChecked ? 'Show Checked' : 'Hide Checked'}
        </Button>
      </div>

      {checkedCount > 0 && (
        <div className="grocery-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(checkedCount / groceryItems.length) * 100}%` }}
            />
          </div>
          <span className="progress-text">
            {checkedCount} of {groceryItems.length} items checked
          </span>
        </div>
      )}

      {visibleItems.length === 0 ? (
        <div className="grocery-empty">
          {groceryItems.length === 0 ? (
            <>
              <p>No items in your grocery list</p>
              <p className="grocery-empty-hint">
                Add recipes to your meal plan to generate a shopping list
              </p>
            </>
          ) : (
            <p>All items checked off!</p>
          )}
        </div>
      ) : (
        <ul className="grocery-items">
          {visibleItems.map(item => (
            <li
              key={item.id}
              className={`grocery-item ${state.checkedGroceryItems.has(item.id) ? 'checked' : ''}`}
            >
              <button
                className="grocery-checkbox"
                onClick={() => handleToggleItem(item.id)}
                aria-label={state.checkedGroceryItems.has(item.id) ? 'Uncheck item' : 'Check item'}
              >
                {state.checkedGroceryItems.has(item.id) && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>

              <div className="grocery-item-content">
                <span className="grocery-item-text">{item.displayText}</span>
                <span className="grocery-item-sources">
                  {item.sources.join(', ')}
                </span>
              </div>

              {item.isManual && (
                <button
                  className="grocery-remove"
                  onClick={() => handleRemoveManual(item.id)}
                  aria-label="Remove item"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {checkedCount > 0 && (
        <div className="grocery-footer">
          <Button
            variant="ghost"
            onClick={actions.clearCheckedItems}
          >
            Clear All Checked
          </Button>
        </div>
      )}

      {showAddModal && (
        <AddItemModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
