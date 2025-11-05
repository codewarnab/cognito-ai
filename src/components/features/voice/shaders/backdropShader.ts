/**
 * Backdrop shader for Three.js orb background
 * Creates an animated gradient background with noise texture
 */

export const backdropVertexShader = `
  varying vec3 vPosition;
  varying vec2 vUv;
  
  void main() {
    vPosition = position;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const backdropFragmentShader = `
  uniform float time;
  uniform float aspectRatio;
  
  varying vec3 vPosition;
  varying vec2 vUv;
  
  // Simple noise function
  float noise(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }
  
  // Smooth noise
  float smoothNoise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    
    float a = noise(i);
    float b = noise(i + vec2(1.0, 0.0));
    float c = noise(i + vec2(0.0, 1.0));
    float d = noise(i + vec2(1.0, 1.0));
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  
  void main() {
    // Adjust for aspect ratio
    vec2 st = vUv;
    st.x *= aspectRatio;
    
    // Create gradient from dark purple to black
    float gradient = smoothstep(0.0, 1.5, length(vPosition));
    
    // Add animated noise texture
    float noiseValue = smoothNoise(st * 5.0 + time * 0.1);
    
    // Base color (dark purple to black gradient)
    vec3 color1 = vec3(0.06, 0.05, 0.08); // Dark purple
    vec3 color2 = vec3(0.02, 0.02, 0.03); // Almost black
    
    vec3 baseColor = mix(color1, color2, gradient);
    
    // Add subtle noise overlay
    baseColor += vec3(noiseValue * 0.02);
    
    gl_FragColor = vec4(baseColor, 1.0);
  }
`;
