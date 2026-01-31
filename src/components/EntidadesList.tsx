import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { SyncService } from '../services/sync';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, MapPin, Trash2 } from 'lucide-react';

export const EntidadesList: React.FC = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    // Dexie hook to reactively update list
    const entidades = useLiveQuery(
        () => db.entidades.orderBy('fechaVisitaGestion').reverse().toArray()
    );

    if (!entidades) return <div className="p-4">Cargando...</div>;

    const filtered = entidades.filter(e =>
        e.nombre.toLowerCase().includes(search.toLowerCase()) && e.deleted !== 1
    );

    return (
        <div className="p-4 pb-20">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Entidades</h1>
                <Link to="/entidades/new" className="bg-blue-600 text-white p-2 rounded-full shadow-lg">
                    <Plus size={24} />
                </Link>
            </header>

            <div className="relative mb-6">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar entidad..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="space-y-3">
                {filtered.map(ent => (
                    <div
                        key={ent.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden active:bg-gray-50 transition-colors relative"
                    >
                        <div
                            onClick={() => navigate(`/entidades/${ent.id}/edit`)}
                            className="p-4 flex items-start space-x-3 cursor-pointer pr-16"
                        >
                            <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
                                <MapPin size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between">
                                    <h3 className="font-bold text-gray-900 truncate">{ent.nombre}</h3>
                                    <span className="text-xs font-mono text-gray-400">{ent.id}</span>
                                </div>
                                <p className="text-sm text-gray-500 mb-1">{ent.tipo}</p>
                                {ent.sync === 1 && (
                                    <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                                        Pendiente Sync
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Delete Action - Improved for Mobile */}
                        <button
                            className="absolute top-1/2 -translate-y-1/2 right-3 p-3 bg-white border border-red-100 rounded-full shadow-sm text-red-500 hover:text-red-700 hover:bg-red-50 active:bg-red-100 transition-all z-10"
                            onClick={async (e) => {
                                e.stopPropagation();

                                // 1. Check for related active Recolecciones
                                const relatedRecs = await db.recolecciones
                                    .where('idEntidad').equals(ent.id)
                                    .filter(r => r.deleted !== 1)
                                    .toArray();

                                let confirmMessage = `¿Eliminar ${ent.nombre}?`;
                                if (relatedRecs.length > 0) {
                                    confirmMessage = `⚠️ ADVERTENCIA: Esta entidad tiene ${relatedRecs.length} recolecciones asociadas.\n\nSi eliminas esta entidad, SE ELIMINARÁN TAMBIÉN todas sus recolecciones y detalles asociados.\n\n¿Estás seguro de continuar?`;
                                }

                                if (confirm(confirmMessage)) {
                                    const toastId = toast.loading("Eliminando en cascada...");
                                    try {
                                        // 2. Refresh related (could have changed)
                                        const recsToDelete = await db.recolecciones.where('idEntidad').equals(ent.id).toArray();
                                        const recIds = recsToDelete.map(r => r.id);

                                        // 3. Find related Detalles
                                        // We can find them by idRecoleccion (if indexed) or idEntidad (if indexed)
                                        // db.ts says detalles has 'idEntidad'.
                                        const detsToDelete = await db.detalles.where('idEntidad').equals(ent.id).toArray();
                                        const detIds = detsToDelete.map(d => d.id);

                                        await db.transaction('rw', db.entidades, db.recolecciones, db.detalles, async () => {
                                            // Soft Delete Entity
                                            await db.entidades.update(ent.id, { deleted: 1, sync: 1 });

                                            // Soft Delete Recolecciones
                                            for (const rid of recIds) {
                                                await db.recolecciones.update(rid, { deleted: 1, sync: 1 });
                                            }

                                            // Soft Delete Detalles
                                            for (const did of detIds) {
                                                await db.detalles.update(did, { deleted: 1, sync: 1 });
                                            }
                                        });

                                        toast.success("Eliminado correctamente", { id: toastId });

                                        // Auto-Sync
                                        SyncService.syncUp().catch(console.error);
                                    } catch (err) {
                                        console.error(err);
                                        toast.error("Error al eliminar", { id: toastId });
                                    }
                                }
                            }}
                            title="Eliminar entidad"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="text-center py-10 text-gray-400">
                        No se encontraron entidades.
                    </div>
                )}
            </div>
        </div>
    );
};
