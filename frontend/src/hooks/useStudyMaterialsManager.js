import React from 'react';
import {
    addStudyMaterials,
    createStudyMaterialFolder,
    listStudyMaterials,
    listStudyMaterialFolders,
    moveStudyMaterialToFolder,
    renameStudyMaterialFolder,
    removeStudyMaterial,
    removeStudyMaterialFolder
} from '../utils/studyMaterialsStore';

export function useStudyMaterialsManager({ user, userDataOwnerId }) {
    const [studyMaterials, setStudyMaterials] = React.useState([]);
    const [studyMaterialFolders, setStudyMaterialFolders] = React.useState([]);
    const [isStudyMaterialsLoading, setIsStudyMaterialsLoading] = React.useState(false);
    const [isStudyMaterialsUploading, setIsStudyMaterialsUploading] = React.useState(false);
    const [studyMaterialsStatus, setStudyMaterialsStatus] = React.useState('');

    const refreshStudyMaterials = React.useCallback(async () => {
        if (!user) {
            setStudyMaterials([]);
            setStudyMaterialFolders([]);
            return { materials: [], folders: [] };
        }

        const [storedMaterials, storedFolders] = await Promise.all([
            listStudyMaterials(userDataOwnerId),
            listStudyMaterialFolders(userDataOwnerId)
        ]);

        setStudyMaterials(storedMaterials);
        setStudyMaterialFolders(storedFolders);

        return {
            materials: storedMaterials,
            folders: storedFolders,
        };
    }, [user, userDataOwnerId]);

    const loadStudyMaterials = React.useCallback(async () => {
        setIsStudyMaterialsLoading(true);

        try {
            await refreshStudyMaterials();
        } catch (error) {
            console.error('Study materials load error:', error);
            setStudyMaterialsStatus('Unable to load study materials right now.');
        } finally {
            setIsStudyMaterialsLoading(false);
        }
    }, [refreshStudyMaterials]);

    React.useEffect(() => {
        if (!user) {
            setStudyMaterials([]);
            setStudyMaterialFolders([]);
            return;
        }

        void loadStudyMaterials();
    }, [loadStudyMaterials, user]);

    const uploadStudyMaterials = React.useCallback(async (files, options = {}) => {
        setIsStudyMaterialsUploading(true);

        try {
            await addStudyMaterials(userDataOwnerId, files, options);
            await refreshStudyMaterials();
            setStudyMaterialsStatus(`${files.length} file${files.length === 1 ? '' : 's'} uploaded successfully.`);
        } catch (error) {
            console.error('Study materials upload error:', error);
            setStudyMaterialsStatus(error?.message || 'Unable to upload study materials right now.');
        } finally {
            setIsStudyMaterialsUploading(false);
        }
    }, [refreshStudyMaterials, userDataOwnerId]);

    const createFolder = React.useCallback(async (folderName) => {
        try {
            const createdFolder = await createStudyMaterialFolder(userDataOwnerId, folderName);
            await refreshStudyMaterials();
            setStudyMaterialsStatus(createdFolder ? `Folder "${createdFolder.name}" is ready.` : 'Folder created.');
            return createdFolder;
        } catch (error) {
            console.error('Study materials folder create error:', error);
            setStudyMaterialsStatus(error?.message || 'Unable to create that folder right now.');
            return null;
        }
    }, [refreshStudyMaterials, userDataOwnerId]);

    const removeMaterial = React.useCallback(async (materialId) => {
        try {
            await removeStudyMaterial(materialId);
            setStudyMaterials((previousMaterials) => previousMaterials.filter((material) => material.id !== materialId));
            setStudyMaterialsStatus('Study material removed.');
        } catch (error) {
            console.error('Study material remove error:', error);
            setStudyMaterialsStatus(error?.message || 'Unable to remove that material right now.');
        }
    }, []);

    const removeFolder = React.useCallback(async (folderId) => {
        try {
            await removeStudyMaterialFolder(folderId);
            await refreshStudyMaterials();
            setStudyMaterialsStatus('Folder removed. Its files now have no folder.');
        } catch (error) {
            console.error('Study materials folder remove error:', error);
            setStudyMaterialsStatus(error?.message || 'Unable to remove that folder right now.');
        }
    }, [refreshStudyMaterials]);

    const renameFolder = React.useCallback(async (folderId, nextName) => {
        try {
            const renamedFolder = await renameStudyMaterialFolder(userDataOwnerId, folderId, nextName);
            await refreshStudyMaterials();
            setStudyMaterialsStatus(renamedFolder ? `Folder renamed to "${renamedFolder.name}".` : 'Folder updated.');
            return renamedFolder;
        } catch (error) {
            console.error('Study materials folder rename error:', error);
            setStudyMaterialsStatus(error?.message || 'Unable to rename that folder right now.');
            return null;
        }
    }, [refreshStudyMaterials, userDataOwnerId]);

    const moveMaterial = React.useCallback(async (materialId, nextFolderId) => {
        try {
            await moveStudyMaterialToFolder(materialId, nextFolderId);
            await refreshStudyMaterials();
            setStudyMaterialsStatus('Study material updated.');
        } catch (error) {
            console.error('Study material move error:', error);
            setStudyMaterialsStatus(error?.message || 'Unable to move that file right now.');
        }
    }, [refreshStudyMaterials]);

    return {
        studyMaterials,
        studyMaterialFolders,
        isStudyMaterialsLoading,
        isStudyMaterialsUploading,
        studyMaterialsStatus,
        setStudyMaterialsStatus,
        loadStudyMaterials,
        uploadStudyMaterials,
        createFolder,
        removeMaterial,
        removeFolder,
        renameFolder,
        moveMaterial,
    };
}
