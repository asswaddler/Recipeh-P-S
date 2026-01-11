import { Outlet } from 'react-router-dom';
import { BottomNav } from './Navigation';
import './Layout.css';

export function Layout() {
  return (
    <div className="app-layout">
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
