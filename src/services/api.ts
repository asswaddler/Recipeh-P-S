import type {
  Recipe,
  IngredientsCatalogue,
  MealPlanEntry,
  SavePlanResponse,
  ManualGroceryAddition
} from '../types';
import { parseIngredients } from '../utils/ingredientParser';

// ============================================
// Configuration
// ============================================

interface ApiConfig {
  baseUrl: string;
  endpoints: {
    getData: string;
    savePlan: string;
    saveManualAdditions?: string;
  };
}

// Default config - will be overridden by environment or runtime config
// Note: baseUrl should be the full Apps Script URL ending in /exec
// endpoints are not used when baseUrl already contains the full path
let apiConfig: ApiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  endpoints: {
    getData: import.meta.env.VITE_API_GET_ENDPOINT || '',
    savePlan: import.meta.env.VITE_API_SAVE_ENDPOINT || '',
    saveManualAdditions: import.meta.env.VITE_API_SAVE_MANUAL_ENDPOINT || undefined
  }
};

export function configureApi(config: Partial<ApiConfig>) {
  apiConfig = { ...apiConfig, ...config };
}

// ============================================
// Cache Management
// ============================================

const CACHE_KEYS = {
  RECIPES: 'recipeh_recipes',
  CATALOGUE: 'recipeh_catalogue',
  PLAN_PREFIX: 'recipeh_plan_',
  MANUAL_PREFIX: 'recipeh_manual_',
  TIMESTAMPS: 'recipeh_timestamps'
};

const CACHE_EXPIRY = {
  RECIPES: 24 * 60 * 60 * 1000, // 24 hours
  CATALOGUE: 24 * 60 * 60 * 1000, // 24 hours
  PLAN: 5 * 60 * 1000 // 5 minutes - plans should be fresher
};

interface CacheTimestamps {
  recipes?: number;
  catalogue?: number;
  plans: Record<string, number>;
}

function getTimestamps(): CacheTimestamps {
  try {
    const data = localStorage.getItem(CACHE_KEYS.TIMESTAMPS);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('Failed to read cache timestamps:', e);
  }
  return { plans: {} };
}

function setTimestamps(timestamps: CacheTimestamps) {
  try {
    localStorage.setItem(CACHE_KEYS.TIMESTAMPS, JSON.stringify(timestamps));
  } catch (e) {
    console.warn('Failed to save cache timestamps:', e);
  }
}

function isCacheValid(key: 'recipes' | 'catalogue' | 'plan', weekId?: string): boolean {
  const timestamps = getTimestamps();
  const now = Date.now();

  if (key === 'recipes' && timestamps.recipes) {
    return now - timestamps.recipes < CACHE_EXPIRY.RECIPES;
  }
  if (key === 'catalogue' && timestamps.catalogue) {
    return now - timestamps.catalogue < CACHE_EXPIRY.CATALOGUE;
  }
  if (key === 'plan' && weekId && timestamps.plans[weekId]) {
    return now - timestamps.plans[weekId] < CACHE_EXPIRY.PLAN;
  }
  return false;
}

function getCachedData<T>(key: string): T | null {
  try {
    const data = localStorage.getItem(key);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn(`Failed to read cached data for ${key}:`, e);
  }
  return null;
}

