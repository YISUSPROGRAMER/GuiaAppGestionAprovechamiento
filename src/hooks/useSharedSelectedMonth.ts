import { useEffect, useState } from 'react';

export const ALL_PERIODS_VALUE = 'all';

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

let sharedSelectedMonth = getCurrentMonth();
const listeners = new Set<(month: string) => void>();

const emitSelectedMonth = (month: string) => {
    sharedSelectedMonth = month;
    listeners.forEach(listener => listener(month));
};

export const useSharedSelectedMonth = () => {
    const [selectedMonth, setSelectedMonthState] = useState(sharedSelectedMonth);

    useEffect(() => {
        const listener = (month: string) => setSelectedMonthState(month);
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    const setSelectedMonth = (month: string) => {
        emitSelectedMonth(month);
    };

    return {
        selectedMonth,
        setSelectedMonth,
        currentMonth: getCurrentMonth()
    };
};
