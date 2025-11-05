/**
 * AudioOrb3D - Three.js visualization component
 * Audio-reactive 3D orb with shaders and post-processing
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { AudioAnalyser } from '../utils/AudioAnalyser';
import { sphereVertexShader, sphereFragmentShader } from '../shaders/sphereShader';
import { backdropVertexShader, backdropFragmentShader } from '../shaders/backdropShader';
import '../styles/AudioOrb3D.css';

export interface AudioOrb3DProps {
    inputNode?: AudioNode;
    outputNode?: AudioNode;
    color?: string;
}

export const AudioOrb3D: React.FC<AudioOrb3DProps> = ({
    inputNode,
    outputNode,
    color = '#000010'
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>();
    const sceneRef = useRef<{
        scene?: THREE.Scene;
        camera?: THREE.PerspectiveCamera;
        renderer?: THREE.WebGLRenderer;
        composer?: EffectComposer;
        sphere?: THREE.Mesh;
        backdrop?: THREE.Mesh;
        inputAnalyser?: AudioAnalyser;
        outputAnalyser?: AudioAnalyser;
    }>({});

    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;

        const container = containerRef.current;
        const canvas = canvasRef.current;

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0e1a);

        // Camera setup
        const camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        camera.position.z = 5;

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true
        });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Create sphere
        const sphereGeometry = new THREE.IcosahedronGeometry(1, 10);
        const sphereMaterial = new THREE.ShaderMaterial({
            vertexShader: sphereVertexShader,
            fragmentShader: sphereFragmentShader,
            uniforms: {
                time: { value: 0 },
                inputData: { value: new THREE.Vector4(0, 0, 0, 0) },
                outputData: { value: new THREE.Vector4(0, 0, 0, 0) },
                color: { value: new THREE.Color(color) },
                emissiveIntensity: { value: 3.0 }
            },
            side: THREE.FrontSide
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        scene.add(sphere);

        // Create backdrop
        const backdropGeometry = new THREE.IcosahedronGeometry(10, 5);
        const backdropMaterial = new THREE.ShaderMaterial({
            vertexShader: backdropVertexShader,
            fragmentShader: backdropFragmentShader,
            uniforms: {
                time: { value: 0 },
                aspectRatio: { value: container.clientWidth / container.clientHeight }
            },
            side: THREE.BackSide
        });
        const backdrop = new THREE.Mesh(backdropGeometry, backdropMaterial);
        scene.add(backdrop);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        // Post-processing
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

        // Bloom effect
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(container.clientWidth, container.clientHeight),
            1.5, // strength
            0.4, // radius
            0.85 // threshold
        );
        composer.addPass(bloomPass);

        // FXAA (anti-aliasing)
        const fxaaPass = new ShaderPass(FXAAShader);
        fxaaPass.material.uniforms['resolution'].value.x = 1 / (container.clientWidth * renderer.getPixelRatio());
        fxaaPass.material.uniforms['resolution'].value.y = 1 / (container.clientHeight * renderer.getPixelRatio());
        composer.addPass(fxaaPass);

        // Audio analysers
        let inputAnalyser: AudioAnalyser | undefined;
        let outputAnalyser: AudioAnalyser | undefined;

        if (inputNode) {
            inputAnalyser = new AudioAnalyser(inputNode, 32);
        }

        if (outputNode) {
            outputAnalyser = new AudioAnalyser(outputNode, 32);
        }

        // Store references
        sceneRef.current = {
            scene,
            camera,
            renderer,
            composer,
            sphere,
            backdrop,
            inputAnalyser,
            outputAnalyser
        };

        // Animation loop
        let time = 0;
        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);

            time += 0.01;

            // Update analysers
            if (inputAnalyser) {
                inputAnalyser.update();
            }

            if (outputAnalyser) {
                outputAnalyser.update();
            }

            // Update sphere shader uniforms
            if (sphere.material instanceof THREE.ShaderMaterial) {
                sphere.material.uniforms.time.value = time;

                if (inputAnalyser) {
                    sphere.material.uniforms.inputData.value.set(
                        inputAnalyser.data[0],
                        inputAnalyser.data[1],
                        inputAnalyser.data[2],
                        inputAnalyser.data[3]
                    );
                }

                if (outputAnalyser) {
                    sphere.material.uniforms.outputData.value.set(
                        outputAnalyser.data[0],
                        outputAnalyser.data[1],
                        outputAnalyser.data[2],
                        outputAnalyser.data[3]
                    );

                    // Scale sphere based on output audio
                    const avgOutput = outputAnalyser.getAverage();
                    const scale = 1 + (avgOutput / 255) * 0.2;
                    sphere.scale.setScalar(scale);
                }
            }

            // Update backdrop shader uniforms
            if (backdrop.material instanceof THREE.ShaderMaterial) {
                backdrop.material.uniforms.time.value = time;
            }

            // Rotate camera based on audio
            if (outputAnalyser) {
                const avgOutput = outputAnalyser.getAverage();
                const rotationSpeed = 0.001 + (avgOutput / 255) * 0.002;
                camera.position.x = Math.cos(time * rotationSpeed) * 5;
                camera.position.z = Math.sin(time * rotationSpeed) * 5;
                camera.lookAt(scene.position);
            }

            // Render
            composer.render();
        };

        animate();

        // Handle window resize
        const handleResize = () => {
            if (!container) return;

            const width = container.clientWidth;
            const height = container.clientHeight;

            camera.aspect = width / height;
            camera.updateProjectionMatrix();

            renderer.setSize(width, height);
            composer.setSize(width, height);

            // Update FXAA resolution
            fxaaPass.material.uniforms['resolution'].value.x = 1 / (width * renderer.getPixelRatio());
            fxaaPass.material.uniforms['resolution'].value.y = 1 / (height * renderer.getPixelRatio());

            // Update backdrop aspect ratio
            if (backdrop.material instanceof THREE.ShaderMaterial) {
                backdrop.material.uniforms.aspectRatio.value = width / height;
            }
        };

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);

            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            if (inputAnalyser) {
                inputAnalyser.dispose();
            }

            if (outputAnalyser) {
                outputAnalyser.dispose();
            }

            sphereGeometry.dispose();
            backdropGeometry.dispose();
            if (sphereMaterial) sphereMaterial.dispose();
            if (backdropMaterial) backdropMaterial.dispose();
            renderer.dispose();
        };
    }, [inputNode, outputNode]);

    // Update color when prop changes
    useEffect(() => {
        const { sphere } = sceneRef.current;
        if (sphere && sphere.material instanceof THREE.ShaderMaterial) {
            sphere.material.uniforms.color.value.set(color);
        }
    }, [color]);

    return (
        <div ref={containerRef} className="audio-orb-container" style={{ width: '100%', height: '100%' }}>
            <canvas ref={canvasRef} id="audio-orb-canvas"></canvas>
        </div>
    );
};

export default AudioOrb3D;
