import React from 'react';
import {
    FileText,
    FolderOpen,
    FolderPlus,
    Trash2,
    Upload,
    X
} from 'lucide-react';
import {
    formatMaterialSize,
    formatMaterialTimestamp,
    getStudyMaterialFolderKey,
    MATERIAL_ACCEPT_ATTR,
    normalizeStudyMaterialFolderName,
    STUDY_MATERIALS_UNFILED_ID
} from '../utils/studyMaterialsStore';

const ALL_FOLDER_KEY = '__all__';
const NO_FOLDER_LABEL = 'root';

export default function StudyMaterialsModal({
    isOpen,
    materials = [],
    folders = [],
    isLoading = false,
    isUploading = false,
    statusMessage = '',
    onClose,
    onUpload,
    onRemove,
    onCreateFolder,
    onRemoveFolder,
    onRenameFolder,
    onMoveMaterial,
}) {
    const fileInputRef = React.useRef(null);
    const [isDragActive, setIsDragActive] = React.useState(false);
    const [folderNameInput, setFolderNameInput] = React.useState('');
    const [selectedFolderKey, setSelectedFolderKey] = React.useState(ALL_FOLDER_KEY);
    const [uploadFolderId, setUploadFolderId] = React.useState('');
    const [isCreatingFolder, setIsCreatingFolder] = React.useState(false);
    const [activePanel, setActivePanel] = React.useState(null);
    const [editingFolderId, setEditingFolderId] = React.useState('');
    const [editingFolderName, setEditingFolderName] = React.useState('');
    const [isRenamingFolder, setIsRenamingFolder] = React.useState(false);
    const [expandedFolderId, setExpandedFolderId] = React.useState('');

    React.useEffect(() => {
        if (!isOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    React.useEffect(() => {
        if (!isOpen) return;
        setSelectedFolderKey(ALL_FOLDER_KEY);
        setActivePanel(null);
        setEditingFolderId('');
        setEditingFolderName('');
        setExpandedFolderId('');
    }, [isOpen]);

    React.useEffect(() => {
        const hasUploadFolder = !uploadFolderId || folders.some((folder) => folder.id === uploadFolderId);
        if (!hasUploadFolder) {
            setUploadFolderId('');
        }
    }, [folders, uploadFolderId]);

    React.useEffect(() => {
        if (selectedFolderKey === ALL_FOLDER_KEY) {
            return;
        }

        if (!folders.some((folder) => folder.id === selectedFolderKey)) {
            setSelectedFolderKey(ALL_FOLDER_KEY);
        }
    }, [folders, selectedFolderKey]);

    React.useEffect(() => {
        if (!expandedFolderId) return;

        if (!folders.some((folder) => folder.id === expandedFolderId)) {
            setExpandedFolderId('');
        }
    }, [expandedFolderId, folders]);

    const materialCountsByFolder = React.useMemo(() => {
        return materials.reduce((counts, material) => {
            const key = getStudyMaterialFolderKey(material);
            counts[key] = (counts[key] || 0) + 1;
            return counts;
        }, {});
    }, [materials]);

    const folderCollections = React.useMemo(() => {
        const dynamicFolders = folders.map((folder) => ({
            ...folder,
            key: folder.id,
            count: materialCountsByFolder[folder.id] || 0,
            isVirtual: false
        }));

        return [
            {
                id: ALL_FOLDER_KEY,
                key: ALL_FOLDER_KEY,
                name: 'All materials',
                count: materials.length,
                isVirtual: true
            },
            ...dynamicFolders
        ];
    }, [folders, materialCountsByFolder, materials.length]);

    const filteredMaterials = React.useMemo(() => {
        if (selectedFolderKey === ALL_FOLDER_KEY) {
            return materials;
        }

        return materials.filter((material) => getStudyMaterialFolderKey(material) === selectedFolderKey);
    }, [materials, selectedFolderKey]);

    const folderNameByKey = React.useMemo(() => {
        const map = {
            [ALL_FOLDER_KEY]: 'All materials',
            [STUDY_MATERIALS_UNFILED_ID]: NO_FOLDER_LABEL
        };

        folders.forEach((folder) => {
            map[folder.id] = folder.name;
        });

        return map;
    }, [folders]);

    const materialsByFolderId = React.useMemo(() => {
        return materials.reduce((accumulator, material) => {
            const key = getStudyMaterialFolderKey(material);
            if (!accumulator[key]) {
                accumulator[key] = [];
            }
            accumulator[key].push(material);
            return accumulator;
        }, {});
    }, [materials]);

    if (!isOpen) return null;

    const handleIncomingFiles = async (fileList) => {
        const files = Array.from(fileList || []).filter(Boolean);
        if (files.length === 0) return;

        await onUpload?.(files, { folderId: uploadFolderId });

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSelectFolder = (folderKey) => {
        setSelectedFolderKey(folderKey);

        if (folderKey === ALL_FOLDER_KEY) return;

        setUploadFolderId(folderKey);
    };

    const handleToggleFolderDetails = (folderId) => {
        handleSelectFolder(folderId);
        setExpandedFolderId((current) => (current === folderId ? '' : folderId));
    };

    const handleCreateFolder = async () => {
        const normalizedName = normalizeStudyMaterialFolderName(folderNameInput);
        if (!normalizedName || isCreatingFolder) return;

        setIsCreatingFolder(true);

        try {
            const nextFolder = await onCreateFolder?.(normalizedName);
            if (nextFolder?.id) {
                setFolderNameInput('');
                setSelectedFolderKey(nextFolder.id);
                setUploadFolderId(nextFolder.id);
                setExpandedFolderId(nextFolder.id);
            }
        } finally {
            setIsCreatingFolder(false);
        }
    };

    const handleStartRenameFolder = (folder) => {
        if (!folder?.id) return;
        setEditingFolderId(folder.id);
        setEditingFolderName(folder.name || '');
        setActivePanel('folder');
    };

    const handleCancelRenameFolder = () => {
        setEditingFolderId('');
        setEditingFolderName('');
    };

    const handleRenameFolder = async (folderId) => {
        if (!folderId || isRenamingFolder) return;

        setIsRenamingFolder(true);

        try {
            const renamedFolder = await onRenameFolder?.(folderId, editingFolderName);
            if (renamedFolder?.id) {
                if (selectedFolderKey === folderId) {
                    setSelectedFolderKey(folderId);
                }
                if (uploadFolderId === folderId) {
                    setUploadFolderId(folderId);
                }
                handleCancelRenameFolder();
            }
        } finally {
            setIsRenamingFolder(false);
        }
    };

    const togglePanel = (panelKey) => {
        setActivePanel((current) => (current === panelKey ? null : panelKey));
    };

    const activeFolderLabel = folderNameByKey[selectedFolderKey] || 'All materials';
    const uploadTargetLabel = uploadFolderId ? (folderNameByKey[uploadFolderId] || 'Selected folder') : NO_FOLDER_LABEL;
    const uploadTargetDisplayLabel = uploadFolderId ? uploadTargetLabel : 'Library root';

    return (
        <div
            className="fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(12,12,12,0.6)] p-4 backdrop-blur-md"
            onClick={onClose}
        >
            <div
                className="ff-panel-light grid h-[min(92vh,960px)] w-full max-w-6xl overflow-hidden rounded-[2.4rem] shadow-[0_36px_90px_rgba(0,0,0,0.28)] lg:grid-cols-[320px_minmax(0,1fr)]"
                onClick={(event) => event.stopPropagation()}
            >
                <section className="ff-panel-dark relative hidden h-full overflow-hidden px-6 py-6 text-[#f6f2eb] lg:flex lg:flex-col">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,177,20,0.18),transparent_30%),linear-gradient(180deg,transparent,rgba(255,255,255,0.02))]"></div>
                    <div className="relative z-10 flex h-full flex-col">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(255,177,20,0.2)] bg-[rgba(255,177,20,0.08)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f0d39a]">
                            <FolderOpen size={14} />
                            Study Materials
                        </div>

                        <h2 className="mt-6 max-w-[16rem] text-[2.05rem] font-bold leading-[1.02] tracking-[-0.05em]">
                            Keep your library sorted and focus-ready.
                        </h2>
                        <p className="mt-3 max-w-[16rem] text-[14px] leading-7 text-[#b8b1a6]">
                            Upload files, place them into folders, and open the right material faster from the focus reader.
                        </p>

                        <div className="mt-6 rounded-[1.45rem] border border-[rgba(255,255,255,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8f8a82]">Default upload folder</p>
                                    <p className="mt-2 text-[1.55rem] font-bold tracking-[-0.04em] text-[#f6f2eb]">{uploadTargetDisplayLabel}</p>
                                </div>
                                <span className="rounded-full border border-[rgba(255,177,20,0.2)] bg-[rgba(255,177,20,0.12)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f0d39a]">
                                    Active
                                </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[#b8b1a6]">
                                New files land here until you switch the target folder.
                            </p>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <HighlightCard label="Stored" value={`${materials.length}`} caption="files" />
                            <HighlightCard label="Folders" value={`${folders.length}`} caption="spaces" />
                        </div>
                    </div>
                </section>

                <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(255,188,90,0.12),transparent_28%),linear-gradient(180deg,#fbf7f1,#f2ece2)] p-4 sm:p-6">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close study materials manager"
                        className="absolute right-5 top-5 z-10 rounded-full border border-black/8 bg-white/82 p-2 text-[#171717] shadow-[0_10px_24px_rgba(42,32,20,0.08)] transition-colors hover:bg-white"
                    >
                        <X size={18} />
                    </button>

                    <div className="pr-14">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#867c70]">Resource Center</p>
                        <h3 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[#191919]">Study Materials</h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f675d]">
                            Three quick actions, then the full library right below.
                        </p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                        <ActionButton
                            icon={<Upload size={16} />}
                            label="Upload"
                            isActive={activePanel === 'upload'}
                            onClick={() => togglePanel('upload')}
                        />
                        <ActionButton
                            icon={<FolderPlus size={16} />}
                            label="Create Folder"
                            isActive={activePanel === 'folder'}
                            onClick={() => togglePanel('folder')}
                        />
                    </div>

                    <div className="mt-4 min-h-[11rem]">
                        {activePanel === 'upload' ? (
                            <div
                                className={`rounded-[1.8rem] border p-5 shadow-[0_24px_50px_rgba(44,35,24,0.08)] transition-all ${
                                    isDragActive
                                        ? 'border-[rgba(255,177,20,0.36)] bg-[rgba(255,255,255,0.88)]'
                                        : 'border-black/8 bg-[rgba(255,255,255,0.78)]'
                                }`}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    setIsDragActive(true);
                                }}
                                onDragLeave={(event) => {
                                    event.preventDefault();
                                    setIsDragActive(false);
                                }}
                                onDrop={async (event) => {
                                    event.preventDefault();
                                    setIsDragActive(false);
                                    await handleIncomingFiles(event.dataTransfer.files);
                                }}
                            >
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-[rgba(255,177,20,0.18)] bg-[rgba(255,177,20,0.12)] text-[var(--ff-accent)]">
                                            <Upload size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7d6f]">Upload files</p>
                                            <h4 className="mt-1 text-lg font-bold text-[#1d1a17]">Add new materials to your library</h4>
                                            <p className="mt-1 text-sm leading-6 text-[#6f675d]">
                                                Choose files or drag them into this card. They will appear in the reader after upload.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="w-fit rounded-full border border-black/8 bg-white/84 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7a7064]">
                                        {uploadTargetLabel}
                                    </span>
                                </div>

                                <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="ff-button-dark flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold transition-all"
                                        disabled={isUploading}
                                    >
                                        {isUploading ? 'Uploading...' : 'Choose Files'}
                                    </button>
                                    <label className="rounded-[1rem] border border-black/8 bg-white/86 px-3 py-2.5 text-left">
                                        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7a7064]">Upload to</span>
                                        <select
                                            value={uploadFolderId}
                                            onChange={(event) => setUploadFolderId(event.target.value)}
                                            className="mt-1 w-full bg-transparent text-sm font-semibold text-[#1f1b17] outline-none"
                                        >
                                            <option value="">{NO_FOLDER_LABEL}</option>
                                            {folders.map((folder) => (
                                                <option key={folder.id} value={folder.id}>
                                                    {folder.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={MATERIAL_ACCEPT_ATTR}
                                    multiple
                                    className="hidden"
                                    onChange={async (event) => {
                                        await handleIncomingFiles(event.target.files);
                                    }}
                                />
                            </div>
                        ) : null}

                        {activePanel === 'folder' ? (
                            <div className="flex h-[34rem] min-h-0 flex-col overflow-hidden rounded-[1.8rem] border border-black/8 bg-[rgba(255,255,255,0.8)] p-5 shadow-[0_24px_50px_rgba(44,35,24,0.08)]">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-[rgba(255,177,20,0.18)] bg-[rgba(255,177,20,0.12)] text-[var(--ff-accent)]">
                                        <FolderPlus size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7d6f]">Create folder</p>
                                        <h4 className="mt-1 text-lg font-bold text-[#1d1a17]">Start a new subject or project space</h4>
                                        <p className="mt-1 text-sm leading-6 text-[#6f675d]">
                                            Keep your reader organized by separating notes into focused folders.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                                    <input
                                        type="text"
                                        value={folderNameInput}
                                        onChange={(event) => setFolderNameInput(event.target.value)}
                                        onKeyDown={(event) => event.key === 'Enter' && handleCreateFolder()}
                                        placeholder="Create a folder"
                                        className="ff-input-light h-12 rounded-[1rem] px-4 text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCreateFolder}
                                        className="ff-button-dark h-12 rounded-full px-5 text-xs font-semibold uppercase tracking-[0.18em]"
                                        disabled={isCreatingFolder}
                                    >
                                        {isCreatingFolder ? 'Saving...' : 'Create Folder'}
                                    </button>
                                </div>

                                <div className="mt-5 flex min-h-0 flex-1 flex-col border-t border-black/8 pt-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7d6f]">Existing folders</p>
                                            <p className="mt-1 text-sm text-[#6f675d]">Rename or delete your current subject spaces here.</p>
                                        </div>
                                        <span className="rounded-full border border-black/8 bg-white/84 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7a7064]">
                                            {folders.length} folder{folders.length === 1 ? '' : 's'}
                                        </span>
                                    </div>

                                    <div className="mt-4 flex min-h-0 flex-1 overflow-hidden">
                                        <div className="min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                                        <div className="grid gap-2">
                                        {folders.length > 0 ? (
                                            folders.map((folder) => (
                                                <div key={folder.id}>
                                                    <div
                                                        className={`flex items-center justify-between gap-3 rounded-[1rem] border px-3 py-2.5 transition-colors ${
                                                            selectedFolderKey === folder.id
                                                                ? 'border-[rgba(255,177,20,0.24)] bg-[rgba(255,177,20,0.12)]'
                                                                : 'border-black/8 bg-white/76'
                                                        }`}
                                                    >
                                                        {editingFolderId === folder.id ? (
                                                            <div className="flex w-full flex-col gap-2 md:flex-row md:items-center">
                                                                <input
                                                                    type="text"
                                                                    value={editingFolderName}
                                                                    onChange={(event) => setEditingFolderName(event.target.value)}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === 'Enter') {
                                                                            void handleRenameFolder(folder.id);
                                                                        }
                                                                        if (event.key === 'Escape') {
                                                                            handleCancelRenameFolder();
                                                                        }
                                                                    }}
                                                                    className="ff-input-light h-11 flex-1 rounded-[0.95rem] px-3 text-sm"
                                                                    autoFocus
                                                                />
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void handleRenameFolder(folder.id)}
                                                                        className="ff-button-dark h-11 rounded-full px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
                                                                        disabled={isRenamingFolder}
                                                                    >
                                                                        {isRenamingFolder ? 'Saving...' : 'Save'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleCancelRenameFolder}
                                                                        className="h-11 rounded-full border border-black/8 bg-white/84 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5f5549] transition-colors hover:bg-white"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleFolderDetails(folder.id)}
                                                                    className="min-w-0 flex-1 text-left"
                                                                >
                                                                    <p className={`truncate text-sm font-semibold ${selectedFolderKey === folder.id ? 'text-[#8a5f10]' : 'text-[#2a241f]'}`}>
                                                                        {folder.name}
                                                                    </p>
                                                                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7a7064]">
                                                                        {folderCollections.find((item) => item.key === folder.id)?.count || 0} item{(folderCollections.find((item) => item.key === folder.id)?.count || 0) === 1 ? '' : 's'}
                                                                    </p>
                                                                </button>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleStartRenameFolder(folder)}
                                                                        className="rounded-full border border-black/8 bg-white/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5f5549] transition-colors hover:border-[rgba(255,177,20,0.18)] hover:text-[#8a5f10]"
                                                                    >
                                                                        Rename
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onRemoveFolder?.(folder.id)}
                                                                        className="rounded-full border border-black/8 bg-white/80 p-2 text-[#6f665b] transition-colors hover:border-[rgba(255,106,0,0.18)] hover:text-[#b45a24]"
                                                                        aria-label={`Remove ${folder.name} folder`}
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    {expandedFolderId === folder.id ? (
                                                        <div className="mt-2 rounded-[0.95rem] border border-black/8 bg-[rgba(255,255,255,0.72)] p-3">
                                                            {Array.isArray(materialsByFolderId[folder.id]) && materialsByFolderId[folder.id].length > 0 ? (
                                                                <div className="grid gap-2">
                                                                    {materialsByFolderId[folder.id].map((material) => (
                                                                        <div
                                                                            key={material.id}
                                                                            className="flex items-center justify-between gap-3 rounded-[0.85rem] border border-black/6 bg-white/72 px-3 py-2"
                                                                        >
                                                                            <div className="min-w-0">
                                                                                <p className="truncate text-sm font-semibold text-[#2a241f]" title={material.name}>
                                                                                    {material.name}
                                                                                </p>
                                                                                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7a7064]">
                                                                                    {formatMaterialSize(material.size)} • {formatMaterialTimestamp(material.uploadedAt)}
                                                                                </p>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => onRemove?.(material.id)}
                                                                                className="rounded-full border border-black/8 bg-white/80 p-2 text-[#6f665b] transition-colors hover:border-[rgba(255,106,0,0.18)] hover:text-[#b45a24]"
                                                                                aria-label={`Remove ${material.name}`}
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm text-[#6f675d]">No files inside this folder yet.</p>
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="rounded-[1rem] border border-dashed border-black/8 bg-white/56 px-4 py-6 text-center">
                                                <p className="text-sm font-semibold text-[#2a241f]">No folders yet.</p>
                                                <p className="mt-1 text-sm text-[#6f675d]">Create one above and it will show here.</p>
                                            </div>
                                        )}
                                        </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {activePanel === null ? (
                            <div className="rounded-[1.8rem] border border-dashed border-black/8 bg-[rgba(255,255,255,0.56)] px-5 py-8 text-center shadow-[0_16px_40px_rgba(44,35,24,0.04)]">
                                <p className="text-sm font-semibold text-[#2a241f]">Choose one action to get started.</p>
                                <p className="mt-1 text-sm text-[#6f675d]">Upload new files or create a folder to organize your library.</p>
                            </div>
                        ) : null}
                    </div>

                    {statusMessage ? (
                        <div className="pointer-events-none absolute bottom-5 left-5 right-5 z-20 sm:left-auto sm:right-6 sm:max-w-md">
                            <div className="rounded-[1.1rem] border border-[rgba(255,177,20,0.2)] bg-[rgba(255,244,220,0.96)] px-4 py-3 text-sm font-medium text-[#8d6420] shadow-[0_18px_36px_rgba(44,35,24,0.12)] backdrop-blur-sm">
                                {statusMessage}
                            </div>
                        </div>
                    ) : null}

                    {activePanel === null ? (
                        <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-[1.8rem] border border-black/10 bg-[rgba(255,255,255,0.66)] p-4 shadow-[0_18px_36px_rgba(44,35,24,0.08)]">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-[#2a241f]">Uploaded Materials</h4>
                                <p className="mt-1 text-xs text-[#887f73]">
                                    {filteredMaterials.length} item{filteredMaterials.length === 1 ? '' : 's'} in <span className="font-semibold text-[#2a241f]">{activeFolderLabel}</span>
                                </p>
                            </div>
                            <div className="rounded-full border border-black/8 bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7a7064]">
                                {isLoading ? 'Loading...' : 'Library ready'}
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                            {folderCollections.map((folder) => (
                                <button
                                    key={folder.key}
                                    type="button"
                                    onClick={() => handleSelectFolder(folder.key)}
                                    className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                                        selectedFolderKey === folder.key
                                            ? 'border-[rgba(255,177,20,0.24)] bg-[rgba(255,177,20,0.12)] text-[#8a5f10]'
                                            : 'border-black/8 bg-white/78 text-[#7a7064] hover:border-[rgba(255,177,20,0.18)] hover:text-[#8a5f10]'
                                    }`}
                                >
                                    {folder.name} • {folder.count}
                                </button>
                            ))}
                        </div>

                        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                            {isLoading ? (
                                <div className="grid gap-3">
                                    {Array.from({ length: 3 }).map((_, index) => (
                                        <div key={index} className="animate-pulse rounded-[1.4rem] border border-black/6 bg-white/60 p-4">
                                            <div className="h-4 w-32 rounded bg-[#e6ddd2]"></div>
                                            <div className="mt-3 h-3 w-48 rounded bg-[#eee6dc]"></div>
                                        </div>
                                    ))}
                                </div>
                            ) : filteredMaterials.length > 0 ? (
                                <div className="grid gap-3">
                                    {filteredMaterials.map((material) => (
                                        <div
                                            key={material.id}
                                            className="rounded-[1.4rem] border border-black/8 bg-[rgba(255,255,255,0.78)] p-4 shadow-[0_14px_30px_rgba(44,35,24,0.05)]"
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-4">
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-[rgba(255,177,20,0.16)] bg-[rgba(255,177,20,0.1)] text-[var(--ff-accent)]">
                                                        <FileText size={18} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold text-[#191919]" title={material.name}>
                                                            {material.name}
                                                        </p>
                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            <span className="rounded-full border border-black/8 bg-white/84 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7b7165]">
                                                                {formatMaterialSize(material.size)}
                                                            </span>
                                                            <span className="rounded-full border border-black/8 bg-white/84 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7b7165]">
                                                                {material.type?.split('/')[1] || material.type || 'file'}
                                                            </span>
                                                            <span className="rounded-full border border-[rgba(255,177,20,0.18)] bg-[rgba(255,177,20,0.1)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9a6a11]">
                                                                {folderNameByKey[getStudyMaterialFolderKey(material)] || NO_FOLDER_LABEL}
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#8a8074]">
                                                            Added {formatMaterialTimestamp(material.uploadedAt)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <label className="rounded-full border border-black/8 bg-white/84 px-3 py-2">
                                                        <span className="sr-only">Move {material.name} to folder</span>
                                                        <select
                                                            value={material.folderId || ''}
                                                            onChange={(event) => onMoveMaterial?.(material.id, event.target.value)}
                                                            className="bg-transparent text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5f5549] outline-none"
                                                        >
                                                                <option value="">{NO_FOLDER_LABEL}</option>
                                                                {folders.map((folder) => (
                                                                    <option key={folder.id} value={folder.id}>
                                                                        {folder.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => onRemove?.(material.id)}
                                                        className="rounded-full border border-black/8 bg-white/80 p-2 text-[#7c7167] transition-colors hover:border-[rgba(255,106,0,0.18)] hover:text-[#b45a24]"
                                                        aria-label={`Remove ${material.name}`}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-[1.6rem] border border-dashed border-black/10 bg-white/56 px-6 py-12 text-center text-[#6f665b]">
                                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1rem] border border-[rgba(255,177,20,0.18)] bg-[rgba(255,177,20,0.12)] text-[var(--ff-accent)]">
                                        <FolderOpen size={20} />
                                    </div>
                                    <p className="text-sm font-semibold text-[#2d2823]">
                                        {selectedFolderKey === ALL_FOLDER_KEY
                                            ? 'No study materials uploaded yet.'
                                            : `No files inside ${activeFolderLabel} yet.`}
                                    </p>
                                    <p className="mt-1 text-xs text-[#8a8074]">
                                        {selectedFolderKey === ALL_FOLDER_KEY
                                            ? 'Upload your first notes, slides, or PDFs to start building the library.'
                                            : 'Upload into this folder or move an existing file here to keep things organized.'}
                                    </p>
                                </div>
                            )}
                        </div>

                        </div>
                    ) : null}
                </section>
            </div>
        </div>
    );
}

function ActionButton({ icon, label, isActive, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all ${
                isActive
                    ? 'border-[rgba(255,177,20,0.24)] bg-[rgba(255,177,20,0.12)] text-[#8a5f10] shadow-[0_12px_24px_rgba(255,177,20,0.12)]'
                    : 'border-black/8 bg-white/78 text-[#2b251f] hover:border-[rgba(255,177,20,0.18)] hover:text-[#8a5f10]'
            }`}
        >
            {icon}
            {label}
        </button>
    );
}

function HighlightCard({ label, value, caption }) {
    return (
        <div className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-4 shadow-[0_16px_30px_rgba(0,0,0,0.12)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8f8a82]">{label}</p>
            <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[2rem] font-bold tracking-[-0.04em] text-[#f6f2eb]">{value}</span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8f8a82]">{caption}</span>
            </div>
        </div>
    );
}
