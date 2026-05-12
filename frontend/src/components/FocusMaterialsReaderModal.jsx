import React from 'react';
import {
    AlignLeft,
    BookOpen,
    FileImage,
    FileText,
    Film,
    FolderOpen,
    X
} from 'lucide-react';
import {
    formatMaterialSize,
    formatMaterialTimestamp,
    getStudyMaterialFolderKey,
    STUDY_MATERIALS_UNFILED_ID
} from '../utils/studyMaterialsStore';

const ALL_FOLDER_KEY = '__all__';
const NO_FOLDER_LABEL = 'root';

function getMaterialIcon(viewerMode) {
    if (viewerMode === 'image') return <FileImage size={18} />;
    if (viewerMode === 'text') return <AlignLeft size={18} />;
    if (viewerMode === 'video') return <Film size={18} />;
    return <FileText size={18} />;
}

export default function FocusMaterialsReaderModal({
    isOpen,
    materials = [],
    folders = [],
    isLoading = false,
    selectedMaterialId = '',
    selectedMaterial = null,
    viewerMode = 'none',
    viewerSrc = '',
    viewerText = '',
    viewerStatus = '',
    onSelectMaterial,
    onOpenFullScreen,
    onClose,
}) {
    const [activeFolderKey, setActiveFolderKey] = React.useState(ALL_FOLDER_KEY);

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

    const materialCountsByFolder = React.useMemo(() => {
        return materials.reduce((counts, material) => {
            const key = getStudyMaterialFolderKey(material);
            counts[key] = (counts[key] || 0) + 1;
            return counts;
        }, {});
    }, [materials]);

    const folderCollections = React.useMemo(() => {
        return [
            {
                key: ALL_FOLDER_KEY,
                name: 'All materials',
                count: materials.length,
                isVirtual: true
            },
            ...folders.map((folder) => ({
                key: folder.id,
                name: folder.name,
                count: materialCountsByFolder[folder.id] || 0,
                isVirtual: false
            }))
        ];
    }, [folders, materialCountsByFolder, materials.length]);

    React.useEffect(() => {
        if (!isOpen) return;

        if (activeFolderKey === ALL_FOLDER_KEY) {
            return;
        }

        if (!folders.some((folder) => folder.id === activeFolderKey)) {
            setActiveFolderKey(ALL_FOLDER_KEY);
        }
    }, [activeFolderKey, folders, isOpen]);

    const filteredMaterials = React.useMemo(() => {
        if (activeFolderKey === ALL_FOLDER_KEY) return materials;
        return materials.filter((material) => getStudyMaterialFolderKey(material) === activeFolderKey);
    }, [activeFolderKey, materials]);

    const folderNameByKey = React.useMemo(() => {
        const nextMap = {
            [ALL_FOLDER_KEY]: 'All materials',
            [STUDY_MATERIALS_UNFILED_ID]: NO_FOLDER_LABEL
        };

        folders.forEach((folder) => {
            nextMap[folder.id] = folder.name;
        });

        return nextMap;
    }, [folders]);

    const selectedTypeLabel = selectedMaterial?.type?.split('/')[1] || selectedMaterial?.type || 'file';
    const selectedFolderLabel = folderNameByKey[getStudyMaterialFolderKey(selectedMaterial)] || NO_FOLDER_LABEL;
    const activeFolderLabel = folderNameByKey[activeFolderKey] || 'All materials';

    if (!isOpen) return null;

    const handleSelectFolder = (folderKey) => {
        setActiveFolderKey(folderKey);

        const nextMaterial = folderKey === ALL_FOLDER_KEY
            ? materials[0]
            : materials.find((material) => getStudyMaterialFolderKey(material) === folderKey);

        onSelectMaterial?.(nextMaterial?.id || '');
    };

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(10,10,10,0.68)] p-4 backdrop-blur-md"
            onClick={onClose}
        >
            <div
                className="ff-panel-dark grid h-[82vh] w-full max-w-[1120px] overflow-hidden rounded-[2.2rem] border border-white/8 shadow-[0_34px_80px_rgba(0,0,0,0.34)] lg:grid-cols-[300px_minmax(0,1fr)]"
                onClick={(event) => event.stopPropagation()}
            >
                <aside className="flex min-h-0 flex-col border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.016))] p-4 lg:border-b-0 lg:border-r lg:p-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-[0.95rem] border border-[rgba(255,177,20,0.18)] bg-[rgba(255,177,20,0.08)] text-[var(--ff-accent)]">
                            <FolderOpen size={17} />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f8a82]">Focus Reader</p>
                            <h3 className="mt-1 text-[1.05rem] font-bold text-[#f6f2eb]">Study Library</h3>
                        </div>
                    </div>

                    <p className="mt-3 text-[13px] leading-6 text-[#b8b1a6]">
                        Open notes and references without leaving your active session.
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                        <ReaderStatCard label="Files" value={materials.length} />
                        <ReaderStatCard label="Folders" value={folders.length} />
                    </div>

                    <div className="mt-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8f8a82]">Folders</p>
                        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                            {folderCollections.map((folder) => (
                                <button
                                    key={folder.key}
                                    type="button"
                                    onClick={() => handleSelectFolder(folder.key)}
                                    className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                                        activeFolderKey === folder.key
                                            ? 'border-[rgba(255,177,20,0.22)] bg-[rgba(255,177,20,0.08)] text-[var(--ff-accent)]'
                                            : 'border-white/10 bg-white/6 text-[#cfc7bc] hover:border-[rgba(255,177,20,0.18)] hover:text-[#f6f2eb]'
                                    }`}
                                >
                                    {folder.name} • {folder.count}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 rounded-[1.2rem] border border-white/8 bg-white/5 px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8f8a82]">Current folder</p>
                        <p className="mt-1 text-sm font-bold text-[#f6f2eb]">{activeFolderLabel}</p>
                    </div>

                    <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                        {isLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 3 }).map((_, index) => (
                                    <div key={index} className="animate-pulse rounded-[1.15rem] border border-white/8 bg-white/5 p-3.5">
                                        <div className="h-4 w-28 rounded bg-white/10"></div>
                                        <div className="mt-3 h-3 w-40 rounded bg-white/6"></div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredMaterials.length > 0 ? (
                            <div className="space-y-2">
                                {filteredMaterials.map((material) => {
                                    const isActive = material.id === selectedMaterialId;

                                    return (
                                        <button
                                            key={material.id}
                                            type="button"
                                            onClick={() => onSelectMaterial?.(material.id)}
                                            className={`w-full rounded-[1.15rem] border p-3.5 text-left transition-all ${
                                                isActive
                                                    ? 'border-[rgba(255,177,20,0.22)] bg-[linear-gradient(180deg,rgba(255,177,20,0.1),rgba(255,177,20,0.04))] shadow-[0_12px_30px_rgba(255,177,20,0.08)]'
                                                    : 'border-white/8 bg-white/5 hover:border-[rgba(255,177,20,0.16)] hover:bg-white/7'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.85rem] border border-white/8 bg-white/6 text-[var(--ff-accent)]">
                                                    <FileText size={15} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-[#f6f2eb]" title={material.name}>
                                                        {material.name}
                                                    </p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d7d0c5]">
                                                            {formatMaterialSize(material.size)}
                                                        </span>
                                                        <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d7d0c5]">
                                                            {folderNameByKey[getStudyMaterialFolderKey(material)] || NO_FOLDER_LABEL}
                                                        </span>
                                                    </div>
                                                    <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#8f8a82]">
                                                        {formatMaterialTimestamp(material.uploadedAt)}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/4 px-5 py-8 text-center">
                                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-[rgba(255,177,20,0.18)] bg-[rgba(255,177,20,0.08)] text-[var(--ff-accent)]">
                                    <BookOpen size={18} />
                                </div>
                                <p className="mt-4 text-sm font-semibold text-[#f6f2eb]">
                                    {activeFolderKey === ALL_FOLDER_KEY
                                        ? 'No materials available yet.'
                                        : `No files inside ${activeFolderLabel}.`}
                                </p>
                                <p className="mt-1 text-xs text-[#8f8a82]">
                                    Open Resource Center on the home page to upload files or organize folders.
                                </p>
                            </div>
                        )}
                    </div>

                </aside>

                <section className="flex min-h-0 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-5 sm:p-6">
                    <div className="mb-4 flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f8a82]">Reader</p>
                            <h3 className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#f6f2eb] sm:text-[1.7rem]">
                                {selectedMaterial ? selectedMaterial.name : 'Select a file to read'}
                            </h3>
                            <p className="mt-2 text-[13px] leading-6 text-[#b8b1a6]">
                                {selectedMaterial
                                    ? 'Read-only view while your focus session continues uninterrupted.'
                                    : 'Choose one file from the left library to open it here.'}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close study reader"
                            className="rounded-full border border-white/10 bg-white/6 p-2 text-[#f6f2eb] transition-colors hover:bg-white/10"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {selectedMaterial ? (
                        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[1.2rem] border border-white/8 bg-white/4 px-3.5 py-3">
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d7d0c5]">
                                {getMaterialIcon(viewerMode)}
                                {selectedTypeLabel}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d7d0c5]">
                                {formatMaterialSize(selectedMaterial.size)}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d7d0c5]">
                                {selectedFolderLabel}
                            </span>
                            <span className="rounded-full border border-[rgba(255,177,20,0.18)] bg-[rgba(255,177,20,0.08)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ff-accent)]">
                                Read only
                            </span>
                            {viewerMode === 'pdf' && viewerSrc ? (
                                <a
                                    href={viewerSrc}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={() => onOpenFullScreen?.()}
                                    className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ece5da] transition-colors hover:border-[rgba(255,177,20,0.22)] hover:text-[var(--ff-accent)]"
                                >
                                    Full screen
                                </a>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="min-h-0 flex-1 overflow-hidden rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        {viewerStatus ? (
                            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-[1rem] border border-[rgba(255,177,20,0.18)] bg-[rgba(255,177,20,0.08)] text-[var(--ff-accent)]">
                                    {getMaterialIcon(viewerMode)}
                                </div>
                                <p className="mt-4 text-sm font-semibold text-[#f6f2eb]">{viewerStatus}</p>
                                <p className="mt-2 max-w-md text-xs leading-6 text-[#8f8a82]">
                                    PDFs, images, videos, and text files can be read here directly. Document and slide files such as DOCX or PPTX are stored in the library but open here as download-only items.
                                </p>
                                {viewerMode === 'download' && viewerSrc && selectedMaterial ? (
                                    <a
                                        href={viewerSrc}
                                        download={selectedMaterial.name}
                                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-[rgba(255,177,20,0.22)] bg-[rgba(255,177,20,0.08)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ff-accent)] transition-colors hover:bg-[rgba(255,177,20,0.14)] hover:text-[#f7f3ea]"
                                    >
                                        Download file
                                    </a>
                                ) : null}
                            </div>
                        ) : viewerMode === 'pdf' && viewerSrc ? (
                            <iframe
                                title={selectedMaterial ? `Read ${selectedMaterial.name}` : 'Study material reader'}
                                src={viewerSrc}
                                allowFullScreen
                                className="h-full w-full bg-white"
                            />
                        ) : viewerMode === 'image' && viewerSrc ? (
                            <div className="flex h-full items-center justify-center bg-[#141414] p-6">
                                <img
                                    src={viewerSrc}
                                    alt={selectedMaterial?.name || 'Study material'}
                                    className="max-h-full max-w-full rounded-[1.2rem] border border-white/10 object-contain shadow-[0_18px_36px_rgba(0,0,0,0.24)]"
                                />
                            </div>
                        ) : viewerMode === 'video' && viewerSrc ? (
                            <div className="flex h-full items-center justify-center bg-[#141414] p-4">
                                <video
                                    src={viewerSrc}
                                    className="max-h-full w-full rounded-[1.2rem] border border-white/10 shadow-[0_18px_36px_rgba(0,0,0,0.24)]"
                                    controls
                                />
                            </div>
                        ) : viewerMode === 'text' ? (
                            <div className="h-full overflow-y-auto p-6 custom-scrollbar">
                                <div className="mx-auto max-w-3xl rounded-[1.35rem] border border-white/8 bg-[rgba(14,14,14,0.35)] px-6 py-5 shadow-[0_20px_46px_rgba(0,0,0,0.16)]">
                                    <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-[#ece5da]">
                                        {viewerText}
                                    </pre>
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-[1rem] border border-white/10 bg-white/6 text-[#ece5da]">
                                    <FileText size={20} />
                                </div>
                                <p className="mt-4 text-sm font-semibold text-[#f6f2eb]">Pick a file from the library to start reading.</p>
                                <p className="mt-2 max-w-md text-xs leading-6 text-[#8f8a82]">
                                    Your timer keeps running while the selected material stays open here.
                                </p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}

function ReaderStatCard({ label, value }) {
    return (
        <div className="rounded-[1.05rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8f8a82]">{label}</p>
            <p className="mt-2 text-[1.05rem] font-bold text-[#f6f2eb]">{value}</p>
        </div>
    );
}
