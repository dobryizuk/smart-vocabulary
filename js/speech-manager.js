// ============================================================================
// SPEECH SYNTHESIS MANAGEMENT
// ============================================================================

// Speech synthesis configuration
let speechSettings = {
    enabled: true,
    rate: 0.8,
    pitch: 1.0,
    volume: 0.9,
    voice: null,
    autoPlay: true
};

function initializeSpeech() {
    if ('speechSynthesis' in window) {
        // Wait for voices to load with timeout
        const waitForVoices = (timeout = 2000) => {
            return new Promise((resolve) => {
                const voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) {
                    resolve(voices);
                    return;
                }
                
                const timer = setTimeout(() => {
                    window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
                    resolve(window.speechSynthesis.getVoices());
                }, timeout);
                
                const onVoicesChanged = () => {
                    clearTimeout(timer);
                    window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
                    resolve(window.speechSynthesis.getVoices());
                };
                
                window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
            });
        };

        // Load available voices
        const loadVoices = async () => {
            const voices = await waitForVoices();
            
            // Prefer English voices, especially macOS/iOS native ones
            const preferredVoices = [
                'Alex', 'Samantha', 'Victoria', // macOS voices
                'Karen', 'Daniel (Enhanced)', 'Moira', // macOS enhanced
                'Google US English', 'Microsoft English', // Cross-platform
            ];
            
            // Find best available English voice
            let bestVoice = voices.find(voice => 
                voice.lang.startsWith('en') && 
                preferredVoices.some(pv => voice.name.includes(pv))
            );
            
            // Fallback to any English voice
            if (!bestVoice) {
                bestVoice = voices.find(voice => voice.lang.startsWith('en'));
            }
            
            speechSettings.voice = bestVoice;
            
            // Update UI if voice is unavailable
            if (!bestVoice && voices.length === 0) {
                console.warn('⚠️ No speech voices available');
                speechSettings.enabled = false;
            }
        };

        // Load voices
        loadVoices();
        
        return true;
    } else {
        console.warn('⚠️ Speech synthesis not supported');
        speechSettings.enabled = false;
        return false;
    }
}

function speakWord(text, options = {}) {
    if (!speechSettings.enabled || !text) return;
    
    // Check if speechSynthesis is available
    if (!window.speechSynthesis) {
        console.warn('⚠️ Speech synthesis not available');
        return;
    }

    // Stop any ongoing speech
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
    }

    // Add slight delay for Chrome compatibility
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Apply settings
        utterance.rate = options.rate || speechSettings.rate;
        utterance.pitch = options.pitch || speechSettings.pitch;
        utterance.volume = options.volume || speechSettings.volume;
        
        if (speechSettings.voice) {
            utterance.voice = speechSettings.voice;
        }

        utterance.onerror = (event) => {
            console.error('❌ Speech error:', event.error, 'for text:', text);
            
            // Try to recover from common errors
            if (event.error === 'network') {
                setTimeout(() => speakWord(text, options), 1000);
            }
        };

        try {
            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('❌ Failed to speak:', error);
        }
    }, 100);
}

function toggleSpeech() {
    speechSettings.enabled = !speechSettings.enabled;
    const speechBtn = document.getElementById('speechToggle');
    if (speechBtn) {
        speechBtn.textContent = speechSettings.enabled ? '🔊 Sound On' : '🔇 Sound Off';
        speechBtn.className = speechSettings.enabled ? 'btn btn-success' : 'btn btn-secondary';
    }
    
    // Save preference
    localStorage.setItem('speechSettings', JSON.stringify(speechSettings));
    
    return speechSettings.enabled;
}

function toggleAutoPlay() {
    speechSettings.autoPlay = !speechSettings.autoPlay;
    const autoPlayBtn = document.getElementById('autoPlayToggle');
    if (autoPlayBtn) {
        autoPlayBtn.textContent = speechSettings.autoPlay ? '🎵 Auto Play On' : '🔇 Auto Play Off';
        autoPlayBtn.className = speechSettings.autoPlay ? 'btn btn-success' : 'btn btn-secondary';
    }
    
    // Save preference
    localStorage.setItem('speechSettings', JSON.stringify(speechSettings));
    
    return speechSettings.autoPlay;
}

// Export functions and make globally available
window.SpeechManager = {
    initializeSpeech,
    speakWord,
    toggleSpeech,
    toggleAutoPlay,
    get speechSettings() { return speechSettings; },
    set speechSettings(value) { speechSettings = value; }
};

// Make speakWord globally accessible for compatibility  
window.speakWord = speakWord;