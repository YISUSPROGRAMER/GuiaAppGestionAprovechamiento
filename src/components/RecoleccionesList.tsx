import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { SyncService } from '../services/sync';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Plus, Search, Calendar, Truck, Trash2 } from 'lucide-react';

export const RecoleccionesList: React.FC = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const recolecciones = useLiveQuery(
        () => db.recolecciones.orderBy('fechaRecoleccion').reverse().toArray()
    );

    if (!recolecciones) return <div className="p-4">Cargando...</div>;

    const filtered = recolecciones.filter(r =>
        r.nombreEntidad.toLowerCase().includes(search.toLowerCase()) && r.deleted !== 1
    );

    return (
        <div className="p-4 pb-20">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Recolecciones</h1>
                <Link to="/recolecciones/new" className="bg-blue-600 text-white p-2 rounded-full shadow-lg">
                    <Plus size={24} />
                </Link>
            </header>

            <div className="relative mb-6">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por entidad..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="space-y-4">
                {filtered.map(rec => (
                    <div
                        key={rec.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden active:bg-gray-50 transition-colors relative"
                    >
                        <div
                            onClick={() => navigate(`/recolecciones/${rec.id}/edit`)}
                            className="p-4 flex items-start space-x-3 cursor-pointer pr-16"
                        >
                            <div className="bg-green-50 p-3 rounded-lg text-green-600">
                                <Truck size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between">
                                    <h3 className="font-bold text-gray-900 truncate">{rec.nombreEntidad}</h3>
                                    <span className="text-xs font-mono text-gray-400">{rec.id}</span>
                                </div>
                                <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                                    <Calendar size={14} />
                                    <span>{new Date(rec.fechaRecoleccion).toLocaleDateString()}</span>
                                </div>
                                {rec.sync === 1 && (
                                    <div className="mt-2">
                                        <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                                            Pendiente Sync
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Delete Action - Improved for Mobile */}
                        <button
                            className="absolute top-1/2 -translate-y-1/2 right-3 p-3 bg-white border border-red-100 rounded-full shadow-sm text-red-500 hover:text-red-700 hover:bg-red-50 active:bg-red-100 transition-all z-10"
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm("¿Eliminar recolección?")) {
                                    const toastId = toast.loading("Eliminando...");
                                    try {
                                        // Cascading Soft Delete (Transaction)
                                        await db.transaction('rw', db.recolecciones, db.detalles, async () => {
                                            // 1. Delete Recoleccion
                                            await db.recolecciones.update(rec.id, { deleted: 1, sync: 1 });

                                            // 2. Delete ALL related Detalles
                                            const relatedDetalles = await db.detalles.where('idRecoleccion').equals(rec.id).toArray();
                                            for (const d of relatedDetalles) {
                                                await db.detalles.update(d.id, { deleted: 1, sync: 1 });
                                            }
                                        });

                                        toast.success("Eliminado correctamente", { id: toastId });

                                        // Auto-Sync
                                        SyncService.syncUp().catch(console.error);

                                    } catch (e) {
                                        console.error(e);
                                        toast.error("Error al eliminar", { id: toastId });
                                    }
                                }
                            }}
                            title="Eliminar recolección"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="text-center py-10 text-gray-400">
                        No hay recolecciones registradas.
                    </div>
                )}
            </div>
        </div>
    );
};
