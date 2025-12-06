import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import LicenseService from './services/license-service'

(async () => {
    const isValid = await LicenseService.verify();

    if (isValid) {
        createApp(App).mount('#app')
    } else {
        const appElement = document.getElementById('app');
        if (appElement) {
            appElement.innerHTML = `
                <div style="font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; background-color: #242424; color: #ff5555;">
                    <h1 style="font-size: 2em; margin-bottom: 0.5em;">License Error</h1>
                    <p style="font-size: 1.2em;">Authorization failed. Please contact support.</p>
                </div>
            `;
        }
    }
})();
