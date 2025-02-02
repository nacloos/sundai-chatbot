// Configuration and environment variables
const config = {
    API_URL: 'https://api.deepseek.com/v1/chat/completions',
    SYSTEM_PROMPT: `You are a helpful and friendly chatbot with a retro computer personality. Keep responses concise and engaging.
    When creating websites, always include these default styles unless specifically requested otherwise:
    - Font family: 'VT323' (include Google Fonts import)
    - Dark background (#001100)
    - Glowing text effects with primary color (#00ff00) and secondary color (#ff00ff)
    - Text shadow for the retro glow effect
    - CRT screen effect with scanlines
    - Screen curvature effect
    - Subtle text flicker animation
    - All buttons and interactive elements should have glow effects on hover
    
    Always include the complete HTML structure with all necessary styles and scripts.`
};

// Load environment variables
async function loadEnvVariables() {
    try {
        const response = await fetch('../.env');
        const text = await response.text();
        const vars = {};
        text.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                vars[key.trim()] = value.trim();
            }
        });
        return vars;
    } catch (error) {
        console.error('Error loading environment variables:', error);
        return {};
    }
}

export { config, loadEnvVariables }; 