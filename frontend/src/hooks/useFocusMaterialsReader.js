import React from 'react';
import {
    getStudyMaterialRecord,
    listStudyMaterialFolders,
    listStudyMaterials
} from '../utils/studyMaterialsStore';

function getViewerStateForRecord(record, objectUrl) {
    const materialType = record.type || '';
    const fileName = record.name || '';

    if (materialType === 'application/pdf') {
        return {
            viewerMode: 'pdf',
            viewerSrc: `${objectUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`,
            viewerText: '',
            viewerStatus: ''
        };
    }

    if (materialType.startsWith('image/')) {
        return {
            viewerMode: 'image',
            viewerSrc: objectUrl,
            viewerText: '',
            viewerStatus: ''
        };
    }

    if (materialType.startsWith('video/')) {
        return {
            viewerMode: 'video',
            viewerSrc: objectUrl,
            viewerText: '',
            viewerStatus: ''
        };
    }

    if (
        materialType.startsWith('text/')
        || materialType === 'application/rtf'
        || /\.(txt|md|rtf)$/i.test(fileName)
    ) {
        return {
            viewerMode: 'text',
            viewerSrc: '',
            viewerText: '',
            viewerStatus: ''
        };
    }

    return {
        viewerMode: 'download',
        viewerSrc: objectUrl,
        viewerText: '',
        viewerStatus: 'This file type cannot be previewed in the browser. You can download it to open locally.'
    };
}

export function useFocusMaterialsReader({ user, userDataOwnerId }) {
    const [studyMaterials, setStudyMaterials] = React.useState([]);
    const [studyMaterialFolders, setStudyMaterialFolders] = React.useState([]);
    const [isStudyMaterialsLoading, setIsStudyMaterialsLoading] = React.useState(false);
    const [isReaderOpen, setIsReaderOpen] = React.useState(false);
    const [selectedMaterialId, setSelectedMaterialId] = React.useState('');
    const [selectedMaterial, setSelectedMaterial] = React.useState(null);
    const [viewerMode, setViewerMode] = React.useState('none');
    const [viewerSrc, setViewerSrc] = React.useState('');
    const [viewerText, setViewerText] = React.useState('');
    const [viewerStatus, setViewerStatus] = React.useState('');

    const materialObjectUrlRef = React.useRef('');

    const clearMaterialPreview = React.useCallback(() => {
        if (materialObjectUrlRef.current) {
            URL.revokeObjectURL(materialObjectUrlRef.current);
            materialObjectUrlRef.current = '';
        }

        setSelectedMaterial(null);
        setViewerMode('none');
        setViewerSrc('');
        setViewerText('');
    }, []);

    const loadStudyMaterials = React.useCallback(async () => {
        if (!user) {
            setStudyMaterials([]);
            setStudyMaterialFolders([]);
            setSelectedMaterialId('');
            setViewerStatus('');
            clearMaterialPreview();
            return;
        }

        setIsStudyMaterialsLoading(true);

        try {
            const [storedMaterials, storedFolders] = await Promise.all([
                listStudyMaterials(userDataOwnerId),
                listStudyMaterialFolders(userDataOwnerId)
            ]);

            setStudyMaterials(storedMaterials);
            setStudyMaterialFolders(storedFolders);
            setSelectedMaterialId((previousId) => (
                storedMaterials.some((material) => material.id === previousId)
                    ? previousId
                    : (storedMaterials[0]?.id || '')
            ));
            setViewerStatus(storedMaterials.length === 0 ? 'No study materials are available yet.' : '');
        } catch (error) {
            console.error('Focus timer materials load error:', error);
            setStudyMaterials([]);
            setSelectedMaterialId('');
            setViewerStatus('Unable to load your study materials right now.');
        } finally {
            setIsStudyMaterialsLoading(false);
        }
    }, [clearMaterialPreview, user, userDataOwnerId]);

    React.useEffect(() => {
        void loadStudyMaterials();
    }, [loadStudyMaterials]);

    React.useEffect(() => {
        if (!selectedMaterialId) {
            clearMaterialPreview();
            return undefined;
        }

        let isCancelled = false;

        const loadSelectedMaterial = async () => {
            clearMaterialPreview();
            setViewerStatus('');

            try {
                const record = await getStudyMaterialRecord(selectedMaterialId);
                if (isCancelled) return;

                if (!record) {
                    setViewerStatus('Unable to open that study material.');
                    return;
                }

                setSelectedMaterial({
                    id: record.id,
                    name: record.name,
                    type: record.type,
                    size: record.size,
                    uploadedAt: record.uploadedAt,
                    folderId: record.folderId || '',
                });

                if (!(record.file instanceof Blob)) {
                    setViewerMode('unsupported');
                    setViewerStatus('This file type cannot be previewed inside focus mode yet.');
                    return;
                }

                const objectUrl = URL.createObjectURL(record.file);
                materialObjectUrlRef.current = objectUrl;
                const nextViewerState = getViewerStateForRecord(record, objectUrl);
                setViewerMode(nextViewerState.viewerMode);
                setViewerSrc(nextViewerState.viewerSrc);
                setViewerStatus(nextViewerState.viewerStatus);

                if (nextViewerState.viewerMode === 'text') {
                    const textContent = await record.file.text();
                    if (isCancelled) return;
                    setViewerText(textContent);
                }
            } catch (error) {
                if (isCancelled) return;
                console.error('Focus timer material preview error:', error);
                setViewerStatus('Unable to preview that study material right now.');
            }
        };

        void loadSelectedMaterial();

        return () => {
            isCancelled = true;
            if (materialObjectUrlRef.current) {
                URL.revokeObjectURL(materialObjectUrlRef.current);
                materialObjectUrlRef.current = '';
            }
        };
    }, [clearMaterialPreview, selectedMaterialId]);

    const openReader = React.useCallback(() => {
        setIsReaderOpen(true);
        void loadStudyMaterials();
    }, [loadStudyMaterials]);

    const closeReader = React.useCallback(() => {
        setIsReaderOpen(false);
    }, []);

    return {
        studyMaterials,
        studyMaterialFolders,
        isStudyMaterialsLoading,
        isReaderOpen,
        selectedMaterialId,
        selectedMaterial,
        viewerMode,
        viewerSrc,
        viewerText,
        viewerStatus,
        setSelectedMaterialId,
        openReader,
        closeReader,
    };
}
