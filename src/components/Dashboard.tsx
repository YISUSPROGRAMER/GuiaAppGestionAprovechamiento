import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { SyncService } from '../services/sync';
import { RefreshCw, Download, ChevronLeft, ChevronRight, Truck, Archive, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';
import { ALL_PERIODS_VALUE, useSharedSelectedMonth } from '../hooks/useSharedSelectedMonth';

const MONTHLY_GOAL_KG = 5000;

const getMonthKey = (dateValue: string) => {
    if (!dateValue) return '';
    return dateValue.slice(0, 7);
};

const formatMonthLabel = (monthKey: string) => {
    if (monthKey === ALL_PERIODS_VALUE) return 'Todos los meses';

    const [year, month] = monthKey.split('-').map(Number);
    if (!year || !month) return monthKey;

    return new Intl.DateTimeFormat('es-CO', {
        month: 'long',
        year: 'numeric'
    }).format(new Date(year, month - 1, 1));
};

export const Dashboard: React.FC = () => {
    const [activeAction, setActiveAction] = useState<'sync' | 'download' | null>(null);
    const { selectedMonth, setSelectedMonth, currentMonth } = useSharedSelectedMonth();

    const metrics = useLiveQuery(async () => {
        const activeRecolecciones = await db.recolecciones.filter(r => r.deleted !== 1).toArray();
        const activeDetalles = await db.detalles.filter(d => d.deleted !== 1).toArray();
        const availableMonths = Array.from(new Set(
            activeRecolecciones
                .map(r => getMonthKey(r.fechaRecoleccion))
                .filter(Boolean)
        )).sort();

        const monthToUse = selectedMonth === ALL_PERIODS_VALUE
            ? ALL_PERIODS_VALUE
            : availableMonths.includes(selectedMonth)
            ? selectedMonth
            : availableMonths.includes(currentMonth)
                ? currentMonth
                : availableMonths[0] || currentMonth;

        const monthRecolecciones = monthToUse === ALL_PERIODS_VALUE
            ? activeRecolecciones
            : activeRecolecciones.filter(r => getMonthKey(r.fechaRecoleccion) === monthToUse);
        const monthRecIds = new Set(monthRecolecciones.map(r => r.id));
        const recoleccionesCount = monthRecolecciones.length;
        const entidadesCount = new Set(monthRecolecciones.map(r => r.idEntidad)).size;
        const validDetalles = activeDetalles.filter(d => monthRecIds.has(d.idRecoleccion));
        const totalKg = validDetalles.reduce((acc, d) => acc + d.pesoKg, 0);
        const goalMultiplier = monthToUse === ALL_PERIODS_VALUE ? Math.max(availableMonths.length, 1) : 1;
        const totalGoalKg = MONTHLY_GOAL_KG * goalMultiplier;
        const faltante = Math.max(totalGoalKg - totalKg, 0);
        const excedente = Math.max(totalKg - totalGoalKg, 0);

        return {
            metaMensual: totalGoalKg,
            totalRecolectado: totalKg,
            percentCumplimiento: totalKg / totalGoalKg,
            totalEntidades: entidadesCount,
            totalRecolecciones: recoleccionesCount,
            promedioKgPorRecoleccion: recoleccionesCount > 0 ? totalKg / recoleccionesCount : 0,
            faltante,
            excedente,
            selectedMonth: monthToUse,
            availableMonths
        };
    }, [selectedMonth, currentMonth]);

    // No legacy useEffect needed
    const loading = !metrics;
    const isBusy = activeAction !== null;

    const handleSync = async () => {
        if (isBusy) return;

        setActiveAction('sync');
        try {
            await SyncService.syncUp();
            await SyncService.syncDown();
            toast.success("Sincronización finalizada");
        } catch (error) {
            console.error("[Dashboard] Error en sincronización manual:", error);
            toast.error("No se pudo completar la sincronización");
        } finally {
            setActiveAction(null);
        }
    };

    const handleDownload = async () => {
        if (isBusy) return;

        setActiveAction('download');
        try {
            await SyncService.syncDown();
            toast.success("Descarga finalizada");
        } catch (error) {
            console.error("[Dashboard] Error en descarga manual:", error);
            toast.error("No se pudo completar la descarga");
        } finally {
            setActiveAction(null);
        }
    };

    if (!metrics) return <div className="p-4">Cargando métricas...</div>;

    const progress = Math.min(metrics.percentCumplimiento * 100, 100);
    const colorClass = progress < 50 ? 'bg-red-500' : progress < 85 ? 'bg-yellow-500' : 'bg-green-500';
    const monthIndex = metrics.availableMonths.indexOf(metrics.selectedMonth);
    const isAllPeriods = metrics.selectedMonth === ALL_PERIODS_VALUE;
    const canGoPrevious = !isAllPeriods && monthIndex > 0;
    const canGoNext = !isAllPeriods && monthIndex !== -1 && monthIndex < metrics.availableMonths.length - 1;

    return (
        <div className="p-4 space-y-6">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Guía Aprovechamiento</h1>
                    <p className="text-sm text-gray-500">Panel de Control</p>
                </div>
                <div className="flex bg-white rounded-full shadow-sm p-1">
                    <button
                        onClick={handleDownload}
                        disabled={loading || isBusy}
                        className={`p-2 rounded-full text-emerald-600 hover:bg-emerald-50 transition-colors ${loading || isBusy ? "opacity-50" : ""}`}
                        title="Descargar datos del servidor"
                    >
                        <Download size={24} className={activeAction === 'download' ? "animate-spin" : ""} />
                    </button>
                    <div className="w-px bg-gray-100 mx-1"></div>
                    <button
                        onClick={handleSync}
                        disabled={loading || isBusy}
                        className={`p-2 rounded-full text-blue-600 hover:bg-blue-50 transition-colors ${loading || isBusy ? "opacity-50" : ""}`}
                        title="Sincronizar Datos"
                    >
                        <RefreshCw size={24} className={activeAction === 'sync' ? "animate-spin" : ""} />
                    </button>
                    <div className="w-px bg-gray-100 mx-1"></div>
                    <Link to="/settings" className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition-colors">
                        <Settings size={24} />
                    </Link>
                </div>
            </header>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            if (!canGoPrevious) return;
                            setSelectedMonth(metrics.availableMonths[monthIndex - 1]);
                        }}
                        disabled={!canGoPrevious}
                        className={clsx(
                            "p-2 rounded-full border transition-colors",
                            canGoPrevious ? "border-gray-200 text-gray-700 hover:bg-gray-50" : "border-gray-100 text-gray-300"
                        )}
                        title="Mes anterior"
                    >
                        <ChevronLeft size={18} />
                    </button>

                    <div className="flex-1">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Periodo</p>
                        <select
                            value={metrics.selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={ALL_PERIODS_VALUE}>Todos los meses</option>
                            {metrics.availableMonths.length > 0 ? (
                                metrics.availableMonths.map(month => (
                                    <option key={month} value={month}>
                                        {formatMonthLabel(month)}
                                    </option>
                                ))
                            ) : (
                                <option value={metrics.selectedMonth}>
                                    {formatMonthLabel(metrics.selectedMonth)}
                                </option>
                            )}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            if (!canGoNext) return;
                            setSelectedMonth(metrics.availableMonths[monthIndex + 1]);
                        }}
                        disabled={!canGoNext}
                        className={clsx(
                            "p-2 rounded-full border transition-colors",
                            canGoNext ? "border-gray-200 text-gray-700 hover:bg-gray-50" : "border-gray-100 text-gray-300"
                        )}
                        title="Mes siguiente"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>

                <p className="text-sm text-gray-500">
                    {isAllPeriods
                        ? "Mostrando un resumen general acumulado de todos los meses trabajados."
                        : metrics.availableMonths.length > 0
                        ? `Mostrando información de ${formatMonthLabel(metrics.selectedMonth)}`
                        : "Aún no hay meses trabajados registrados. Puedes empezar con el mes actual."}
                </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <p className="text-sm text-gray-500 font-medium mb-1">
                            {isAllPeriods ? 'Total Recolectado General' : 'Total Recolectado del Mes'}
                        </p>
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
                    <span>{isAllPeriods ? 'Meta acumulada' : 'Meta mensual'}: {metrics.metaMensual.toLocaleString('es-CO')} Kg</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-gray-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-gray-400">Faltante</p>
                        <p className="text-lg font-bold text-gray-900">
                            {metrics.faltante.toLocaleString('es-CO', { maximumFractionDigits: 1 })} Kg
                        </p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-emerald-600">Excedente</p>
                        <p className="text-lg font-bold text-emerald-700">
                            {metrics.excedente.toLocaleString('es-CO', { maximumFractionDigits: 1 })} Kg
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                    <Archive className="text-purple-500 mb-2" size={24} />
                    <span className="text-2xl font-bold text-gray-900">{metrics.totalEntidades}</span>
                    <span className="text-xs text-gray-500">{isAllPeriods ? 'Entidades acumuladas' : 'Entidades del mes'}</span>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                    <Truck className="text-indigo-500 mb-2" size={24} />
                    <span className="text-2xl font-bold text-gray-900">{metrics.totalRecolecciones}</span>
                    <span className="text-xs text-gray-500">{isAllPeriods ? 'Recolecciones acumuladas' : 'Recolecciones del mes'}</span>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-gray-900">
                        {metrics.promedioKgPorRecoleccion.toLocaleString('es-CO', { maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-xs text-gray-500">Promedio Kg / recolección</span>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-gray-900">{formatMonthLabel(metrics.selectedMonth)}</span>
                    <span className="text-xs text-gray-500">{isAllPeriods ? 'Resumen activo' : 'Mes activo'}</span>
                </div>
            </div>

        </div>
    );
};
