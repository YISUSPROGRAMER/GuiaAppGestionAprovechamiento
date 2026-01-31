import React, { useState, useEffect } from 'react';
import { db, generateNextId } from '../db/db';
import { SyncService } from '../services/sync';
import { TipoEstablecimiento } from '../types';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const EntidadForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditing = !!id;

    const [formData, setFormData] = useState<{
        nombre: string;
        tipo: TipoEstablecimiento;
        fechaVisitaGestion: string;
        linkCarpetaDrive: string;
    }>({
        nombre: '',
        tipo: TipoEstablecimiento.INSTITUCION_EDUCATIVA,
        fechaVisitaGestion: new Date().toISOString().split('T')[0],
        linkCarpetaDrive: ''
    });

    useEffect(() => {
        if (isEditing && id) {
            db.entidades.get(id).then(ent => {
                if (ent) {
                    setFormData({
                        nombre: ent.nombre,
                        tipo: ent.tipo,
                        fechaVisitaGestion: ent.fechaVisitaGestion ? ent.fechaVisitaGestion.split('T')[0] : '',
                        linkCarpetaDrive: ent.linkCarpetaDrive || ''
                    });
                }
            });
        }
    }, [id, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditing && id) {
                await db.entidades.update(id, {
                    nombre: formData.nombre,
                    tipo: formData.tipo,
                    fechaVisitaGestion: formData.fechaVisitaGestion,
                    linkCarpetaDrive: formData.linkCarpetaDrive,
                    sync: 1 // Next sync will capture this update (API needs to handle upsert logic usually)
                });
                toast.success("Entidad actualizada");
            } else {
                const newId = await generateNextId("ENT");
                await db.entidades.add({
                    id: newId,
                    nombre: formData.nombre,
                    tipo: formData.tipo,
                    fechaVisitaGestion: formData.fechaVisitaGestion,
                    linkCarpetaDrive: formData.linkCarpetaDrive,
                    sync: 1
                });
                toast.success("Entidad guardada");
            }

            // Auto-Sync
            SyncService.syncUp().catch(e => console.error("Auto-sync failed", e));

            navigate('/entidades');
        } catch (error) {
            console.error("Error saving entidad", error);
            toast.error("Error al guardar");
        }
    };

    return (
        <div className="p-4 bg-gray-50 min-h-screen">
            <header className="flex items-center space-x-4 mb-6">
                <button onClick={() => navigate('/entidades')} className="p-2 -ml-2 text-gray-600">
                    <ArrowLeft />
                </button>
                <h1 className="text-xl font-bold text-gray-900">{isEditing ? 'Editar Entidad' : 'Nueva Entidad'}</h1>
            </header>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Entidad</label>
                        <input
                            required
                            type="text"
                            value={formData.nombre}
                            onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ej. Hotel Central"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                        <select
                            value={formData.tipo}
                            onChange={e => setFormData({ ...formData, tipo: e.target.value as TipoEstablecimiento })}
                            className="w-full p-3 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {Object.values(TipoEstablecimiento).map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Visita Gestión</label>
                        <input
                            required
                            type="date"
                            value={formData.fechaVisitaGestion}
                            onChange={e => setFormData({ ...formData, fechaVisitaGestion: e.target.value })}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Link Drive (Opcional)</label>
                        <input
                            type="url"
                            value={formData.linkCarpetaDrive}
                            onChange={e => setFormData({ ...formData, linkCarpetaDrive: e.target.value })}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="https://drive.google.com/..."
                        />
                    </div>

                </div>

                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 transition flex items-center justify-center space-x-2"
                >
                    <Save size={20} />
                    <span>Guardar Entidad</span>
                </button>
            </form>
        </div>
    );
};
