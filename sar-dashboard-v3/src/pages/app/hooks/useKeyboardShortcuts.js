import { useEffect } from 'react';
import { useJobStore } from '../stores/useJobStore';
import { useMapStore } from '../stores/useMapStore';

export function useKeyboardShortcuts(profile, setActiveView, setReportModalOpen) {
    const setTerminalOpen = useJobStore(state => state.setTerminalOpen);
    const setViewingResult = useMapStore(state => state.setViewingResult);

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Crucial: Ignore key presses if typing inside any form control or editable area
            const target = e.target;
            const tag = target?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
                return;
            }

            // Do not override system/browser combinations like Ctrl+R, Ctrl+T, etc.
            if (e.ctrlKey || e.altKey || e.metaKey) {
                return;
            }

            const key = e.key;

            // 't' or 'T': Toggle terminal
            if (key === 't' || key === 'T') {
                e.preventDefault();
                const currentTerminalOpen = useJobStore.getState().terminalOpen;
                setTerminalOpen(!currentTerminalOpen);
                return;
            }

            // 'Escape': Close terminal and report modal
            if (key === 'Escape') {
                setTerminalOpen(false);
                if (typeof setReportModalOpen === 'function') {
                    setReportModalOpen(false);
                }
                return;
            }

            // Flood Profile Shortcuts
            if (profile === 'flood') {
                // 'n' or 'N': New run (switch to map view and clear viewing result)
                if (key === 'n' || key === 'N') {
                    e.preventDefault();
                    if (typeof setActiveView === 'function') {
                        setActiveView('map');
                    }
                    setViewingResult(null);
                    return;
                }

                // 'r' or 'R': View report if viewingResult with floodReport exists
                if (key === 'r' || key === 'R') {
                    const currentResult = useMapStore.getState().viewingResult;
                    if (currentResult?.floodReport && typeof setReportModalOpen === 'function') {
                        e.preventDefault();
                        setReportModalOpen(true);
                    }
                    return;
                }

                // '1' through '5': Switch sidebar views
                const viewMap = {
                    '1': 'map',
                    '2': 'timeseries',
                    '3': 'regions',
                    '4': 'processing',
                    '5': 'data',
                };
                if (viewMap[key] && typeof setActiveView === 'function') {
                    e.preventDefault();
                    setActiveView(viewMap[key]);
                    return;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [profile, setActiveView, setReportModalOpen, setTerminalOpen, setViewingResult]);
}

export default useKeyboardShortcuts;
