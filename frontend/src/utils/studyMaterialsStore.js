import { supabase } from '../lib/supabase';

export const STUDY_MATERIALS_UNFILED_ID = '__unfiled__';
export const MATERIAL_ACCEPT_ATTR = '.pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.rtf,.jpg,.jpeg,.png,.mp4,.webm,.ogg';

const STORAGE_BUCKET = 'study-materials';
const MATERIALS_TABLE = 'study_materials';
const FOLDERS_TABLE = 'study_material_folders';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireSupabase() {
    if (!supabase) {
        throw new Error('Supabase is not configured.');
    }
    return supabase;
}

function isValidUserId(value) {
    return UUID_PATTERN.test(String(value || '').trim());
}

function normalizeFolderId(value) {
    return String(value || '').trim();
}

export function normalizeStudyMaterialFolderName(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 48);
}

export function getStudyMaterialFolderKey(material) {
    return normalizeFolderId(material?.folderId) || STUDY_MATERIALS_UNFILED_ID;
}

function mapFolderRecord(record) {
    return {
        id: record.id,
        name: record.name,
        createdAt: record.created_at,
    };
}

function mapMaterialRecord(record) {
    return {
        id: record.id,
        folderId: record.folder_id || '',
        name: record.name,
        type: record.file_type || 'application/octet-stream',
        size: Number(record.size) || 0,
        storagePath: record.storage_path,
        uploadedAt: record.uploaded_at,
    };
}

