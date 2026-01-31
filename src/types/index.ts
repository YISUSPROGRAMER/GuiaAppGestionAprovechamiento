export const TipoEstablecimiento = {
    INSTITUCION_EDUCATIVA: "Institución Educativa",
    EMPRESA_ENTIDAD: "Empresa/Entidad",
    HOTEL: "Hotel",
    CONJUNTO_RESIDENCIAL: "Conjunto residencial",
    ACTIVIDADES_GS: "Actividades GS"
} as const;

export type TipoEstablecimiento = typeof TipoEstablecimiento[keyof typeof TipoEstablecimiento];

export const TipoMaterial = {
    PET: "PET",
    CARTON: "Cartón",
    PLASTICO: "Plástico",
    PAPEL: "Papel",
    VIDRIO: "Vidrio",
    ORGANICO: "Orgánico",
    CHATARRA: "Chatarra",
    ARCHIVO: "Archivo"
} as const;

export type TipoMaterial = typeof TipoMaterial[keyof typeof TipoMaterial];

export interface Entidad {
    id: string; // ENT001
    nombre: string;
    tipo: TipoEstablecimiento;
    fechaVisitaGestion: string; // ISO Date "YYYY-MM-DD" or "DD/MM/YYYY" as per sheets
    linkCarpetaDrive?: string;
    sync?: number; // 0 for synced, 1 for pending
    deleted?: number; // 1 if deleted
}

export interface Recoleccion {
    id: string; // REC001
    idEntidad: string;
    nombreEntidad: string;
    fechaRecoleccion: string;
    sync?: number;
    deleted?: number;
}

export interface DetalleMaterial {
    id: string; // DET001
    idRecoleccion: string;
    idEntidad: string;
    nombreEntidad: string;
    fechaRecoleccion: string;
    material: TipoMaterial;
    pesoKg: number;
    sync?: number;
    deleted?: number;
}

export interface DashboardMetricas {
    metaTrimestral: number;
    totalRecolectado: number;
    percentCumplimiento: number;
    totalEntidades: number;
    totalRecolecciones: number;
    promedioKgPorRecoleccion: number;
    faltante: number;
}

export interface SyncPayload {
    token: string;
    action: "TEST_CONNECTION" | "SYNC_DATA" | "GET_DATA";
    payload?: {
        entidades?: Entidad[];
        recolecciones?: Recoleccion[];
        detalles?: DetalleMaterial[];
    };
}
