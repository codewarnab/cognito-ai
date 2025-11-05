/**
 * AudioOrb3D Usage Example
 * 
 * This file demonstrates how to use the AudioOrb3D component with audio nodes
 */

import React, { useRef, useState, useEffect } from 'react';
import { AudioOrb3D } from './AudioOrb3D';

export const AudioOrbExample: React.FC = () => {
    const [inputNode, setInputNode] = useState<GainNode | undefined>();
    const [outputNode, setOutputNode] = useState<GainNode | undefined>();
    const [color, setColor] = useState('#000010');

    useEffect(() => {
        // Example: Create audio contexts and nodes
        // In real usage, these would come from your audio capture/playback manager

        const inputContext = new AudioContext({ sampleRate: 16000 });
        const outputContext = new AudioContext({ sampleRate: 24000 });

        const inputGain = inputContext.createGain();
        const outputGain = outputContext.createGain();

        setInputNode(inputGain);
        setOutputNode(outputGain);

        // Cleanup
        return () => {
            inputContext.close();
            outputContext.close();
        };
    }, []);

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <AudioOrb3D
                inputNode={inputNode}
                outputNode={outputNode}
                color={color}
            />

            {/* Example color controls */}
            <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 10 }}>
                <button onClick={() => setColor('#FF0000')}>Red</button>
                <button onClick={() => setColor('#00FF00')}>Green</button>
                <button onClick={() => setColor('#0000FF')}>Blue</button>
                <button onClick={() => setColor('#000010')}>Default</button>
            </div>
        </div>
    );
};

export default AudioOrbExample;