function setCachedData<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Failed to cache data for ${key}:`, e);
  }
}

export function clearCache() {
  Object.values(CACHE_KEYS).forEach(key => {
    if (typeof key === 'string' && !key.includes('PREFIX')) {
      localStorage.removeItem(key);
    }
  });
  // Clear all plan and manual caches
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_KEYS.PLAN_PREFIX) || key?.startsWith(CACHE_KEYS.MANUAL_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}

// ============================================
// Data Transformation
// ============================================

interface RawRecipe {
  RecipeID?: string;
  recipeId?: string;
  Name?: string;
  name?: string;
  Description?: string;
  description?: string;
  Category?: string;
  category?: string;
  ServingsDefault?: number | string;
  servingsDefault?: number | string;
  Ingredients?: string;
  ingredients?: string;
  IngredientNotes?: string;
  ingredientNotes?: string;
  Instructions?: string;
  instructions?: string;
}

function transformRecipe(raw: RawRecipe): Recipe {
  const ingredientsText = raw.Ingredients || raw.ingredients || '';
  const instructionsText = raw.Instructions || raw.instructions || '';

  return {
    recipeId: raw.RecipeID || raw.recipeId || '',
    name: raw.Name || raw.name || 'Unnamed Recipe',
    description: raw.Description || raw.description,
    category: raw.Category || raw.category,
    servingsDefault: parseInt(String(raw.ServingsDefault || raw.servingsDefault || '4'), 10) || 4,
    ingredients: parseIngredients(ingredientsText),
    ingredientNotes: raw.IngredientNotes || raw.ingredientNotes,
    instructions: instructionsText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean),
    rawIngredients: ingredientsText
  };
}

interface RawCatalogue {
  [majorCategory: string]: {
    [minorCategory: string]: Array<{ id?: string; name: string }>;
  };
}

function transformCatalogue(raw: RawCatalogue): IngredientsCatalogue {
  const catalogue: IngredientsCatalogue = {
    Fresh: {},
    Pantry: {},
    Freezer: {}
  };

  for (const [major, minorCategories] of Object.entries(raw)) {
    if (major in catalogue) {
      const majorKey = major as keyof IngredientsCatalogue;
      for (const [minor, items] of Object.entries(minorCategories)) {
        catalogue[majorKey][minor] = items.map((item, idx) => ({
          id: item.id || `${major}-${minor}-${idx}`,
          name: item.name,
          majorCategory: majorKey,
          minorCategory: minor
        }));
      }
    }
  }

  return catalogue;
}

interface RawMealEntry {
  WeekID?: string;
  weekId?: string;
  Day?: string;
  day?: string;
  MealSlot?: string;
  mealSlot?: string;
  RecipeID?: string;
  recipeId?: string;
  ServingsOverride?: number | string;
  servingsOverride?: number | string;
}

function transformMealEntry(raw: RawMealEntry): MealPlanEntry {
  const servingsOverride = raw.ServingsOverride || raw.servingsOverride;
  return {
    weekId: raw.WeekID || raw.weekId || '',
    day: (raw.Day || raw.day || 'Mon') as MealPlanEntry['day'],
    mealSlot: (raw.MealSlot || raw.mealSlot || 'Dinner') as MealPlanEntry['mealSlot'],
    recipeId: raw.RecipeID || raw.recipeId || null,
    servingsOverride: servingsOverride ? parseInt(String(servingsOverride), 10) : undefined
  };
}

// ============================================
// API Functions
// ============================================

export async function fetchData(
  weekId: string,
  options: { forceRefresh?: boolean; skipCache?: boolean } = {}
): Promise<{
  recipes: Recipe[];
  catalogue: IngredientsCatalogue;
  weeklyPlan: MealPlanEntry[];
}> {
  const { forceRefresh = false, skipCache = false } = options;

  // Check cache first
  let recipes: Recipe[] | null = null;
  let catalogue: IngredientsCatalogue | null = null;
  let weeklyPlan: MealPlanEntry[] | null = null;

  if (!forceRefresh && !skipCache) {
    if (isCacheValid('recipes')) {
      recipes = getCachedData<Recipe[]>(CACHE_KEYS.RECIPES);
    }
    if (isCacheValid('catalogue')) {
      catalogue = getCachedData<IngredientsCatalogue>(CACHE_KEYS.CATALOGUE);
    }
    if (isCacheValid('plan', weekId)) {
      weeklyPlan = getCachedData<MealPlanEntry[]>(CACHE_KEYS.PLAN_PREFIX + weekId);
    }
  }

  // If all data is cached and valid, return it
  if (recipes && catalogue && weeklyPlan) {
    return { recipes, catalogue, weeklyPlan };
  }

  // Fetch from API
  // Build URL: use baseUrl directly if endpoint is empty, otherwise append endpoint
  const baseUrl = apiConfig.baseUrl;
  const endpoint = apiConfig.endpoints.getData;
  const fullUrl = endpoint ? `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}` : baseUrl;
  const url = new URL(fullUrl);
  url.searchParams.set('action', 'getData');
  url.searchParams.set('weekId', weekId);

  // Specify what we need
  if (!recipes) url.searchParams.set('includeRecipes', 'true');
  if (!catalogue) url.searchParams.set('includeCatalogue', 'true');
  url.searchParams.set('includePlan', 'true'); // Always get fresh plan

  // Note: Do NOT include Content-Type header for GET requests
  // It triggers CORS preflight which Google Apps Script doesn't handle
  const response = await fetch(url.toString(), {
    method: 'GET',
    mode: 'cors',
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const timestamps = getTimestamps();
  const now = Date.now();

  // Transform and cache recipes
  if (data.recipes && (!recipes || forceRefresh)) {
    recipes = data.recipes.map(transformRecipe);
    setCachedData(CACHE_KEYS.RECIPES, recipes);
    timestamps.recipes = now;
  }

  // Transform and cache catalogue
  if (data.ingredientsCatalogue && (!catalogue || forceRefresh)) {
    catalogue = transformCatalogue(data.ingredientsCatalogue);
    setCachedData(CACHE_KEYS.CATALOGUE, catalogue);
    timestamps.catalogue = now;
  }

  // Transform and cache plan
  if (data.weeklyPlan) {
    weeklyPlan = data.weeklyPlan.map(transformMealEntry);
    setCachedData(CACHE_KEYS.PLAN_PREFIX + weekId, weeklyPlan);
    timestamps.plans[weekId] = now;
  }

  setTimestamps(timestamps);

  return {
    recipes: recipes || [],
    catalogue: catalogue || { Fresh: {}, Pantry: {}, Freezer: {} },
    weeklyPlan: weeklyPlan || []
  };
}

export async function savePlan(
  weekId: string,
  entries: MealPlanEntry[]
): Promise<SavePlanResponse> {
  // Build URL: use baseUrl directly if endpoint is empty, otherwise append endpoint
  const baseUrl = apiConfig.baseUrl;
  const endpoint = apiConfig.endpoints.savePlan;
  const fullUrl = endpoint ? `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}` : baseUrl;
  const url = new URL(fullUrl);

  // For POST to Google Apps Script, use text/plain to avoid CORS preflight
  const response = await fetch(url.toString(), {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain'
    },
    body: JSON.stringify({
      action: 'savePlan',
      weekId,
      entries
    })
  });

  if (!response.ok) {
    throw new Error(`Save failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  // Update cache with new plan
  if (result.success) {
    setCachedData(CACHE_KEYS.PLAN_PREFIX + weekId, entries);
    const timestamps = getTimestamps();
    timestamps.plans[weekId] = Date.now();
    setTimestamps(timestamps);
  }

  return result;
}

