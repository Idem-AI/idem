// Version simplifiée du gestionnaire de proxy pour l'application web

export type ProxyMode = 'custom' | 'none'

export interface ProxyConfig {
    mode: ProxyMode
    url?: string
}

export class ProxyManager {
    private config: ProxyConfig

    constructor() {
        this.config = {
            mode: 'none'
        }
    }

    async configureProxy(config: ProxyConfig): Promise<void> {
        try {
            this.config = config
            console.log('Proxy configuration en mode web:', config)
            
            // En mode web, nous ne pouvons pas configurer globalement un proxy comme dans Electron
            // Mais nous pouvons stocker la configuration pour l'utiliser dans les requêtes fetch
            if (config.mode === 'custom' && config.url) {
                console.log(`Proxy configuré avec l'URL: ${config.url}`)
                // En environnement web, les proxys doivent généralement être configurés
                // côté serveur ou via un service worker
            } else {
                console.log('Proxy désactivé')
            }
        } catch (error) {
            console.error('Échec de la configuration du proxy:', error)
        }
    }

    getProxyUrl(): string | null {
        if (this.config.mode === 'custom' && this.config.url) {
            return this.config.url
        }
        return null
    }

    getProxyConfig(): ProxyConfig {
        return {...this.config}
    }
}

export const proxyManager = new ProxyManager()