async function uploadFileToStorage({ userId, file, folderId = '' }) {
    const client = requireSupabase();
    const safeName = `${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
    const folderSegment = folderId || 'root';
    const storagePath = `${userId}/${folderSegment}/${safeName}`;

    const { error } = await client.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'application/octet-stream',
        });

    if (error) {
        throw error;
    }

    return storagePath;
}

export async function listStudyMaterials(userId) {
    if (!isValidUserId(userId)) return [];

    const client = requireSupabase();
    const { data, error } = await client
        .from(MATERIALS_TABLE)
        .select('id, folder_id, name, file_type, size, storage_path, uploaded_at')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false });

    if (error) {
        throw new Error(error.message || 'Unable to read study materials.');
    }

    return (data || []).map(mapMaterialRecord);
}

export async function addStudyMaterials(userId, files, options = {}) {
    if (!isValidUserId(userId) || !Array.isArray(files) || files.length === 0) return [];

    const client = requireSupabase();
    const folderId = normalizeFolderId(options.folderId);
    const normalizedFiles = files.filter(Boolean);
    const insertedRows = [];

    for (const file of normalizedFiles) {
        const storagePath = await uploadFileToStorage({ userId, file, folderId });
        insertedRows.push({
            user_id: userId,
            folder_id: folderId || null,
            name: file.name,
            file_type: file.type || 'application/octet-stream',
            size: file.size || 0,
            storage_path: storagePath,
        });
    }

    const { data, error } = await client
        .from(MATERIALS_TABLE)
        .insert(insertedRows)
        .select('id, folder_id, name, file_type, size, storage_path, uploaded_at');

    if (error) {
        throw new Error(error.message || 'Unable to store study materials.');
    }

    return (data || []).map(mapMaterialRecord);
}

export async function removeStudyMaterial(id) {
    if (!id) return;

    const client = requireSupabase();
    const { data: existingRecord, error: readError } = await client
        .from(MATERIALS_TABLE)
        .select('id, storage_path')
        .eq('id', id)
        .maybeSingle();

    if (readError) {
        throw new Error(readError.message || 'Unable to remove study material.');
    }

    if (!existingRecord) return;

    const { error: deleteRecordError } = await client
        .from(MATERIALS_TABLE)
        .delete()
        .eq('id', id);

    if (deleteRecordError) {
        throw new Error(deleteRecordError.message || 'Unable to remove study material.');
    }

    if (existingRecord.storage_path) {
        const { error: storageError } = await client.storage
            .from(STORAGE_BUCKET)
            .remove([existingRecord.storage_path]);

        if (storageError) {
            throw new Error(storageError.message || 'Unable to remove study material file.');
        }
    }
}

export async function moveStudyMaterialToFolder(id, nextFolderId = '') {
    if (!id) return null;

    const client = requireSupabase();
    const folderId = normalizeFolderId(nextFolderId);

    const { data, error } = await client
        .from(MATERIALS_TABLE)
        .update({ folder_id: folderId || null })
        .eq('id', id)
        .select('id')
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'Unable to update that study material.');
    }

    return data || null;
}

export async function listStudyMaterialFolders(userId) {
    if (!isValidUserId(userId)) return [];

    const client = requireSupabase();
    const { data, error } = await client
        .from(FOLDERS_TABLE)
        .select('id, name, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        throw new Error(error.message || 'Unable to read study material folders.');
    }

    return (data || []).map(mapFolderRecord);
}

export async function createStudyMaterialFolder(userId, name) {
    const normalizedName = normalizeStudyMaterialFolderName(name);
    if (!isValidUserId(userId) || !normalizedName) return null;

    const existingFolders = await listStudyMaterialFolders(userId);
    const duplicate = existingFolders.find(
        (folder) => String(folder.name || '').toLowerCase() === normalizedName.toLowerCase()
    );

    if (duplicate) {
        return duplicate;
    }

    const client = requireSupabase();
    const { data, error } = await client
        .from(FOLDERS_TABLE)
        .insert({
            user_id: userId,
            name: normalizedName,
        })
        .select('id, name, created_at')
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'Unable to create that folder right now.');
    }

    return data ? mapFolderRecord(data) : null;
}

export async function removeStudyMaterialFolder(folderId) {
    const normalizedFolderId = normalizeFolderId(folderId);
    if (!normalizedFolderId) return;

    const client = requireSupabase();

    const { error: clearMaterialsError } = await client
        .from(MATERIALS_TABLE)
        .update({ folder_id: null })
        .eq('folder_id', normalizedFolderId);

    if (clearMaterialsError) {
        throw new Error(clearMaterialsError.message || 'Unable to update folder contents.');
    }

    const { error: deleteFolderError } = await client
        .from(FOLDERS_TABLE)
        .delete()
        .eq('id', normalizedFolderId);

    if (deleteFolderError) {
        throw new Error(deleteFolderError.message || 'Unable to remove that folder right now.');
    }
}

export async function renameStudyMaterialFolder(userId, folderId, nextName) {
    const normalizedFolderId = normalizeFolderId(folderId);
    const normalizedName = normalizeStudyMaterialFolderName(nextName);
    if (!isValidUserId(userId) || !normalizedFolderId || !normalizedName) return null;

    const existingFolders = await listStudyMaterialFolders(userId);
    const duplicate = existingFolders.find(
        (folder) => folder.id !== normalizedFolderId
            && String(folder.name || '').toLowerCase() === normalizedName.toLowerCase()
    );

    if (duplicate) {
        return duplicate;
    }

    const client = requireSupabase();
    const { data, error } = await client
        .from(FOLDERS_TABLE)
        .update({ name: normalizedName })
        .eq('id', normalizedFolderId)
        .select('id, name, created_at')
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'Unable to rename that folder right now.');
    }

    return data ? mapFolderRecord(data) : null;
}

export async function getStudyMaterialRecord(id) {
    if (!id) return null;

    const client = requireSupabase();
    const { data: record, error } = await client
        .from(MATERIALS_TABLE)
        .select('id, folder_id, name, file_type, size, storage_path, uploaded_at')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'Unable to load that study material.');
    }

    if (!record) return null;

    const { data: blob, error: downloadError } = await client.storage
        .from(STORAGE_BUCKET)
        .download(record.storage_path);

    if (downloadError) {
        throw new Error(downloadError.message || 'Unable to load that study material file.');
    }

    return {
        ...mapMaterialRecord(record),
        file: blob || null,
    };
}

export function formatMaterialSize(sizeInBytes) {
    const size = Number(sizeInBytes) || 0;

    if (size >= 1024 * 1024) {
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }

    if (size >= 1024) {
        return `${Math.round(size / 1024)} KB`;
    }

    return `${size} B`;
}

export function formatMaterialTimestamp(timestamp) {
    if (!timestamp) return '--';

    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return '--';

    return parsed.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
