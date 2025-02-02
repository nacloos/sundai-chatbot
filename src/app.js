import { config, loadEnvVariables } from './config.js';

// Deepseek API configuration
let DEEPSEEK_API_KEY = '';

// Initialize environment variables
(async () => {
    const env = await loadEnvVariables();
    DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY;
    if (DEEPSEEK_API_KEY) {
        console.log('API key loaded successfully');
    } else {
        console.error('Failed to load API key');
    }
})();

// Add marked.js configuration
marked.setOptions({
    breaks: true,
    gfm: true
});

// Function to show/hide preview button
function showPreviewButton() {
    document.getElementById('preview-button').style.display = 'inline-block';
}

function hidePreviewButton() {
    document.getElementById('preview-button').style.display = 'none';
}

// Preview website function
function previewWebsite() {
    const modal = document.getElementById('preview-modal');
    const iframe = document.getElementById('preview-iframe');
    
    // Get all hidden spans and take the last one
    const allHiddenSpans = document.querySelectorAll('span[style="display: none;"]');
    const fullTextSpan = allHiddenSpans[allHiddenSpans.length - 1];
    
    if (!fullTextSpan) {
        console.error('No hidden span found');
        alert('Could not find message content');
        return;
    }
    
    // Extract HTML code from the last message
    const messageText = fullTextSpan.textContent;
    console.log('Full message text:', messageText); // Debug log
    
    // Try different markdown code block patterns
    const patterns = [
        /```html\n([\s\S]*?)```/i,    // Case insensitive HTML
        /```(\s*html)?\n([\s\S]*?)```/i,  // Optional html tag
        /`{3}([\s\S]*?)`{3}/         // Any triple backticks
    ];

    let htmlCode = null;
    for (const pattern of patterns) {
        const match = messageText.match(pattern);
        if (match) {
            // If the pattern includes a capture group for 'html', use the last group
            htmlCode = match[match.length - 1];
            console.log('Found HTML with pattern:', pattern);
            break;
        }
    }

    if (htmlCode) {
        console.log('Found HTML code:', htmlCode);
        iframe.srcdoc = htmlCode;
        modal.style.display = 'block';
    } else {
        console.log('Message content:', messageText);
        alert('No HTML code found in the last message');
    }
}

// Close preview function
function closePreview() {
    document.getElementById('preview-modal').style.display = 'none';
}

// Send message function
async function sendMessage() {
    if (!DEEPSEEK_API_KEY) {
        console.error('API key not loaded');
        let chatContainer = document.getElementById("chat-container");
        chatContainer.innerHTML += `<p><strong>Bot:</strong> Error: API key not loaded. Please check the console for details.</p>`;
        return;
    }
    let inputBox = document.getElementById("user-input");
    let message = inputBox.value.trim();
    if (message === "") return;
    
    let chatContainer = document.getElementById("chat-container");
    chatContainer.innerHTML += `<p class="complete-message"><strong>You:</strong> ${message}</p>`;
    inputBox.value = "";
    
    // Create response element without animation
    const responseElement = document.createElement('p');
    responseElement.className = 'streaming-message';
    responseElement.innerHTML = '<strong>Bot:</strong> ';
    const textSpan = document.createElement('span');
    responseElement.appendChild(textSpan);
    chatContainer.appendChild(responseElement);
    
    // Create hidden span
    const fullTextSpan = document.createElement('span');
    fullTextSpan.style.display = 'none';
    responseElement.appendChild(fullTextSpan);
    
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        await streamResponse(message, textSpan, fullTextSpan);
        responseElement.className = 'complete-message';
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (error) {
        textSpan.textContent = 'Sorry, I encountered an error. Please try again.';
        console.error('Error:', error);
    }
}

// Stream response function
async function streamResponse(message, textSpan, fullTextSpan) {
    hidePreviewButton();
    
    let currentMarkdown = '';
    let codeBlock = false;
    let codeLanguage = '';

    try {
        console.log('Attempting API call with key:', DEEPSEEK_API_KEY.substring(0, 5) + '...');
        const response = await fetch(config.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: config.SYSTEM_PROMPT
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                model: 'deepseek-chat',
                max_tokens: 2000,
                temperature: 0.7,
                stream: true
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('API Response:', errorData);
            throw new Error(`API call failed: ${response.status} - ${errorData}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let isComplete = false;

        while (!isComplete) {
            const {value, done} = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, {stream: true});
            
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim() === '') continue;
                if (line === 'data: [DONE]') {
                    isComplete = true;
                    continue;
                }
                if (line.startsWith('data: ')) {
                    try {
                        const jsonData = line.slice(6);
                        const data = JSON.parse(jsonData);
                        
                        if (data.choices?.[0]?.delta?.content) {
                            const newContent = data.choices[0].delta.content;
                            fullTextSpan.textContent += newContent;
                            currentMarkdown += newContent;

                            // Handle code blocks
                            if (newContent.includes('```')) {
                                codeBlock = !codeBlock;
                                if (codeBlock) {
                                    const langMatch = newContent.match(/```(\w+)/);
                                    codeLanguage = langMatch ? langMatch[1] : '';
                                }
                            }

                            // Sanitize and render the content
                            const sanitized = DOMPurify.sanitize(marked.parse(currentMarkdown));
                            textSpan.innerHTML = sanitized;
                        }
                        
                        if (data.choices?.[0]?.finish_reason === 'stop') {
                            isComplete = true;
                        }
                    } catch (parseError) {
                        console.error('JSON parse error:', parseError);
                        console.error('Problem line:', line);
                    }
                }
            }
        }

        // Show preview button if message contains code blocks
        if (fullTextSpan.textContent.includes('```')) {
            showPreviewButton();
        }
    } catch (error) {
        console.error('Detailed error:', error);
        throw error;
    }
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('user-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});

// Export functions that need to be accessed from HTML
window.sendMessage = sendMessage;
window.previewWebsite = previewWebsite;
window.closePreview = closePreview; 