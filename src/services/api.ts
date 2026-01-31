import type { SyncPayload } from "../types";

const API_CONFIG_KEY = 'guia_app_api_config';

export interface AppSettings {
    apiUrl: string;
    apiToken: string;
}

export const getSettings = (): AppSettings | null => {
    const stored = localStorage.getItem(API_CONFIG_KEY);
    return stored ? JSON.parse(stored) : null;
};

export const saveSettings = (settings: AppSettings) => {
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify(settings));
};

export const checkConnection = async (url: string, token: string): Promise<boolean> => {
    try {
        // Use GET for simple health check to avoid some POST-related CORS/Redirect complexities
        // Append action and token as query params
        const healthUrl = new URL(url);
        healthUrl.searchParams.append('action', 'health');
        healthUrl.searchParams.append('token', token);

        const response = await fetch(healthUrl.toString(), {
            method: 'GET',
            redirect: "follow",
            headers: {
                // No Content-Type needed for GET
            }
        });

        if (!response.ok) return false;

        const data = await response.json();
        return data.status === 'ok';
    } catch (e) {
        console.error("Health check failed", e);
        return false;
    }
};

const sendRequest = async (action: string, payload: any = {}) => {
    const settings = getSettings();
    if (!settings?.apiUrl || !settings?.apiToken) {
        throw new Error("Configuración de API no encontrada. Por favor configure la aplicación.");
    }

    try {
        const response = await fetch(settings.apiUrl, {
            method: "POST",
            redirect: "follow",
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            // FIX: Wrap payload in a property named 'payload' so Code.js can extract it
            body: JSON.stringify({
                action,
                token: settings.apiToken,
                payload: payload
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API Request failed: ${action}`, error);
        throw error;
    }
};

export const ApiService = {
    async syncData(payload: SyncPayload["payload"]) {
        return sendRequest('sync', payload);
    },

    async getData() {
        return sendRequest('GET_DATA');
    }
};
