import { db } from "../db/db";
import { ApiService } from "./api";
import { toast } from "react-hot-toast";

export const SyncService = {
    isSyncing: false,

    async syncUp() {
        if (this.isSyncing) return;
        if (!navigator.onLine) {
            toast.error("Sin conexión a internet");
            return;
        }

        this.isSyncing = true;
        const toastId = toast.loading("Iniciando sincronización...");
        console.log("[Sync] Iniciando subida de datos...");

        try {
            // 1. Get pending items
            const pendingEntidades = await db.entidades.where("sync").equals(1).toArray();
            const pendingRecolecciones = await db.recolecciones.where("sync").equals(1).toArray();
            const pendingDetalles = await db.detalles.where("sync").equals(1).toArray();

            console.log(`[Sync] Pendientes: ${pendingEntidades.length} Entidades, ${pendingRecolecciones.length} Recolecciones`);

            if (pendingEntidades.length === 0 && pendingRecolecciones.length === 0 && pendingDetalles.length === 0) {
                console.log("[Sync] Nada nuevo para subir.");
                toast.success("Todo al día (Subida)", { id: toastId });
                this.isSyncing = false;
                return;
            }

            // 2. Send to API
            console.log("[Sync] Enviando datos a API...", { pendingEntidades, pendingRecolecciones });
            const response = await ApiService.syncData({
                entidades: pendingEntidades,
                recolecciones: pendingRecolecciones,
                detalles: pendingDetalles
            });

            console.log("[Sync] Respuesta del servidor:", response);

            if (response && response.success) {
                if (response.logs) {
                    console.group("[Sync Server Logs]");
                    response.logs.forEach((log: string) => console.log(log));
                    console.groupEnd();
                }

                // 3. Mark as synced ONLY those returned by the server
                await db.transaction('rw', db.entidades, db.recolecciones, db.detalles, async () => {
                    const added = response.added || {}; // { entidades: [id1, ...], recolecciones: [...], ... }

                    // Process Entidades
                    if (Array.isArray(added.entidades)) {
                        for (const id of added.entidades) {
                            // Check if it was a deletion
                            const item = await db.entidades.get(id);
                            if (item && item.deleted === 1) {
                                await db.entidades.delete(id); // Hard Delete
                            } else if (item) {
                                await db.entidades.update(id, { sync: 0 }); // Just Mark Synced
                            }
                        }
                    }

                    // Process Recolecciones
                    if (Array.isArray(added.recolecciones)) {
                        for (const id of added.recolecciones) {
                            const item = await db.recolecciones.get(id);
                            if (item && item.deleted === 1) {
                                await db.recolecciones.delete(id);
                            } else if (item) {
                                await db.recolecciones.update(id, { sync: 0 });
                            }
                        }
                    }

                    // Process Detalles
                    if (Array.isArray(added.detalles)) {
                        for (const id of added.detalles) {
                            const item = await db.detalles.get(id);
                            if (item && item.deleted === 1) {
                                await db.detalles.delete(id);
                            } else if (item) {
                                await db.detalles.update(id, { sync: 0 });
                            }
                        }
                    }
                });
                console.log("[Sync] Marcados como sincronizados localmente (confirmados por servidor).");
                toast.success("Subida existosa", { id: toastId });
            } else {
                console.warn("[Sync] El servidor no confirmó éxito:", response);
                toast.error("Error en servidor al recibir datos", { id: toastId });
            }
        } catch (error) {
            console.error("[Sync] Error CRÍTICO en syncUp:", error);
            toast.error("Error de sincronización (Ver consola)", { id: toastId });
        } finally {
            this.isSyncing = false;
        }
    },

    async syncDown() {
        if (!navigator.onLine) return;

        const toastId = toast.loading("Descargando datos del servidor...");
        console.log("[SyncDown] Iniciando descarga...");

        try {
            const data = await ApiService.getData();
            console.log("[SyncDown] Datos recibidos:", data);

            if (data) {
                await db.transaction('rw', db.entidades, db.recolecciones, db.detalles, async () => {

                    // 1. Sync Entidades (Safe Merge)
                    if (data.entidades) {
                        for (const ent of data.entidades) {
                            const local = await db.entidades.get(ent.id);
                            // Only update if local doesn't exist OR local has no pending changes (sync=0)
                            if (!local || local.sync === 0) {
                                // Validate Date Format (YYYY-MM-DD)
                                const cleanEnt = { ...ent, sync: 0 };
                                if (cleanEnt.fechaVisitaGestion && cleanEnt.fechaVisitaGestion.includes('T')) {
                                    cleanEnt.fechaVisitaGestion = cleanEnt.fechaVisitaGestion.split('T')[0];
                                }
                                await db.entidades.put(cleanEnt);
                            } else {
                                console.warn(`[SyncDown] Conflicto ignorado en Entidad ${ent.id}: Cambios locales pendientes.`);
                            }
                        }
                    }

                    // 2. Sync Recolecciones (Safe Merge)
                    if (data.recolecciones) {
                        for (const rec of data.recolecciones) {
                            const local = await db.recolecciones.get(rec.id);
                            if (!local || local.sync === 0) {
                                // Validate Date Format (YYYY-MM-DD)
                                const cleanRec = { ...rec, sync: 0 };
                                if (cleanRec.fechaRecoleccion && cleanRec.fechaRecoleccion.includes('T')) {
                                    cleanRec.fechaRecoleccion = cleanRec.fechaRecoleccion.split('T')[0];
                                }
                                await db.recolecciones.put(cleanRec);
                            }
                        }
                    }

                    // 3. Sync Detalles (Safe Merge)
                    if (data.detalles) {
                        for (const det of data.detalles) {
                            const local = await db.detalles.get(det.id);
                            if (!local || local.sync === 0) {
                                const cleanDet = { ...det, sync: 0 };
                                if (cleanDet.fechaRecoleccion && cleanDet.fechaRecoleccion.includes('T')) {
                                    cleanDet.fechaRecoleccion = cleanDet.fechaRecoleccion.split('T')[0];
                                }
                                await db.detalles.put(cleanDet);
                            }
                        }
                    }
                });

                // Store Server Metrics (Example: Meta) to align with dashboard
                if (data.metrics) {
                    localStorage.setItem('meta_trimestral', data.metrics.metaTrimestral.toString());
                    console.log(`[SyncDown] Meta actualizada: ${data.metrics.metaTrimestral}`);
                }

                toast.success("Sincronización completa", { id: toastId });
                console.log("[SyncDown] Finalizado correctamente.");
            }
        } catch (e) {
            console.error("[SyncDown] Error:", e);
            toast.error("Error al descargar datos", { id: toastId });
        }
    },

    async resetSyncStatus() {
        try {
            await db.transaction('rw', db.entidades, db.recolecciones, db.detalles, async () => {
                await db.entidades.toCollection().modify({ sync: 1 });
                await db.recolecciones.toCollection().modify({ sync: 1 });
                await db.detalles.toCollection().modify({ sync: 1 });
            });
            return true;
        } catch (e) {
            console.error("Error resetting sync status", e);
            return false;
        }
    }
};
