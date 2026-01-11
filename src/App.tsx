import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { WeeklyCalendar } from './components/Calendar';
import { GroceryList } from './components/Grocery';
import { RecipeList, RecipeDetail } from './components/Recipe';
import './App.css';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<WeeklyCalendar />} />
            <Route path="grocery" element={<GroceryList />} />
            <Route path="recipes" element={<RecipeList />} />
            <Route path="recipe/:recipeId" element={<RecipeDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
