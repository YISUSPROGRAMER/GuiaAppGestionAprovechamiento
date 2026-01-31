import Dexie, { type Table } from 'dexie';
import type { Entidad, Recoleccion, DetalleMaterial } from '../types';

export class GuiaAppDB extends Dexie {
    entidades!: Table<Entidad, string>;
    recolecciones!: Table<Recoleccion, string>;
    detalles!: Table<DetalleMaterial, string>;

    constructor() {
        super('GuiaAppDB');
        this.version(1).stores({
            entidades: 'id, nombre, tipo, sync, deleted',
            recolecciones: 'id, idEntidad, fechaRecoleccion, sync, deleted',
            detalles: 'id, idRecoleccion, idEntidad, sync, deleted'
        });
        this.version(2).stores({
            recolecciones: 'id, idEntidad, fechaRecoleccion, sync'
        });
        this.version(3).stores({
            entidades: 'id, nombre, tipo, fechaVisitaGestion, sync, deleted'
        });
    }
}

export const db = new GuiaAppDB();

// Helper to generate IDs pending backend sync/confirmation
// In a real scenario we'd query the last ID. Here valid strategy is 
// to use timestamp or UUID for local, and letting backend confirm or just relying on unique local gen.
// The specs say ENT001. We need to know the last one.
// We can store a metadata table or just query the max ID currently in DB.

export async function generateNextId(prefix: "ENT" | "REC" | "DET"): Promise<string> {
    let table: Table<any, string>;

    if (prefix === "ENT") table = db.entidades;
    else if (prefix === "REC") table = db.recolecciones;
    else table = db.detalles;

    const lastRecord = await table.orderBy('id').last();

    let nextNum = 1;
    if (lastRecord && lastRecord.id.startsWith(prefix)) {
        const lastNum = parseInt(lastRecord.id.replace(prefix, ''), 10);
        if (!isNaN(lastNum)) {
            nextNum = lastNum + 1;
        }
    }

    return `${prefix}${nextNum.toString().padStart(3, '0')}`;
}
