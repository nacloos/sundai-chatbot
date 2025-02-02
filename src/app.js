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
    const fullTextSpan = document.querySelector('span[style="display: none;"]');
    
    // Extract HTML code from the last message
    const messageText = fullTextSpan.textContent;
    
    // Try different markdown code block patterns
    const patterns = [
        /```html\n([\s\S]*?)```/,    // Standard markdown
        /```html\r\n([\s\S]*?)```/,  // Windows line endings
        /```HTML\n([\s\S]*?)```/,    // Uppercase HTML
        /```\n([\s\S]*?)```/,        // No language specified
        /`{3}([\s\S]*?)`{3}/         // Any triple backticks
    ];

    let htmlCode = null;
    for (const pattern of patterns) {
        const match = messageText.match(pattern);
        if (match) {
            htmlCode = match[1];
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

// Add this helper function for smooth scrolling
function smoothScrollToBottom(element) {
    const scrollHeight = element.scrollHeight;
    const currentScroll = element.scrollTop + element.clientHeight;
    
    // Only scroll if we're close to the bottom
    if (scrollHeight - currentScroll < 100) {
        element.scrollTo({
            top: scrollHeight,
            behavior: 'smooth'
        });
    }
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
    
    // Disable input and show loading state
    inputBox.disabled = true;
    const sendButton = document.querySelector('.send-button');
    sendButton.disabled = true;
    
    let chatContainer = document.getElementById("chat-container");
    chatContainer.innerHTML += `<p class="complete-message"><strong>You:</strong> ${message}</p>`;
    inputBox.value = "";
    
    // Create response element with loading spinner
    const responseElement = document.createElement('p');
    responseElement.className = 'streaming-message';
    responseElement.innerHTML = '<strong>Bot:</strong> <div class="loading-spinner"></div>';
    chatContainer.appendChild(responseElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        // Create text span for the response
        const textSpan = document.createElement('span');
        const fullTextSpan = document.createElement('span');
        fullTextSpan.style.display = 'none';
        
        // Start the streaming process
        const streamPromise = streamResponse(message, textSpan, fullTextSpan);
        
        // Create a promise that resolves when we get the first token
        const firstTokenPromise = new Promise((resolve) => {
            const observer = new MutationObserver((mutations) => {
                if (textSpan.textContent.length > 0) {
                    observer.disconnect();
                    resolve();
                }
            });
            observer.observe(textSpan, { childList: true, subtree: true, characterData: true });
        });

        // Wait for the first actual token
        await firstTokenPromise;
        
        // Replace loading spinner with text span
        responseElement.innerHTML = '<strong>Bot:</strong> ';
        responseElement.appendChild(textSpan);
        responseElement.appendChild(fullTextSpan);
        
        // Complete the streaming
        await streamPromise;
        responseElement.className = 'complete-message';
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (error) {
        responseElement.innerHTML = '<strong>Bot:</strong> Sorry, I encountered an error. Please try again.';
        console.error('Error:', error);
    } finally {
        // Re-enable input
        inputBox.disabled = false;
        sendButton.disabled = false;
        inputBox.focus();
    }
}

// Stream response function
async function streamResponse(message, textSpan, fullTextSpan) {
    hidePreviewButton();
    
    let currentMarkdown = '';
    let codeBlock = false;
    let codeLanguage = '';
    const chatContainer = document.getElementById('chat-container');

    try {
        console.log('Attempting API call with key:', DEEPSEEK_API_KEY.substring(0, 5) + '...');
        const response = await fetch('https://wxofjhjv5vx9mj-8000.proxy.runpod.net/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-ai/DeepSeek-R1',
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
                temperature: 0.7,
                top_p: 0.95,
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
                            
                            // Scroll to bottom smoothly
                            smoothScrollToBottom(chatContainer);
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
    
    // Remove startup overlay after animation
    setTimeout(() => {
        const overlay = document.querySelector('.startup-overlay');
        overlay.style.transition = 'opacity 0.5s ease-out';
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.remove();
        }, 500);
    }, 2300); // Wait for animations to complete
});

// Export functions that need to be accessed from HTML
window.sendMessage = sendMessage;
window.previewWebsite = previewWebsite;
window.closePreview = closePreview; 