import { Outlet, Link, useLocation } from 'react-router-dom';
import { Settings, ArrowLeft } from 'lucide-react';
import logo from '../assets/logo.png';

export function Layout() {
    const location = useLocation();
    const isAdmin = location.pathname.startsWith('/admin');

    return (
        <div className="min-h-screen flex flex-col bg-white">
            {/* Top Bar — liquid glass */}
            <header className="border-b border-black/5 bg-white/60 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-3 group">
                        <img src={logo} alt="Arovave" className="w-9 h-9 object-contain rounded-2xl" />
                        <span className="text-base font-bold text-black group-hover:text-black/70 transition-colors">
                            Arovave.in Calculator
                        </span>
                    </Link>

                    {/* Right side */}
                    <Link
                        to={isAdmin ? '/' : '/admin'}
                        className="flex items-center gap-2 px-5 py-2 rounded-2xl text-base font-semibold text-black/60 hover:text-black hover:bg-black/[0.04] transition-all duration-300"
                    >
                        {isAdmin ? (
                            <>
                                <ArrowLeft className="w-4 h-4" />
                                Back to Calculator
                            </>
                        ) : (
                            <>
                                <Settings className="w-4 h-4" />
                                Admin Panel
                            </>
                        )}
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 animate-fade-in">
                <div className="max-w-7xl mx-auto px-6 py-10">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
