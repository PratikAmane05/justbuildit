import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Briefcase, CheckSquare, Building,
  LogOut, ChevronDown, Settings, Bell
} from 'lucide-react';


interface NavUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState<NavUser | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem('nav_user');
    if (cached) {
      try { setUser(JSON.parse(cached)); } catch {}
    } else {
      apiClient.get('/auth/me/').then(res => {
        setUser(res.data);
        localStorage.setItem('nav_user', JSON.stringify(res.data));
      }).catch(() => {});
    }
  }, []);


  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('nav_user');
    navigate('/');
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { to: '/projects',  label: 'Projects',   icon: <Briefcase className="w-4 h-4" /> },
    { to: '/tasks',     label: 'Tasks',      icon: <CheckSquare className="w-4 h-4" /> },
    { to: '/organizations', label: 'Organizations', icon: <Building className="w-4 h-4" /> },
  ];

  const active = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/dashboard" className="font-bold text-lg tracking-tighter text-gray-900 flex-shrink-0">
          justbuildit<span className="text-purple-600">.</span>
        </Link>


        {/* Navigation */}
        <nav className="flex items-center gap-0.5">
          {navItems.map(item => (
            <Link key={item.to} to={item.to}>
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1.5 text-sm font-medium h-9 px-3 transition-all ${
                  active(item.to)
                    ? 'text-gray-900 bg-gray-100'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {item.icon}
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        {/* Profile section */}
        <div className="flex items-center gap-2">

          <div className="relative flex-shrink-0">
            <button
              onClick={() => setProfileOpen(p => !p)}
              className="flex items-center gap-2.5 h-9 px-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
            >
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={initials} className="w-full h-full rounded-full object-cover" />
                ) : initials}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-sm font-semibold text-gray-900 leading-none">{user?.name || 'Loading...'}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-none truncate max-w-[140px]">{user?.email}</p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>


          {/* Dropdown */}
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
                {/* User info card */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0">
                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt={initials} className="w-full h-full rounded-full object-cover" />
                      ) : initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{user?.name || '—'}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div className="py-1.5">
                  <button 
                    onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-gray-400" />
                    Account Settings
                  </button>
                  <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <Bell className="w-4 h-4 text-gray-400" />
                    Notifications
                  </button>
                </div>
                <div className="border-t border-gray-100 py-1.5">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  </header>
  );
}
