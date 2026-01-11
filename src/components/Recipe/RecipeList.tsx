import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import type { Recipe } from '../../types';
import { SearchInput } from '../common';
import './RecipeList.css';

export function RecipeList() {
  const navigate = useNavigate();
  const { state } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter recipes by search query
  const filteredRecipes = useMemo(() => {
    if (!searchQuery) return state.recipes;

    const query = searchQuery.toLowerCase();
    return state.recipes.filter(
      recipe =>
        recipe.name.toLowerCase().includes(query) ||
        recipe.category?.toLowerCase().includes(query) ||
        recipe.description?.toLowerCase().includes(query)
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

  const handleRecipeClick = (recipeId: string) => {
    navigate(`/recipe/${recipeId}`);
  };

  return (
    <div className="recipe-list-page">
      <div className="recipe-list-header">
        <h1>All Recipes</h1>
        <span className="recipe-count">{state.recipes.length} recipes</span>
      </div>

      <div className="recipe-search-wrapper">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search recipes..."
        />
      </div>

      {state.isLoading ? (
        <div className="recipe-list-loading">
          <div className="loading-spinner" />
          <span>Loading recipes...</span>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="recipe-list-empty">
          {searchQuery ? (
            <>
              <p>No recipes found for "{searchQuery}"</p>
              <button onClick={() => setSearchQuery('')}>Clear search</button>
            </>
          ) : (
            <p>No recipes available</p>
          )}
        </div>
      ) : (
        <div className="recipe-groups">
          {groupedRecipes.map(([category, recipes]) => (
            <div key={category} className="recipe-category">
              <h2 className="category-title">{category}</h2>
              <div className="recipe-cards">
                {recipes.map(recipe => (
                  <button
                    key={recipe.recipeId}
                    className="recipe-card"
                    onClick={() => handleRecipeClick(recipe.recipeId)}
                  >
                    <div className="recipe-card-content">
                      <h3 className="recipe-card-title">{recipe.name}</h3>
                      {recipe.description && (
                        <p className="recipe-card-description">{recipe.description}</p>
                      )}
                      <div className="recipe-card-meta">
                        <span className="recipe-card-servings">
                          {recipe.servingsDefault} servings
                        </span>
                        <span className="recipe-card-ingredients">
                          {recipe.ingredients.length} ingredients
                        </span>
                      </div>
                    </div>
                    <span className="recipe-card-arrow">→</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
