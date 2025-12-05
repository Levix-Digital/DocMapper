/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    purple: '#9333ea',
                    green: '#10b981',
                }
            },
            animation: {
                'led-border': 'led-border 3s linear infinite',
            },
            keyframes: {
                'led-border': {
                    '0%, 100%': { borderColor: '#9333ea', boxShadow: '0 0 5px #9333ea' },
                    '50%': { borderColor: '#10b981', boxShadow: '0 0 5px #10b981' },
                }
            }
        },
    },
    plugins: [],
}
