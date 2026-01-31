import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { SyncService } from '../services/sync';
import { RefreshCw, Truck, Archive, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

export const Dashboard: React.FC = () => {
    // Reactively calculate metrics from local DB + Synced Meta
    const metrics = useLiveQuery(async () => {
        // 1. Get Synced Meta (or default)
        const storedMeta = localStorage.getItem('meta_trimestral');
        const meta = storedMeta ? Number(storedMeta) : 6000;

        // 2. Count Active Items (Exclude deleted)
        const activeRecolecciones = await db.recolecciones.filter(r => r.deleted !== 1).toArray();
        const activeRecIds = new Set(activeRecolecciones.map(r => r.id));
        const recoleccionesCount = activeRecolecciones.length;
        const entidadesCount = await db.entidades.filter(e => e.deleted !== 1).count();

        // 3. Calculate Total Weight directly from Active Details belonging to Active Recolecciones
        const activeDetalles = await db.detalles.filter(d => d.deleted !== 1).toArray();
        // Strict Check: Detail must not be deleted AND its parent Recoleccion must exist and not be deleted
        const validDetalles = activeDetalles.filter(d => activeRecIds.has(d.idRecoleccion));
        const totalKg = validDetalles.reduce((acc, d) => acc + d.pesoKg, 0);

        return {
            metaTrimestral: meta,
            totalRecolectado: totalKg,
            percentCumplimiento: totalKg / meta,
            totalEntidades: entidadesCount,
            totalRecolecciones: recoleccionesCount,
            promedioKgPorRecoleccion: recoleccionesCount > 0 ? totalKg / recoleccionesCount : 0,
            faltante: meta - totalKg
        };
    }, []);

    // No legacy useEffect needed
    const loading = !metrics;

    const handleSync = async () => {
        // Trigger Sync
        await SyncService.syncUp();
        await SyncService.syncDown();
        // The dashboard will auto-update via useLiveQuery observing DB changes and LocalStorage
    };

    if (!metrics) return <div className="p-4">Cargando métricas...</div>;

    const progress = Math.min(metrics.percentCumplimiento * 100, 100);
    const colorClass = progress < 50 ? 'bg-red-500' : progress < 85 ? 'bg-yellow-500' : 'bg-green-500';

    return (
        <div className="p-4 space-y-6">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Guía Aprovechamiento</h1>
                    <p className="text-sm text-gray-500">Panel de Control</p>
                </div>
                <div className="flex bg-white rounded-full shadow-sm p-1">
                    <button
                        onClick={handleSync}
                        disabled={loading}
                        className={`p-2 rounded-full text-blue-600 hover:bg-blue-50 transition-colors ${loading ? "opacity-50" : ""}`}
                        title="Sincronizar Datos"
                    >
                        <RefreshCw size={24} className={loading ? "animate-spin" : ""} />
                    </button>
                    <div className="w-px bg-gray-100 mx-1"></div>
                    <Link to="/settings" className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition-colors">
                        <Settings size={24} />
                    </Link>
                </div>
            </header>

            {/* Main Goal Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <p className="text-sm text-gray-500 font-medium mb-1">Total Recolectado</p>
                        <h2 className="text-4xl font-extrabold text-gray-900">
                            {metrics.totalRecolectado.toLocaleString('es-CO', { maximumFractionDigits: 1 })} <span className="text-lg text-gray-400 font-normal">Kg</span>
                        </h2>
                    </div>
                    <div className="text-right">
                        <span className={clsx("text-sm font-bold px-2 py-1 rounded-full",
                            progress < 50 ? "bg-red-100 text-red-700" : progress < 85 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700")}>
                            {(metrics.percentCumplimiento * 100).toFixed(1)}%
                        </span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div
                        className={clsx("h-full transition-all duration-1000 ease-out", colorClass)}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                    <span>0 Kg</span>
                    <span>Meta: {metrics.metaTrimestral.toLocaleString()} Kg</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                    <Archive className="text-purple-500 mb-2" size={24} />
                    <span className="text-2xl font-bold text-gray-900">{metrics.totalEntidades}</span>
                    <span className="text-xs text-gray-500">Entidades</span>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                    <Truck className="text-indigo-500 mb-2" size={24} />
                    <span className="text-2xl font-bold text-gray-900">{metrics.totalRecolecciones}</span>
                    <span className="text-xs text-gray-500">Recolecciones</span>
                </div>
            </div>

        </div>
    );
};
