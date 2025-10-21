/**
 * Shader files for Three.js orb visualization
 * Custom vertex and fragment shaders for the audio-reactive sphere
 */

export const sphereVertexShader = `
  uniform float time;
  uniform vec4 inputData;
  uniform vec4 outputData;
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    
    // Create audio-reactive deformation
    float inputInfluence = (inputData.x + inputData.y + inputData.z + inputData.w) / 1020.0;
    float outputInfluence = (outputData.x + outputData.y + outputData.z + outputData.w) / 1020.0;
    
    // Combine input and output influences
    float totalInfluence = inputInfluence * 0.3 + outputInfluence * 0.7;
    
    // Create wave patterns based on audio
    float wave1 = sin(position.x * 2.0 + time + outputData.x / 50.0) * totalInfluence;
    float wave2 = cos(position.y * 2.0 + time + outputData.y / 50.0) * totalInfluence;
    float wave3 = sin(position.z * 2.0 + time + outputData.z / 50.0) * totalInfluence;
    
    // Apply deformation
    vec3 deformed = position + normal * (wave1 + wave2 + wave3) * 0.1;
    
    // Add pulsing effect based on output
    float pulse = 1.0 + outputInfluence * 0.2;
    deformed *= pulse;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(deformed, 1.0);
  }
`;

export const sphereFragmentShader = `
  uniform vec3 color;
  uniform float emissiveIntensity;
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  void main() {
    // Calculate lighting
    vec3 lightDirection = normalize(vec3(1.0, 1.0, 1.0));
    float lightIntensity = max(dot(vNormal, lightDirection), 0.0);
    
    // Add ambient lighting
    float ambient = 0.3;
    
    // Combine lighting
    vec3 finalColor = color * (lightIntensity * 0.7 + ambient);
    
    // Add emissive glow
    finalColor += color * emissiveIntensity * 0.5;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
