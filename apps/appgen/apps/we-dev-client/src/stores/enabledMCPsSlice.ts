import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { MCPServer } from '@/types/mcp'

interface EnabledMCPsState {
    enabledMCPs: MCPServer[]
    setEnabledMCPs: (mcps: MCPServer[]) => void
    toggleMCP: (server: MCPServer) => void
    enableAllMCPs: (servers: MCPServer[]) => void
    disableAllMCPs: () => void
}

const useEnabledMCPsStore = create<EnabledMCPsState>()(
    persist(
        (set, get) => ({
            enabledMCPs: [],
            
            setEnabledMCPs: (mcps: MCPServer[]) => {
                set({ enabledMCPs: mcps })
            },
            
            toggleMCP: (server: MCPServer) => {
                set((state) => {
                    const isCurrentlyEnabled = state.enabledMCPs.some(s => s.name === server.name)
                    
                    if (isCurrentlyEnabled) {
                        // If already enabled, remove from list
                        return { enabledMCPs: state.enabledMCPs.filter(s => s.name !== server.name) }
                    } else {
                        // If not enabled, add to list
                        return { enabledMCPs: [...state.enabledMCPs, server] }
                    }
                })
            },
            
            enableAllMCPs: (servers: MCPServer[]) => {
                set({ enabledMCPs: [...servers] })
            },
            
            disableAllMCPs: () => {
                set({ enabledMCPs: [] })
            }
        }),
        {
            name: 'enabled-mcps-storage',
            version: 1,
        }
    )
)

export default useEnabledMCPsStore 