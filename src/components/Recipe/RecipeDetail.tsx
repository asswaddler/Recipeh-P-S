import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { scaleIngredient, formatIngredient } from '../../utils/ingredientParser';
import { Button } from '../common';
import './RecipeDetail.css';

interface LocationState {
  fromPlan?: boolean;
  day?: string;
  mealSlot?: string;
  servingsOverride?: number;
}

export function RecipeDetail() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { actions } = useApp();

  const locationState = location.state as LocationState | null;
  const recipe = recipeId ? actions.getRecipeById(recipeId) : null;

  const defaultServings = locationState?.servingsOverride ?? recipe?.servingsDefault ?? 4;
  const [servings, setServings] = useState(defaultServings);

  useEffect(() => {
    // Update servings if coming from plan with override
    if (locationState?.servingsOverride) {
      setServings(locationState.servingsOverride);
    } else if (recipe?.servingsDefault) {
      setServings(recipe.servingsDefault);
    }
  }, [recipe, locationState?.servingsOverride]);

  const scaledIngredients = useMemo(() => {
    if (!recipe) return [];

    return recipe.ingredients.map(ingredient =>
      scaleIngredient(ingredient, recipe.servingsDefault, servings)
    );
  }, [recipe, servings]);

  const handleBack = () => {
    if (locationState?.fromPlan) {
      navigate('/');
    } else {
      navigate(-1);
    }
  };

  const incrementServings = () => setServings(s => Math.min(s + 1, 20));
  const decrementServings = () => setServings(s => Math.max(s - 1, 1));

  if (!recipe) {
    return (
      <div className="recipe-detail-page">
        <div className="recipe-not-found">
          <h2>Recipe not found</h2>
          <Button onClick={() => navigate('/')}>Back to Meal Plan</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="recipe-detail-page">
      <header className="recipe-detail-header">
        <button className="back-button" onClick={handleBack} aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="recipe-title-section">
          <h1 className="recipe-title">{recipe.name}</h1>
          {recipe.category && (
            <span className="recipe-category-badge">{recipe.category}</span>
          )}
        </div>
      </header>

      {recipe.description && (
        <p className="recipe-description">{recipe.description}</p>
      )}

      {locationState?.fromPlan && locationState.day && locationState.mealSlot && (
        <div className="plan-context">
          Viewing for {locationState.day} - {locationState.mealSlot}
        </div>
      )}

      <section className="recipe-section">
        <div className="section-header">
          <h2>Ingredients</h2>
          <div className="servings-control">
            <button
              className="servings-btn"
              onClick={decrementServings}
              disabled={servings <= 1}
              aria-label="Decrease servings"
            >
              −
            </button>
            <span className="servings-value">
              {servings} {servings === 1 ? 'serving' : 'servings'}
            </span>
            <button
              className="servings-btn"
              onClick={incrementServings}
              disabled={servings >= 20}
              aria-label="Increase servings"
            >
              +
            </button>
          </div>
        </div>

        {servings !== recipe.servingsDefault && (
          <p className="scaling-note">
            Scaled from {recipe.servingsDefault} servings
          </p>
        )}

        <ul className="ingredients-list">
          {scaledIngredients.map((ingredient, index) => (
            <li key={index} className="ingredient-item">
              {formatIngredient(ingredient)}
            </li>
          ))}
        </ul>

        {recipe.ingredientNotes && (
          <p className="ingredient-notes">{recipe.ingredientNotes}</p>
        )}
      </section>

      <section className="recipe-section">
        <h2>Instructions</h2>
        <ol className="instructions-list">
          {recipe.instructions.map((step, index) => (
            <li key={index} className="instruction-step">
              <span className="step-number">{index + 1}</span>
              <span className="step-text">{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
