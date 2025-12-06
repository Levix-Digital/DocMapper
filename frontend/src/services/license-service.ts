export class LicenseService {
    private static instance: LicenseService;
    private isValid: boolean = false;
    private licenseServerUrl: string;
    private licenseKey: string;

    private constructor() {
        this.licenseServerUrl = import.meta.env.VITE_LICENSE_SERVER || '';
        this.licenseKey = import.meta.env.VITE_LICENSE_KEY || '';
    }

    public static getInstance(): LicenseService {
        if (!LicenseService.instance) {
            LicenseService.instance = new LicenseService();
        }
        return LicenseService.instance;
    }

    public async verify(): Promise<boolean> {
        if (this.isValid) return true;

        const maxRetries = 3;
        const retryDelay = 1000; // 1 second

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(`${this.licenseServerUrl}/api/verify`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        key: this.licenseKey,
                        domain: window.location.hostname,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.valid) {
                        this.isValid = true;
                        return true;
                    }
                    return false;
                }

                // If 400 or 403 (or other client errors), do not retry network errors only
                if (response.status >= 400 && response.status < 500) {
                    console.error('License validation failed:', response.statusText);
                    return false;
                }

            } catch (error) {
                console.warn(`License verification attempt ${attempt} failed:`, error);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }

        return false;
    }

    public isLicenseValid(): boolean {
        return this.isValid;
    }
}

export default LicenseService.getInstance();
