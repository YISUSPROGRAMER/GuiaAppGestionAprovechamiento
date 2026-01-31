import React, { useState, useEffect } from 'react';
import { db, generateNextId } from '../db/db';
import { SyncService } from '../services/sync';
import { useLiveQuery } from 'dexie-react-hooks';
import { TipoMaterial } from '../types';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const RecoleccionForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditing = !!id;

    const entidades = useLiveQuery(() => db.entidades.filter(e => e.deleted !== 1).toArray());

    // Form State
    const [idEntidad, setIdEntidad] = useState("");
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

    // Dynamic Materials List - Now tracks ID if editing
    const [detalles, setDetalles] = useState<Array<{ id?: string, material: TipoMaterial, peso: string }>>([
        { material: TipoMaterial.PET, peso: '' }
    ]);

    // Load data if editing
    useEffect(() => {
        if (isEditing && id) {
            const loadData = async () => {
                const rec = await db.recolecciones.get(id);
                if (rec) {
                    setIdEntidad(rec.idEntidad);
                    setFecha(rec.fechaRecoleccion ? rec.fechaRecoleccion.split('T')[0] : '');

                    const dets = await db.detalles.where('idRecoleccion').equals(id).toArray();
                    if (dets.length > 0) {
                        setDetalles(dets.map(d => ({
                            id: d.id,
                            material: d.material,
                            peso: d.pesoKg.toString()
                        })));
                    }
                }
            };
            loadData();
        }
    }, [id, isEditing]);

    const handleAddMaterial = () => {
        setDetalles([...detalles, { material: TipoMaterial.PET, peso: '' }]);
    };

    const handleRemoveMaterial = (index: number) => {
        setDetalles(detalles.filter((_, i) => i !== index));
    };

    const updateDetalle = (index: number, field: 'material' | 'peso', value: string) => {
        const newDetalles = [...detalles];
        if (field === 'material') {
            newDetalles[index].material = value as TipoMaterial;
        } else {
            newDetalles[index].peso = value;
        }
        setDetalles(newDetalles);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!idEntidad) {
            toast.error("Seleccione una entidad");
            return;
        }

        if (detalles.length === 0) {
            toast.error("Agregue al menos un material");
            return;
        }

        try {
            const selectedEntidad = entidades?.find(e => e.id === idEntidad);
            if (!selectedEntidad) throw new Error("Entidad no encontrada");

            let currentRecId = id;

            if (isEditing && id) {
                // Update existing Recoleccion
                await db.recolecciones.update(id, {
                    idEntidad,
                    nombreEntidad: selectedEntidad.nombre,
                    fechaRecoleccion: fecha,
                    sync: 1
                });
                toast.success("Recolección actualizada");
            } else {
                // Create New Recoleccion
                currentRecId = await generateNextId("REC");
                await db.recolecciones.add({
                    id: currentRecId,
                    idEntidad,
                    nombreEntidad: selectedEntidad.nombre,
                    fechaRecoleccion: fecha,
                    sync: 1
                });
                toast.success("Recolección guardada");
            }

            // Handle Detalles (Upsert/Delete Logic)

            // 1. Get all currently stored items for this Recoleccion (to find deletions)
            const existingDetalles = await db.detalles.where('idRecoleccion').equals(currentRecId!).toArray();
            const existingIds = existingDetalles.map(d => d.id);
            const currentFormIds = detalles.map(d => d.id).filter(Boolean); // Only those that already had IDs

            // 2. Soft Delete items that are in DB but NOT in form anymore
            const idsToDelete = existingIds.filter(eid => !currentFormIds.includes(eid));
            if (idsToDelete.length > 0) {
                // Must do soft delete to sync with backend
                await Promise.all(idsToDelete.map(id => db.detalles.update(id, { deleted: 1, sync: 1 })));
            }

            // 3. Upsert items (Update existing or Add new)
            // For new items, we need IDs.
            // We'll generate a base ID and increment.
            // NOTE: generateNextId goes to DB. If we are in a loop, we need to be careful.
            // But here we can just loop and if it has ID -> Update, if not -> Generate & Add.

            // To be safe with async ID gen, let's do one by one or get a batch. 
            // Dexie transaction needed? usage of generateNextId inside loop is tricky if it relies on "last in db".
            // Since we might be adding multiple, let's just use a timestamp-like suffix or sequential if we assume single user.
            // Let's use the helper but await carefully.

            for (const d of detalles) {
                if (d.id) {
                    // Update
                    await db.detalles.update(d.id, {
                        idRecoleccion: currentRecId!,
                        idEntidad,
                        nombreEntidad: selectedEntidad.nombre,
                        fechaRecoleccion: fecha,
                        material: d.material,
                        pesoKg: parseFloat(d.peso),
                        sync: 1
                    });
                } else {
                    // Create New
                    const newDetId = await generateNextId("DET");
                    await db.detalles.add({
                        id: newDetId,
                        idRecoleccion: currentRecId!,
                        idEntidad,
                        nombreEntidad: selectedEntidad.nombre,
                        fechaRecoleccion: fecha,
                        material: d.material,
                        pesoKg: parseFloat(d.peso),
                        sync: 1
                    });
                }
            }

            // Auto-Sync
            SyncService.syncUp().catch(e => console.error("Auto-sync failed", e));

            navigate('/recolecciones');

        } catch (error) {
            console.error(error);
            toast.error("Error al guardar");
        }
    };

    return (
        <div className="p-4 bg-gray-50 min-h-screen pb-20">
            <header className="flex items-center space-x-4 mb-6">
                <button onClick={() => navigate('/recolecciones')} className="p-2 -ml-2 text-gray-600">
                    <ArrowLeft />
                </button>
                <h1 className="text-xl font-bold text-gray-900">{isEditing ? 'Editar Recolección' : 'Nueva Recolección'}</h1>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Main Info */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Entidad</label>
                        <select
                            className="w-full p-3 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={idEntidad}
                            onChange={e => setIdEntidad(e.target.value)}
                            required
                        >
                            <option value="">Seleccionar...</option>
                            {entidades?.map(e => (
                                <option key={e.id} value={e.id}>{e.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                        <input
                            type="date"
                            className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            value={fecha}
                            onChange={e => setFecha(e.target.value)}
                            required
                        />
                    </div>
                </div>

                {/* Materiales Details */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold text-gray-800">Materiales</h2>
                        <button
                            type="button"
                            onClick={handleAddMaterial}
                            className="text-sm text-blue-600 font-medium flex items-center space-x-1"
                        >
                            <Plus size={18} /> <span>Agregar</span>
                        </button>
                    </div>

                    {detalles.map((det, index) => (
                        <div key={index} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-start space-x-3">
                            <div className="flex-1 space-y-2">
                                <select
                                    className="w-full p-2 border border-gray-200 rounded-lg bg-white text-sm"
                                    value={det.material}
                                    onChange={e => updateDetalle(index, 'material', e.target.value)}
                                >
                                    {Object.values(TipoMaterial).map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0.01"
                                        required
                                        className="flex-1 p-2 border border-gray-200 rounded-lg text-sm"
                                        value={det.peso}
                                        onChange={e => updateDetalle(index, 'peso', e.target.value)}
                                    />
                                    <span className="text-sm text-gray-500">Kg</span>
                                </div>
                            </div>
                            {detalles.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveMaterial(index)}
                                    className="p-2 text-red-400 hover:text-red-600"
                                >
                                    <Trash2 size={20} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="h-4"></div> {/* Spacer */}

                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 transition flex items-center justify-center space-x-2"
                >
                    <Save size={20} />
                    <span>{isEditing ? 'Actualizar' : 'Guardar'} Recolección</span>
                </button>
            </form>
        </div>
    );
};
