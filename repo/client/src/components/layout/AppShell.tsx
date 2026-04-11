import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

export default function AppShell() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 bg-gray-50">
          <Outlet />
        </main>
        <footer className="bg-white border-t px-6 py-3 text-center text-xs text-gray-500">
          LensWork Alumni Photography Marketplace &copy; {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
