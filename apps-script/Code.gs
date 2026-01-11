/**
 * Recipeh Meal Planner - Google Apps Script Backend
 *
 * This script provides the API endpoints for the Recipeh web app.
 * Deploy as a Web App with "Execute as: Me" and "Who has access: Anyone"
 */

// Sheet names (update if your sheet names differ)
const SHEET_NAMES = {
  RECIPES: 'Recipes',
  INGREDIENTS: 'Ingredients',
  WEEKLY_PLAN: 'WeeklyPlan'
};

// Column mappings for Recipes sheet (1-indexed)
const RECIPE_COLUMNS = {
  RECIPE_ID: 1,
  NAME: 2,
  DESCRIPTION: 3,
  CATEGORY: 4,
  SERVINGS_DEFAULT: 5,
  INGREDIENTS: 6,
  INGREDIENT_NOTES: 7,
  INSTRUCTIONS: 8
};

// Column mappings for WeeklyPlan sheet (1-indexed)
const PLAN_COLUMNS = {
  WEEK_ID: 1,
  DAY: 2,
  MEAL_SLOT: 3,
  RECIPE_ID: 4,
  SERVINGS_OVERRIDE: 5
};

/**
 * Handle GET requests
 */
function doGet(e) {
  const action = e.parameter.action || 'getData';
  const weekId = e.parameter.weekId;

  try {
    let response = {};

    if (action === 'getData') {
      const includeRecipes = e.parameter.includeRecipes !== 'false';
      const includeCatalogue = e.parameter.includeCatalogue !== 'false';
      const includePlan = e.parameter.includePlan !== 'false';

      if (includeRecipes) {
        response.recipes = getRecipes();
      }

      if (includeCatalogue) {
        response.ingredientsCatalogue = getIngredientsCatalogue();
      }

      if (includePlan && weekId) {
        response.weeklyPlan = getWeeklyPlan(weekId);
      }
    }

    return createJsonResponse(response);
  } catch (error) {
    return createJsonResponse({ error: error.message }, 500);
  }
}

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'savePlan') {
      const result = saveWeeklyPlan(data.weekId, data.entries);
      return createJsonResponse(result);
    }

    if (action === 'saveManualAdditions') {
      // Optional: Implement if you want to persist manual additions
      return createJsonResponse({ success: true });
    }

    return createJsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    return createJsonResponse({ error: error.message }, 500);
  }
}

/**
 * Get all recipes from the Recipes sheet
 */
function getRecipes() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.RECIPES);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const recipes = [];

  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[RECIPE_COLUMNS.RECIPE_ID - 1]) continue; // Skip empty rows

    recipes.push({
      recipeId: row[RECIPE_COLUMNS.RECIPE_ID - 1],
      name: row[RECIPE_COLUMNS.NAME - 1] || '',
      description: row[RECIPE_COLUMNS.DESCRIPTION - 1] || '',
      category: row[RECIPE_COLUMNS.CATEGORY - 1] || '',
      servingsDefault: parseInt(row[RECIPE_COLUMNS.SERVINGS_DEFAULT - 1]) || 4,
      ingredients: row[RECIPE_COLUMNS.INGREDIENTS - 1] || '',
      ingredientNotes: row[RECIPE_COLUMNS.INGREDIENT_NOTES - 1] || '',
      instructions: row[RECIPE_COLUMNS.INSTRUCTIONS - 1] || ''
    });
  }

  return recipes;
}

/**
 * Get ingredients catalogue from the Ingredients sheet
 * Expected format: Major category headers in column A, minor category headers in row 1
 */
function getIngredientsCatalogue() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.INGREDIENTS);
  if (!sheet) return { Fresh: {}, Pantry: {}, Freezer: {} };

  const data = sheet.getDataRange().getValues();
  const catalogue = {
    Fresh: {},
    Pantry: {},
    Freezer: {}
  };

  if (data.length < 2) return catalogue;

  // Header row contains minor categories
  const headers = data[0];
  let currentMajor = 'Fresh';

  // Process each row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // Check if this is a major category header
    const firstCell = String(row[0]).trim();
    if (firstCell === 'Fresh' || firstCell === 'Pantry' || firstCell === 'Freezer') {
      currentMajor = firstCell;
      continue;
    }

    // Process items in each column
    for (let j = 0; j < row.length; j++) {
      const item = String(row[j]).trim();
      if (!item || j === 0 && !headers[j]) continue;

      const minorCategory = headers[j] || 'Other';

      if (!catalogue[currentMajor][minorCategory]) {
        catalogue[currentMajor][minorCategory] = [];
      }

      if (item) {
        catalogue[currentMajor][minorCategory].push({
          id: `${currentMajor}-${minorCategory}-${i}-${j}`,
          name: item
        });
      }
    }
  }

  return catalogue;
}

/**
 * Get weekly plan for a specific week
 */
function getWeeklyPlan(weekId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.WEEKLY_PLAN);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const entries = [];

  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowWeekId = row[PLAN_COLUMNS.WEEK_ID - 1];

    if (rowWeekId !== weekId) continue;

    entries.push({
      weekId: rowWeekId,
      day: row[PLAN_COLUMNS.DAY - 1] || '',
      mealSlot: row[PLAN_COLUMNS.MEAL_SLOT - 1] || '',
      recipeId: row[PLAN_COLUMNS.RECIPE_ID - 1] || null,
      servingsOverride: row[PLAN_COLUMNS.SERVINGS_OVERRIDE - 1] || undefined
    });
  }

  return entries;
}

/**
 * Save weekly plan entries
 */
function saveWeeklyPlan(weekId, entries) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.WEEKLY_PLAN);
  if (!sheet) {
    throw new Error('WeeklyPlan sheet not found');
  }

  const data = sheet.getDataRange().getValues();

  // Find and remove existing entries for this week
  const rowsToDelete = [];
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][PLAN_COLUMNS.WEEK_ID - 1] === weekId) {
      rowsToDelete.push(i + 1); // 1-indexed
    }
  }

  // Delete rows in reverse order to maintain indices
  for (const row of rowsToDelete) {
    sheet.deleteRow(row);
  }

  // Add new entries
  for (const entry of entries) {
    if (!entry.recipeId) continue; // Skip empty slots

    sheet.appendRow([
      weekId,
      entry.day,
      entry.mealSlot,
      entry.recipeId,
      entry.servingsOverride || ''
    ]);
  }

  return { success: true, message: 'Plan saved successfully' };
}

/**
 * Create a JSON response
 */
function createJsonResponse(data, status = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function - run this to verify sheet access
 */
function testAccess() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('Spreadsheet: ' + ss.getName());

  const sheets = ss.getSheets();
  sheets.forEach(function(sheet) {
    Logger.log('Sheet: ' + sheet.getName());
  });

  const recipes = getRecipes();
  Logger.log('Recipes count: ' + recipes.length);

  const catalogue = getIngredientsCatalogue();
  Logger.log('Catalogue: ' + JSON.stringify(Object.keys(catalogue)));
}