// ============================================
// Manual Additions (local storage with optional sync)
// ============================================

export function getManualAdditions(weekId: string): ManualGroceryAddition[] {
  return getCachedData<ManualGroceryAddition[]>(CACHE_KEYS.MANUAL_PREFIX + weekId) || [];
}

export function saveManualAdditions(weekId: string, additions: ManualGroceryAddition[]) {
  setCachedData(CACHE_KEYS.MANUAL_PREFIX + weekId, additions);
}

export async function syncManualAdditions(
  weekId: string,
  additions: ManualGroceryAddition[]
): Promise<boolean> {
  if (!apiConfig.endpoints.saveManualAdditions) {
    // No endpoint configured, just save locally
    saveManualAdditions(weekId, additions);
    return true;
  }

  try {
    const url = new URL(apiConfig.endpoints.saveManualAdditions, apiConfig.baseUrl);
    // For POST to Google Apps Script, use text/plain to avoid CORS preflight
    const response = await fetch(url.toString(), {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify({
        action: 'saveManualAdditions',
        weekId,
        additions
      })
    });

    if (response.ok) {
      saveManualAdditions(weekId, additions);
      return true;
    }
  } catch (e) {
    console.warn('Failed to sync manual additions:', e);
  }

  // Fall back to local storage
  saveManualAdditions(weekId, additions);
  return false;
}

