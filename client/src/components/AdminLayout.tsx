import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import {
  LayoutDashboard,
  Trophy,
  Users,
  LogOut,
  Home,
  ChevronRight,
  Building2,
  UsersRound,
  CalendarRange,
  Menu,
  X
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const navItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { path: '/admin/tournaments', icon: Trophy, label: 'Tournois' },
    { path: '/admin/teams', icon: UsersRound, label: 'Équipes' },
    { path: '/admin/clubs', icon: Building2, label: 'Clubs' },
    { path: '/admin/seasons', icon: CalendarRange, label: 'Saisons' },
    { path: '/admin/users', icon: Users, label: 'Utilisateurs' },
  ];

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 fixed w-full z-10">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {/* Hamburger Menu Button - Mobile only */}
              <button
                onClick={toggleSidebar}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Toggle menu"
              >
                {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>

              <Link to="/" className="flex items-center">
                <Trophy className="h-8 w-8 text-primary-600" />
                <span className="ml-2 text-xl font-bold text-gray-900 hidden sm:inline">USM Tournois</span>
              </Link>
              <ChevronRight className="mx-3 text-gray-400 hidden sm:block" size={20} />
              <span className="text-gray-600 hidden sm:block">Administration</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/" className="text-gray-600 hover:text-gray-900 flex items-center gap-2">
                <Home size={20} />
                <span className="hidden sm:inline">Retour au site</span>
              </Link>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{user?.pseudo}</p>
                  <p className="text-xs text-gray-500">Administrateur</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="btn-secondary text-sm"
                >
                  <LogOut size={16} className="mr-2" />
                  Déconnexion
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex pt-16">
        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            w-64 bg-white border-r border-gray-200 fixed h-full overflow-y-auto z-30 transition-transform duration-300
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0
          `}
        >
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path, item.exact);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeSidebar}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    active
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-64 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
