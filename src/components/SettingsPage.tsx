import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Wifi, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveSettings, checkConnection } from '../services/api';
import { toast } from 'react-hot-toast';

export const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const [apiUrl, setApiUrl] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        const settings = getSettings();
        if (settings) {
            setApiUrl(settings.apiUrl);
            setApiToken(settings.apiToken);
        }
    }, []);

    const handleTestConnection = async () => {
        if (!apiUrl || !apiToken) {
            toast.error("Ingrese URL y Token");
            return;
        }

        setIsChecking(true);
        setConnectionStatus('idle');

        try {
            const isOk = await checkConnection(apiUrl, apiToken);
            if (isOk) {
                setConnectionStatus('success');
                toast.success("¡Conexión exitosa!");
            } else {
                setConnectionStatus('error');
                toast.error("No se pudo conectar. Verifique URL y Token.");
            }
        } catch (error) {
            setConnectionStatus('error');
            toast.error("Error de conexión network");
        } finally {
            setIsChecking(false);
        }
    };

    const handleSave = () => {
        if (!apiUrl || !apiToken) {
            toast.error("Campos requeridos");
            return;
        }

        saveSettings({ apiUrl, apiToken });
        toast.success("Configuración guardada");
        // Optionally navigate back or stay
        navigate('/');
    };

    return (
        <div className="p-4 bg-gray-50 min-h-screen">
            <header className="flex items-center space-x-4 mb-8">
                <button onClick={() => navigate('/')} className="p-2 -ml-2 text-gray-600">
                    <ArrowLeft />
                </button>
                <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
            </header>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Google Apps Script URL
                        </label>
                        <input
                            type="url"
                            placeholder="https://script.google.com/..."
                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 break-all"
                            value={apiUrl}
                            onChange={e => {
                                setApiUrl(e.target.value);
                                setConnectionStatus('idle');
                            }}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            La URL de la aplicación web desplegada.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            API Token (Secreto)
                        </label>
                        <input
                            type="password"
                            placeholder="su_token_secreto_aquí"
                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            value={apiToken}
                            onChange={e => {
                                setApiToken(e.target.value);
                                setConnectionStatus('idle');
                            }}
                        />
                    </div>
                </div>

                {/* Status Indicator */}
                {connectionStatus !== 'idle' && (
                    <div className={`p-4 rounded-xl flex items-center space-x-3 ${connectionStatus === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                        {connectionStatus === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        <span className="font-medium text-sm">
                            {connectionStatus === 'success'
                                ? "Conexión estable con Google Sheets"
                                : "Falló la conexión. Revise sus credenciales."}
                        </span>
                    </div>
                )}

                <div className="pt-4 flex flex-col space-y-3">
                    <button
                        onClick={handleTestConnection}
                        disabled={isChecking}
                        className={`w-full py-3 rounded-xl font-bold border-2 border-gray-100 text-gray-600 hover:bg-gray-50 transition flex justify-center items-center space-x-2 ${isChecking ? 'opacity-70' : ''}`}
                    >
                        {isChecking ? (
                            <span>Probando...</span>
                        ) : (
                            <>
                                <Wifi size={20} />
                                <span>Probar Conexión</span>
                            </>
                        )}
                    </button>

                    <button
                        onClick={async () => {
                            if (confirm("¿Estás seguro? Esto marcará TODOS los datos locales como 'pendientes de subir'. Úsalo solo si borraste la base de datos de Google.")) {
                                const { SyncService } = await import('../services/sync');
                                const success = await SyncService.resetSyncStatus();
                                if (success) {
                                    toast.success("Marcados para subir. Iniciando sincronización...");
                                    SyncService.syncUp().catch(e => console.error(e));
                                } else {
                                    toast.error("Error al resetear");
                                }
                            }
                        }}
                        className="w-full py-3 rounded-xl font-bold border-2 border-red-100 text-red-600 hover:bg-red-50 transition flex justify-center items-center space-x-2"
                    >
                        <AlertCircle size={20} />
                        <span>Forzar Re-subida Total</span>
                    </button>

                    <button
                        onClick={handleSave}
                        className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition flex justify-center items-center space-x-2"
                    >
                        <Save size={20} />
                        <span>Guardar Configuración</span>
                    </button>
                </div>
            </div>

            <div className="mt-8 text-center text-xs text-gray-400">
                Guia App v1.0.0
            </div>
        </div>
    );
};
