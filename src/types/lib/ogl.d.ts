/**
 * Type definitions for OGL (Open GL library)
 * Partial type definitions for the OGL library used in voice visualizations
 */

declare module 'ogl' {
    /**
     * Vector 3 - 3D vector class
     */
    export class Vec3 {
        x: number;
        y: number;
        z: number;

        constructor(x?: number, y?: number, z?: number);
        set(x: number, y?: number, z?: number): this;
        copy(v: Vec3): this;
        add(v: Vec3): this;
        subtract(v: Vec3): this;
        multiply(scalar: number): this;
        divide(scalar: number): this;
        normalize(): this;
        length(): number;
        distance(v: Vec3): number;
        dot(v: Vec3): number;
        cross(v: Vec3): this;
    }

    /**
     * Renderer options
     */
    export interface RendererOptions {
        canvas?: HTMLCanvasElement;
        width?: number;
        height?: number;
        dpr?: number;
        alpha?: boolean;
        depth?: boolean;
        stencil?: boolean;
        antialias?: boolean;
        premultipliedAlpha?: boolean;
        preserveDrawingBuffer?: boolean;
        powerPreference?: 'default' | 'high-performance' | 'low-power';
        autoClear?: boolean;
        webgl?: number; // 1 or 2 for WebGL version
    }

    /**
     * WebGL Renderer
     */
    export class Renderer {
        gl: WebGLRenderingContext | WebGL2RenderingContext;
        dpr: number;
        width: number;
        height: number;
        canvas: HTMLCanvasElement;

        constructor(options?: RendererOptions);
        setSize(width: number, height: number): void;
        render(options: RenderOptions): void;
    }

    /**
     * Render options
     */
    export interface RenderOptions {
        scene: Transform;
        camera: Camera;
        target?: RenderTarget;
        clear?: boolean;
        update?: boolean;
        sort?: boolean;
        frustumCull?: boolean;
    }

    /**
     * Camera options
     */
    export interface CameraOptions {
        near?: number;
        far?: number;
        fov?: number;
        aspect?: number;
        left?: number;
        right?: number;
        bottom?: number;
        top?: number;
        zoom?: number;
    }

    /**
     * Camera class
     */
    export class Camera extends Transform {
        near: number;
        far: number;
        fov: number;
        aspect: number;
        projectionMatrix: Mat4;
        viewMatrix: Mat4;
        projectionViewMatrix: Mat4;
        worldPosition: Vec3;

        constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, options?: CameraOptions);
        perspective(options?: CameraOptions): this;
        orthographic(options?: CameraOptions): this;
        lookAt(target: Vec3 | number[]): this;
        project(v: Vec3): Vec3;
        unproject(v: Vec3): Vec3;
        updateMatrixWorld(): void;
    }

    /**
     * Transform node - base class for scene graph objects
     */
    export class Transform {
        position: Vec3;
        rotation: Vec3;
        scale: Vec3;
        quaternion: any;
        up: Vec3;
        matrix: Mat4;
        worldMatrix: Mat4;
        matrixAutoUpdate: boolean;
        parent: Transform | null;
        children: Transform[];
        visible: boolean;

        constructor();
        setParent(parent: Transform | null, notifyParent?: boolean): void;
        addChild(child: Transform, notifyChild?: boolean): void;
        removeChild(child: Transform, notifyChild?: boolean): void;
        updateMatrixWorld(force?: boolean): void;
        traverse(callback: (node: Transform) => void): void;
        decompose(): void;
        lookAt(target: Vec3 | number[], invert?: boolean): void;
    }

    /**
     * Matrix 4 - 4x4 transformation matrix
     */
    export class Mat4 extends Array<number> {
        constructor();
        set(...values: number[]): this;
        identity(): this;
        copy(m: Mat4): this;
        multiply(a: Mat4, b?: Mat4): this;
        invert(m?: Mat4): this;
        compose(position: Vec3, quaternion: any, scale: Vec3): this;
        getTranslation(v: Vec3): Vec3;
        getRotation(q: any): any;
        getScaling(v: Vec3): Vec3;
        lookAt(eye: Vec3, target: Vec3, up: Vec3): this;
        perspective(options: { fov: number; aspect: number; near: number; far: number }): this;
    }

    /**
     * Geometry options
     */
    export interface GeometryOptions {
        position?: { size?: number; data?: Float32Array };
        uv?: { size?: number; data?: Float32Array };
        normal?: { size?: number; data?: Float32Array };
        index?: { data?: Uint16Array | Uint32Array };
        [key: string]: any;
    }

    /**
     * Geometry class
     */
    export class Geometry {
        attributes: Record<string, any>;
        gl: WebGLRenderingContext | WebGL2RenderingContext;
        id: number;
        VAOs: Record<string, any>;
        drawRange: { start: number; count: number };
        instancedCount: number;
        glState: any;

        constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, attributes?: GeometryOptions);
        addAttribute(key: string, attr: any): void;
        updateAttribute(attr: any): void;
        setIndex(value: { data: Uint16Array | Uint32Array }): void;
        setDrawRange(start: number, count: number): void;
        setInstancedCount(value: number): void;
        createVAO(program: Program): void;
        bindVAO(program: Program): void;
        draw(options?: { mode?: number; count?: number; offset?: number; instancedCount?: number }): void;
        remove(): void;
    }

    /**
     * Program (shader) options
     */
    export interface ProgramOptions {
        vertex?: string;
        fragment?: string;
        uniforms?: Record<string, any>;
        transparent?: boolean;
        cullFace?: number | boolean;
        frontFace?: number;
        depthTest?: boolean;
        depthWrite?: boolean;
        depthFunc?: number;
    }

    /**
     * Program (shader program) class
     */
    export class Program {
        gl: WebGLRenderingContext | WebGL2RenderingContext;
        uniforms: Record<string, any>;
        id: number;
        transparent: boolean;
        cullFace: number | boolean;
        frontFace: number;
        depthTest: boolean;
        depthWrite: boolean;
        depthFunc: number;
        blendFunc: { src: number; dst: number; srcAlpha?: number; dstAlpha?: number };
        blendEquation: { modeRGB: number; modeAlpha?: number };

        constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, options?: ProgramOptions);
        setBlendFunc(src: number, dst: number, srcAlpha?: number, dstAlpha?: number): void;
        setBlendEquation(modeRGB: number, modeAlpha?: number): void;
        applyState(): void;
        use(options?: { flipFaces?: boolean }): void;
        remove(): void;
    }

    /**
     * Mesh - combines geometry and program
     */
    export class Mesh extends Transform {
        geometry: Geometry;
        program: Program;
        mode: number;
        frustumCulled: boolean;
        renderOrder: number;

        constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, options?: {
            geometry?: Geometry;
            program?: Program;
            mode?: number;
            frustumCulled?: boolean;
            renderOrder?: number;
        });
        draw(options?: { camera?: Camera }): void;
    }

    /**
     * Sphere geometry
     */
    export class Sphere extends Geometry {
        constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, options?: {
            radius?: number;
            widthSegments?: number;
            heightSegments?: number;
            phiStart?: number;
            phiLength?: number;
            thetaStart?: number;
            thetaLength?: number;
            attributes?: GeometryOptions;
        });
    }

    /**
     * Render target for off-screen rendering
     */
    export interface RenderTargetOptions {
        width?: number;
        height?: number;
        target?: number;
        color?: number;
        depth?: boolean;
        stencil?: boolean;
        depthTexture?: boolean;
        wrapS?: number;
        wrapT?: number;
        minFilter?: number;
        magFilter?: number;
        type?: number;
        format?: number;
        internalFormat?: number;
        unpackAlignment?: number;
        premultiplyAlpha?: boolean;
    }

    export class RenderTarget {
        gl: WebGLRenderingContext | WebGL2RenderingContext;
        width: number;
        height: number;
        depth: boolean;
        buffer: WebGLFramebuffer;
        target: number;
        textures: any[];
        texture: any;
        depthTexture: any;
        depthBuffer: WebGLRenderbuffer | null;
        stencilBuffer: WebGLRenderbuffer | null;
        glState: any;

        constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, options?: RenderTargetOptions);
        setSize(width: number, height: number): void;
    }

    /**
     * Texture class
     */
    export class Texture {
        gl: WebGLRenderingContext | WebGL2RenderingContext;
        id: number;
        image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageData | null;
        target: number;
        type: number;
        format: number;
        internalFormat: number;
        wrapS: number;
        wrapT: number;
        generateMipmaps: boolean;
        minFilter: number;
        magFilter: number;
        premultiplyAlpha: boolean;
        unpackAlignment: number;
        flipY: boolean;
        level: number;
        width: number;
        height: number;
        texture: WebGLTexture;
        store: {
            image: any;
        };
        glState: any;
        state: any;

        constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, options?: {
            image?: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageData;
            target?: number;
            type?: number;
            format?: number;
            internalFormat?: number;
            wrapS?: number;
            wrapT?: number;
            generateMipmaps?: boolean;
            minFilter?: number;
            magFilter?: number;
            premultiplyAlpha?: boolean;
            unpackAlignment?: number;
            flipY?: boolean;
            level?: number;
            width?: number;
            height?: number;
        });
        bind(): void;
        update(textureUnit?: number): void;
    }

    // Export common constants and utilities
    export const Vec2: any;
    export const Vec4: any;
    export const Quat: any;
    export const Euler: any;
    export const Mat3: any;
    export const Color: any;
    export const Polyline: any;
    export const Plane: any;
    export const Box: any;
    export const Orbit: any;
    export const Raycast: any;
    export const Skin: any;
    export const Animation: any;
    export const Text: any;
    export const NormalProgram: any;
    export const Flowmap: any;
    export const GPGPU: any;
    export const Torus: any;
    export const Triangle: any;
    export const Cube: any;
    export const Cylinder: any;
    export const Post: any;
}