// ============================================
// Demo/Mock Data (for development without backend)
// ============================================

export function useMockData(): boolean {
  return import.meta.env.VITE_USE_MOCK_DATA === 'true' || !apiConfig.baseUrl;
}

export function getMockData(weekId: string) {
  const mockRecipes: Recipe[] = [
    {
      recipeId: 'recipe-1',
      name: 'Spaghetti Carbonara',
      category: 'Pasta',
      servingsDefault: 4,
      ingredients: [
        { name: 'spaghetti', quantity: 400, unit: 'g', original: '400g spaghetti' },
        { name: 'pancetta', quantity: 200, unit: 'g', original: '200g pancetta' },
        { name: 'eggs', quantity: 4, unit: null, original: '4 eggs' },
        { name: 'parmesan cheese', quantity: 100, unit: 'g', original: '100g parmesan cheese' },
        { name: 'black pepper', quantity: null, unit: null, original: 'Black pepper to taste' }
      ],
      instructions: [
        'Cook spaghetti according to package directions.',
        'Fry pancetta until crispy.',
        'Beat eggs with grated parmesan.',
        'Combine hot pasta with pancetta, then quickly stir in egg mixture.',
        'Season with black pepper and serve immediately.'
      ]
    },
    {
      recipeId: 'recipe-2',
      name: 'Chicken Stir Fry',
      category: 'Asian',
      servingsDefault: 2,
      ingredients: [
        { name: 'chicken breast', quantity: 500, unit: 'g', original: '500g chicken breast' },
        { name: 'mixed vegetables', quantity: 300, unit: 'g', original: '300g mixed vegetables' },
        { name: 'soy sauce', quantity: 3, unit: 'tbsp', original: '3 tbsp soy sauce' },
        { name: 'garlic', quantity: 2, unit: 'clove', original: '2 cloves garlic' },
        { name: 'ginger', quantity: 1, unit: 'tbsp', original: '1 tbsp ginger' }
      ],
      instructions: [
        'Cut chicken into bite-sized pieces.',
        'Mince garlic and ginger.',
        'Stir-fry chicken until cooked through.',
        'Add vegetables and stir-fry for 3-4 minutes.',
        'Add soy sauce and toss to coat.'
      ]
    },
    {
      recipeId: 'recipe-3',
      name: 'Avocado Toast',
      category: 'Breakfast',
      servingsDefault: 1,
      ingredients: [
        { name: 'bread', quantity: 2, unit: 'slice', original: '2 slices bread' },
        { name: 'avocado', quantity: 1, unit: null, original: '1 avocado' },
        { name: 'lemon juice', quantity: 1, unit: 'tsp', original: '1 tsp lemon juice' },
        { name: 'salt', quantity: null, unit: null, original: 'Salt to taste' },
        { name: 'red pepper flakes', quantity: null, unit: null, original: 'Red pepper flakes (optional)' }
      ],
      instructions: [
        'Toast bread until golden.',
        'Mash avocado with lemon juice and salt.',
        'Spread on toast and top with red pepper flakes.'
      ]
    }
  ];

  // Mock catalogue matching the new column header format
  // Headers are like "Fresh - Meat (fresh)", "Pantry - Grains, rice, pasta & noodles", etc.
  const mockCatalogue: IngredientsCatalogue = {
    Fresh: {
      'Meat (fresh)': [
        { id: 'fresh-meat-1', name: 'Ground Beef', majorCategory: 'Fresh', minorCategory: 'Meat (fresh)' },
        { id: 'fresh-meat-2', name: 'Beef Steak', majorCategory: 'Fresh', minorCategory: 'Meat (fresh)' }
      ],
      'Poultry (fresh)': [
        { id: 'fresh-poultry-1', name: 'Chicken Breast', majorCategory: 'Fresh', minorCategory: 'Poultry (fresh)' },
        { id: 'fresh-poultry-2', name: 'Chicken Thighs', majorCategory: 'Fresh', minorCategory: 'Poultry (fresh)' }
      ],
      'Fresh vegetables': [
        { id: 'fresh-veg-1', name: 'Tomatoes', majorCategory: 'Fresh', minorCategory: 'Fresh vegetables' },
        { id: 'fresh-veg-2', name: 'Onions', majorCategory: 'Fresh', minorCategory: 'Fresh vegetables' },
        { id: 'fresh-veg-3', name: 'Garlic', majorCategory: 'Fresh', minorCategory: 'Fresh vegetables' }
      ],
      'Fresh fruit': [
        { id: 'fresh-fruit-1', name: 'Oranges', majorCategory: 'Fresh', minorCategory: 'Fresh fruit' },
        { id: 'fresh-fruit-2', name: 'Apples', majorCategory: 'Fresh', minorCategory: 'Fresh fruit' }
      ],
      'Dairy & dips': [
        { id: 'fresh-dairy-1', name: 'Milk', majorCategory: 'Fresh', minorCategory: 'Dairy & dips' },
        { id: 'fresh-dairy-2', name: 'Butter', majorCategory: 'Fresh', minorCategory: 'Dairy & dips' }
      ]
    },
    Pantry: {
      'Grains, rice, pasta & noodles': [
        { id: 'pantry-pasta-1', name: 'Spaghetti', majorCategory: 'Pantry', minorCategory: 'Grains, rice, pasta & noodles' },
        { id: 'pantry-pasta-2', name: 'Rice', majorCategory: 'Pantry', minorCategory: 'Grains, rice, pasta & noodles' }
      ],
      'Tinned goods': [
        { id: 'pantry-tinned-1', name: 'Diced Tomatoes', majorCategory: 'Pantry', minorCategory: 'Tinned goods' },
        { id: 'pantry-tinned-2', name: 'Coconut Milk', majorCategory: 'Pantry', minorCategory: 'Tinned goods' }
      ],
      'Spices, seasoning & stock': [
        { id: 'pantry-spice-1', name: 'Black Pepper', majorCategory: 'Pantry', minorCategory: 'Spices, seasoning & stock' },
        { id: 'pantry-spice-2', name: 'Salt', majorCategory: 'Pantry', minorCategory: 'Spices, seasoning & stock' }
      ],
      'Oils & vinegars': [
        { id: 'pantry-oil-1', name: 'Olive Oil', majorCategory: 'Pantry', minorCategory: 'Oils & vinegars' },
        { id: 'pantry-oil-2', name: 'Balsamic Vinegar', majorCategory: 'Pantry', minorCategory: 'Oils & vinegars' }
      ]
    },
    Freezer: {
      'Vegetables (frozen)': [
        { id: 'freezer-veg-1', name: 'Mixed Vegetables', majorCategory: 'Freezer', minorCategory: 'Vegetables (frozen)' },
        { id: 'freezer-veg-2', name: 'Peas', majorCategory: 'Freezer', minorCategory: 'Vegetables (frozen)' }
      ],
      'Meat (frozen)': [
        { id: 'freezer-meat-1', name: 'Frozen Chicken', majorCategory: 'Freezer', minorCategory: 'Meat (frozen)' }
      ],
      'Bread / wraps (frozen)': [
        { id: 'freezer-bread-1', name: 'Frozen Bread', majorCategory: 'Freezer', minorCategory: 'Bread / wraps (frozen)' }
      ]
    }
  };

  const mockPlan: MealPlanEntry[] = [
    { weekId, day: 'Mon', mealSlot: 'Breakfast', recipeId: 'recipe-3' },
    { weekId, day: 'Mon', mealSlot: 'Dinner', recipeId: 'recipe-1', servingsOverride: 2 },
    { weekId, day: 'Tue', mealSlot: 'Dinner', recipeId: 'recipe-2' },
    { weekId, day: 'Wed', mealSlot: 'Breakfast', recipeId: 'recipe-3' }
  ];

  return {
    recipes: mockRecipes,
    catalogue: mockCatalogue,
    weeklyPlan: mockPlan
  };
}
