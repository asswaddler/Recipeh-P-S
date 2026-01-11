# Recipeh - Collaborative Meal Planning App

A lightweight web application for collaborative meal planning and grocery shopping for two users. Designed for mobile-first use, with Google Sheets as the backend data store.

## Features

- **Weekly Meal Planning**: Navigate week-by-week, select recipes per day and meal slot (Breakfast/Lunch/Dinner)
- **Shared Recipe Database**: Google Sheets serves as the source of truth for recipes
- **Grocery List Generation**: Automatically aggregates ingredients from selected recipes with quantity summing
- **Recipe Scaling**: Adjust servings and see ingredient quantities update in real-time
- **Manual Grocery Items**: Add items from the ingredients catalogue or custom items
- **Mobile-First Design**: Large touch targets and responsive layout for grocery store use

## Quick Start (Development)

```bash
# Install dependencies
npm install

# Start development server with mock data
npm run dev
```

The app will run at `http://localhost:5173` with mock data enabled by default.

## Project Structure

```
src/
├── components/
│   ├── Calendar/       # Weekly calendar and meal slot components
│   ├── Grocery/        # Grocery list and add item modal
│   ├── Recipe/         # Recipe list and detail views
│   ├── Navigation/     # Bottom navigation
│   └── common/         # Reusable UI components
├── context/            # React Context for state management
├── services/           # API layer with caching
├── types/              # TypeScript type definitions
└── utils/              # Date and ingredient parsing utilities

apps-script/            # Google Apps Script backend code
```

## Setup Guide

### 1. Google Sheets Setup

Create a Google Spreadsheet with the following sheets:

#### Recipes Sheet
| RecipeID | Name | Description | Category | ServingsDefault | Ingredients | IngredientNotes | Instructions |
|----------|------|-------------|----------|-----------------|-------------|-----------------|--------------|
| recipe-1 | Pasta | Quick pasta | Italian | 4 | 400g spaghetti\n200g sauce | Use fresh pasta if available | Cook pasta\nAdd sauce\nServe |

**Notes:**
- `RecipeID` must be unique
- `Ingredients` can be multi-line (newline separated)
- `Instructions` can be multi-line (each line = one step)

#### Ingredients Sheet
| Fresh - Meat | Fresh - Vegetables | Pantry - Pasta | Freezer - Vegetables |
|--------------|-------------------|----------------|---------------------|
| Chicken Breast | Tomatoes | Spaghetti | Frozen Peas |
| Ground Beef | Onions | Rice | Mixed Vegetables |

**Notes:**
- First row contains minor category headers
- Use row with just "Fresh", "Pantry", or "Freezer" to change major category
- Items are listed under their category columns

#### WeeklyPlan Sheet
| WeekID | Day | MealSlot | RecipeID | ServingsOverride |
|--------|-----|----------|----------|------------------|
| 2026-W03 | Mon | Dinner | recipe-1 | 2 |
| 2026-W03 | Tue | Breakfast | recipe-2 | |

### 2. Google Apps Script Setup

1. Open your Google Spreadsheet
2. Go to **Extensions > Apps Script**
3. Copy the contents of `apps-script/Code.gs` into the script editor
4. Save the project (give it a name like "Recipeh API")
5. Run `testAccess` function once to authorize
6. Deploy as Web App:
   - Click **Deploy > New deployment**
   - Choose **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**
7. Copy the Web App URL

### 3. Configure the App

1. Copy `.env.example` to `.env`
2. Update the values:

```env
VITE_API_BASE_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
VITE_USE_MOCK_DATA=false
```

### 4. Build and Deploy

#### Option A: GitHub Pages (Recommended)

1. Push your code to GitHub
2. Go to **Settings > Pages**
3. Enable GitHub Pages with **GitHub Actions** as source
4. Add repository secrets:
   - Go to **Settings > Secrets and variables > Actions**
   - Add `VITE_API_BASE_URL` with your Apps Script URL
5. The app will deploy automatically on push to `main`

#### Option B: Manual Build

```bash
# Build for production
npm run build

# Preview the build locally
npm run preview
```

The `dist` folder can be deployed to any static hosting service.

## Configuration Options

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_BASE_URL` | Google Apps Script Web App URL | Yes (for production) |
| `VITE_USE_MOCK_DATA` | Set to `true` to use mock data | No (default: false) |
| `VITE_API_GET_ENDPOINT` | Custom GET endpoint path | No |
| `VITE_API_SAVE_ENDPOINT` | Custom POST endpoint path | No |

### Cache Settings

The app caches data in localStorage:
- Recipes: 24 hours
- Ingredients catalogue: 24 hours
- Weekly plans: 5 minutes

Use the "Refresh" button to force-fetch latest data.

## CORS Configuration

If you encounter CORS issues:

1. In Apps Script, ensure `doGet` and `doPost` functions return proper responses
2. The Web App must be deployed with "Anyone" access
3. If using custom domain, configure CORS headers appropriately

## Data Flow

```
User Action → React State → (if save) → Apps Script → Google Sheets
                          ↓
                    localStorage cache
```

- Local interactions (checking grocery items, navigating) don't trigger API calls
- Saving the meal plan writes to Google Sheets
- Both users see updates after refreshing

## Troubleshooting

### "Failed to load data"
- Check that `VITE_API_BASE_URL` is set correctly
- Verify the Apps Script is deployed and accessible
- Check browser console for detailed errors

### Recipes not showing
- Run `testAccess()` in Apps Script to verify sheet access
- Check column mappings in `Code.gs` match your sheet structure

### Changes not syncing
- Click "Refresh" to pull latest data
- Verify "Save Plan" was successful (green confirmation)
- Check Apps Script execution logs for errors

## Development

```bash
# Run development server
npm run dev

# Run with mock data (no backend needed)
VITE_USE_MOCK_DATA=true npm run dev

# Type checking
npm run build

# Lint
npm run lint
```

## License

MIT
