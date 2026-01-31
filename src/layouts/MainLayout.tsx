import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Truck } from 'lucide-react';
import clsx from 'clsx';

export const MainLayout: React.FC = () => {
    const location = useLocation();

    const navItems = [
        { path: '/', icon: LayoutDashboard, label: 'Inicio' },
        { path: '/entidades', icon: Users, label: 'Entidades' },
        { path: '/recolecciones', icon: Truck, label: 'Recolección' },
        // { path: '/config', icon: Settings, label: 'Config' },
    ];

    return (
        <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
            <main className="flex-1 overflow-y-auto pb-20">
                <Outlet />
            </main>

            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 pb-safe">
                <div className="flex justify-around items-center h-16">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={clsx(
                                    "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200",
                                    isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                <Icon size={24} />
                                <span className="text-xs font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};
