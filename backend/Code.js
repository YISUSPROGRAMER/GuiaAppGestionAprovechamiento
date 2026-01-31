/**
 * @OnlyCurrentDoc
 * Limit access strictly to the spreadsheet this script is bound to.
 * This reduces security warnings by NOT requesting access to all of Drive.
 */

// CONFIGURATION & SECURITY
// 1. Generate a strong random token for API_TOKEN. Do NOT share this.
const API_TOKEN = "CHANGE_THIS_TO_YOUR_SECURE_TOKEN_12345";


function doGet(e) {
    const lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        const output = JSON.stringify(handleRequest(e));
        return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ error: e.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

function doPost(e) {
    const lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        const output = JSON.stringify(handleRequest(e));
        return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ error: e.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

function handleRequest(e) {
    let token, action, payload;

    // Detect if GET (parameters) or POST (postData)
    if (e.postData && e.postData.contents) {
        try {
            const data = JSON.parse(e.postData.contents);
            token = data.token;
            action = data.action;
            payload = data.payload;
        } catch (error) {
            throw new Error("Invalid JSON in POST body");
        }
    } else {
        // GET Query Parameters
        token = e.parameter.token;
        action = e.parameter.action;
        payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : null;
    }

    // Security: Validate Token
    if (!token || token !== API_TOKEN) {
        return errorResponse("Access Denied: Invalid Security Token.");
    }

    // STRICT SCOPE ACCESS
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
        throw new Error("Script must be bound to a Spreadsheet.");
    }

    // Dispatcher
    switch (action) {
        case 'health':
            return {
                status: 'ok',
                message: 'Connection successful',
                timestamp: new Date().toISOString(),
                method: e.postData ? 'POST' : 'GET'
            };
        case 'GET_DATA':
            return getData(ss);
        case 'sync':
            return syncData(ss, payload);
        default:
            return { error: "Invalid action: " + action };
    }
}

function syncData(ss, payload) {
    const results = {
        entidades: [],
        recolecciones: [],
        detalles: []
    };
    const logs = [];

    // Debug Payload
    try {
        if (payload) {
            // FIX: Handle potential double-nesting or wrong extraction
            if (payload.payload) {
                logs.push("Unwrapping nested 'payload' property...");
                payload = payload.payload;
            }

            logs.push("Payload keys: " + Object.keys(payload).join(", "));
            if (payload.entidades) logs.push(`Entidades count: ${payload.entidades.length}`);
            else logs.push("Key 'entidades' mismatch or missing");

        } else {
            logs.push("Payload is null/undefined");
        }
    } catch (e) {
        logs.push("Error inspecting payload: " + e.toString());
    }

    // Helper: Parse YYYY-MM-DD to Date object
    const parseDate = (dateStr) => {
        if (!dateStr) return "";
        // Assume YYYY-MM-DD. We add T12:00:00 to avoid timezone issues shifting the day
        const parts = dateStr.split("-");
        if (parts.length === 3) {
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        return dateStr;
    };

    // Helper to find sheet case-insensitive
    const getSheetByNameCaseInsensitive = (name) => {
        const sheets = ss.getSheets();
        for (const sheet of sheets) {
            if (sheet.getName().toLowerCase() === name.toLowerCase()) {
                return sheet;
            }
        }
        return null;
    };

    // Generic Sync Function (Upsert + Delete)
    const processSheet = (sheetName, items, idIndex, rowMapper) => {
        let sheet = ss.getSheetByName(sheetName);
        if (!sheet) sheet = getSheetByNameCaseInsensitive(sheetName);

        if (!sheet) {
            logs.push(`ERROR: Sheet '${sheetName}' not found.`);
            return [];
        }

        const processedIds = [];
        let addedCount = 0;
        let updatedCount = 0;
        let deletedCount = 0;

        // Process items
        items.forEach(item => {
            const id = item.id;

            // Re-fetch range (inefficient but safe for correctness)
            const lastRow = sheet.getLastRow();
            let rangeIds = [];
            if (lastRow > 1) {
                rangeIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
            }
            // Strict match might fail if types differ (string vs no), try loose or string conv
            const rowIndex = rangeIds.findIndex(rid => String(rid) === String(id));

            // Check "deleted" status (handle '1', 1, true)
            const isDeleted = (item.deleted === 1 || item.deleted === '1' || item.deleted === true);

            if (isDeleted) {
                // DELETE
                if (rowIndex !== -1) {
                    logs.push(`[DELETE] Deleting ID ${id} at row ${rowIndex + 2}`);
                    sheet.deleteRow(rowIndex + 2);
                    deletedCount++;
                } else {
                    logs.push(`[DELETE] WARN: ID ${id} marked for deletion but not found in sheet.`);
                }
            } else {
                // UPSERT
                const rowData = rowMapper(item);
                if (rowIndex !== -1) {
                    // Update
                    sheet.getRange(rowIndex + 2, 1, 1, rowData.length).setValues([rowData]);
                    updatedCount++;
                } else {
                    // Append
                    sheet.appendRow(rowData);
                    addedCount++;
                }
            }
            processedIds.push(id);
        });

        logs.push(`Sheet '${sheet.getName()}': +${addedCount}, ~${updatedCount}, -${deletedCount}`);
        return processedIds;
    };

    if (payload.entidades && payload.entidades.length > 0) {
        logs.push(`Processing ${payload.entidades.length} Entidades...`);
        results.entidades = processSheet("Entidades", payload.entidades, 0, (e) => [
            e.id,
            e.nombre,
            e.tipo || "",
            parseDate(e.fechaVisitaGestion),
            e.linkCarpetaDrive || ""
        ]);
    }

    if (payload.recolecciones && payload.recolecciones.length > 0) {
        logs.push(`Processing ${payload.recolecciones.length} Recolecciones...`);
        results.recolecciones = processSheet("Recolecciones", payload.recolecciones, 0, (r) => [
            r.id,
            r.idEntidad,
            r.nombreEntidad,
            parseDate(r.fechaRecoleccion)
        ]);
    }

    if (payload.detalles && payload.detalles.length > 0) {
        logs.push(`Processing ${payload.detalles.length} Detalles...`);
        results.detalles = processSheet("Detalle Materiales", payload.detalles, 0, (d) => [
            d.id,
            d.idRecoleccion,
            d.idEntidad,
            d.nombreEntidad,
            parseDate(d.fechaRecoleccion),
            d.material,
            Number(d.pesoKg)
        ]);
    }

    return { success: true, added: results, logs: logs };
}

function getData(ss) {
    // 1. Fetch Entidades
    const entSheet = ss.getSheetByName("Entidades");
    const entRows = entSheet ? entSheet.getDataRange().getValues().slice(1) : [];
    const entidades = entRows.map(row => ({
        id: row[0],
        nombre: row[1],
        tipo: row[2],
        fechaVisitaGestion: row[3],
        linkCarpetaDrive: row[4]
    })).filter(e => e.id); // Filter empty rows

    // 2. Fetch Recolecciones
    const recSheet = ss.getSheetByName("Recolecciones");
    const recRows = recSheet ? recSheet.getDataRange().getValues().slice(1) : [];
    const recolecciones = recRows.map(row => ({
        id: row[0],
        idEntidad: row[1],
        nombreEntidad: row[2],
        fechaRecoleccion: row[3]
    })).filter(r => r.id);

    // 3. Fetch Detalles
    const detSheet = ss.getSheetByName("Detalle Materiales");
    const detRows = detSheet ? detSheet.getDataRange().getValues().slice(1) : [];
    const detalles = detRows.map(row => ({
        id: row[0],
        idRecoleccion: row[1],
        idEntidad: row[2],
        nombreEntidad: row[3],
        fechaRecoleccion: row[4],
        material: row[5],
        pesoKg: Number(row[6])
    })).filter(d => d.id);

    // 4. Fetch Dashboard Metrics
    const dashSheet = ss.getSheetByName("Dashboard");
    const metrics = {
        metaTrimestral: 0,
        totalRecolectado: 0,
        percentCumplimiento: 0
    };

    if (dashSheet) {
        try {
            metrics.metaTrimestral = dashSheet.getRange("B4").getValue();
            metrics.totalRecolectado = dashSheet.getRange("B5").getValue();
            metrics.percentCumplimiento = dashSheet.getRange("B7").getValue();
        } catch (e) { /* Ignore if cells empty */ }
    }

    return {
        entidades,
        recolecciones,
        detalles,
        metrics
    };
}
