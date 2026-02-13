import { useState, useCallback } from 'react';

/**
 * useHistory — undo/redo state manager
 * Stores up to MAX_HISTORY snapshots.
 */
const MAX_HISTORY = 50;

export function useHistory(initialState) {
    const [past, setPast] = useState([]);
    const [present, setPresent] = useState(initialState);
    const [future, setFuture] = useState([]);

    const setState = useCallback((newState) => {
        const value = typeof newState === 'function' ? newState(present) : newState;
        setPast(prev => [...prev.slice(-MAX_HISTORY + 1), present]);
        setPresent(value);
        setFuture([]);
    }, [present]);

    const undo = useCallback(() => {
        if (past.length === 0) return;
        const prev = past[past.length - 1];
        setPast(p => p.slice(0, -1));
        setFuture(f => [present, ...f]);
        setPresent(prev);
    }, [past, present]);

    const redo = useCallback(() => {
        if (future.length === 0) return;
        const next = future[0];
        setFuture(f => f.slice(1));
        setPast(p => [...p, present]);
        setPresent(next);
    }, [future, present]);

    return {
        state: present,
        setState,
        undo,
        redo,
        canUndo: past.length > 0,
        canRedo: future.length > 0,
    };
}
