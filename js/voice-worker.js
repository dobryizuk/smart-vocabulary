// ============================================================================
// NATURAL VOICE WORKER - loads the Kokoro model and turns texts into samples off the
// main thread (one clip takes seconds on a phone). Served as is, outside the bundle;
// js/natural-voice.js sends the library, model and voice to use.
// ============================================================================

// The phonemizer inside kokoro-js reads a ReadableStream with for await, which WebKit
// (Safari 26.0) cannot do yet; this adds the standard async iterator where it is missing
function addStreamIteration(StreamClass) {
    const proto = StreamClass?.prototype;
    if (!proto || proto[Symbol.asyncIterator]) return;
    proto[Symbol.asyncIterator] = async function* readChunks() {
        const reader = this.getReader();
        try {
            let chunk = await reader.read();
            while (!chunk.done) {
                yield chunk.value;
                chunk = await reader.read();
            }
        } finally {
            reader.releaseLock();
        }
    };
}

async function loadModel({ library, model, dtype, device }) {
    addStreamIteration(self.ReadableStream);
    const { KokoroTTS } = await import(library);
    return KokoroTTS.from_pretrained(model, { dtype, device });
}

let tts = null;
let voice = null;

async function speak(text) {
    try {
        const { audio, sampling_rate: sampleRate } = await (await tts).generate(text, { voice });
        self.postMessage({ type: 'clip', text, samples: audio, sampleRate }, [audio.buffer]);
    } catch (error) {
        self.postMessage({ type: 'error', text, message: String(error) });
    }
}

self.addEventListener('message', ({ data }) => {
    if (data.type === 'load') {
        voice = data.voice;
        tts = loadModel(data);
        tts.then(
            () => self.postMessage({ type: 'ready' }),
            error => self.postMessage({ type: 'failed', message: String(error) })
        );
    } else if (data.type === 'speak') {
        speak(data.text);
    }
});
