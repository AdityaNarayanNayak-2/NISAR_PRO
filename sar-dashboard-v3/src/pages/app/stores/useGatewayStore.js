import { create } from 'zustand';
import { api } from '../../../config/api';

export const useGatewayStore = create((set) => ({
    gatewayOnline: true,
    setGatewayOnline: (status) => set({ gatewayOnline: status }),

    checkGatewayHealth: async () => {
        try {
            await fetch(api('/jobs/health-ping'), { signal: AbortSignal.timeout(2000) });
            set({ gatewayOnline: true });
        } catch {
            try {
                await fetch(api('/'), { signal: AbortSignal.timeout(2000) });
                set({ gatewayOnline: true });
            } catch {
                set({ gatewayOnline: false });
            }
        }
    },
}));
