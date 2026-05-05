/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                // Brand palette — deep navy + electric teal
                brand: {
                    50: '#eefffd',
                    100: '#c5fff8',
                    200: '#8bfff2',
                    300: '#4dfce8',
                    400: '#1de8d3',
                    500: '#05ccba',
                    600: '#00a398',
                    700: '#05827a',
                    800: '#0a6762',
                    900: '#0d5551',
                },
                surface: {
                    DEFAULT: '#0f1117',
                    secondary: '#161b27',
                    tertiary: '#1e2535',
                    border: '#2a3347',
                    hover: '#242c3f',
                },
                severity: {
                    critical: '#ef4444',
                    high: '#f97316',
                    medium: '#eab308',
                    low: '#22c55e',
                    info: '#3b82f6',
                }
            },
            backgroundImage: {
                'gradient-brand': 'linear-gradient(135deg, #05ccba 0%, #3b82f6 100%)',
                'gradient-dark': 'linear-gradient(135deg, #0f1117 0%, #161b27 100%)',
                'gradient-card': 'linear-gradient(135deg, #1e2535 0%, #161b27 100%)',
            },
            boxShadow: {
                'glow-brand': '0 0 20px rgba(5, 204, 186, 0.15)',
                'glow-red': '0 0 20px rgba(239, 68, 68, 0.15)',
                'card': '0 4px 24px rgba(0,0,0,0.4)',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(16px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
}
