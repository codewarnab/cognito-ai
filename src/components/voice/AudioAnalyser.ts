/**
 * AudioAnalyser - Wrapper for Web Audio API AnalyserNode
 * Extracts frequency data from audio streams for visualization
 */

export class AudioAnalyser {
    private analyser: AnalyserNode;
    private dataArray: Uint8Array<ArrayBuffer>;
    public data: Float32Array;

    constructor(audioNode: AudioNode, fftSize: number = 32) {
        // Create analyser node
        this.analyser = audioNode.context.createAnalyser();
        this.analyser.fftSize = fftSize;
        this.analyser.smoothingTimeConstant = 0.8;

        // Connect audio node to analyser
        audioNode.connect(this.analyser);

        // Create data arrays
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength) as Uint8Array<ArrayBuffer>;
        this.data = new Float32Array(4); // We'll use first 4 frequency bins
    }

    /**
     * Update frequency data
     * Call this in animation loop
     */
    update(): void {
        this.analyser.getByteFrequencyData(this.dataArray);

        // Extract first 4 frequency bins for shader uniforms
        for (let i = 0; i < 4; i++) {
            this.data[i] = this.dataArray[i];
        }
    }

    /**
     * Get average frequency across all bins
     */
    getAverage(): number {
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        return sum / this.dataArray.length;
    }

    /**
     * Get peak frequency value
     */
    getPeak(): number {
        let peak = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            if (this.dataArray[i] > peak) {
                peak = this.dataArray[i];
            }
        }
        return peak;
    }

    /**
     * Disconnect and cleanup
     */
    dispose(): void {
        this.analyser.disconnect();
    }
}
