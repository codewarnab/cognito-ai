/**
 * File System Polyfill for Browser Environment
 * 
 * Provides polyfills for Node.js 'fs' module functions used by dependencies.
 * This is required because node-fetch dependencies (fetch-blob) try to use fs.promises
 * 
 * Note: Most fs operations cannot work in a browser environment.
 * These are stub implementations that throw errors when called.
 */

// Create a promise rejection helper
const createUnsupportedPromise = (method: string) => {
    return () => Promise.reject(new Error(`[fs polyfill] ${method} is not supported in browser environment`));
};

// Create a sync error helper
const createUnsupportedSync = (method: string) => {
    return () => {
        throw new Error(`[fs polyfill] ${method} is not supported in browser environment`);
    };
};

// Promises API - stub implementations
export const promises = {
    readFile: createUnsupportedPromise('readFile'),
    writeFile: createUnsupportedPromise('writeFile'),
    appendFile: createUnsupportedPromise('appendFile'),
    unlink: createUnsupportedPromise('unlink'),
    mkdir: createUnsupportedPromise('mkdir'),
    rmdir: createUnsupportedPromise('rmdir'),
    readdir: createUnsupportedPromise('readdir'),
    stat: createUnsupportedPromise('stat'),
    lstat: createUnsupportedPromise('lstat'),
    rename: createUnsupportedPromise('rename'),
    copyFile: createUnsupportedPromise('copyFile'),
    access: createUnsupportedPromise('access'),
    chmod: createUnsupportedPromise('chmod'),
    chown: createUnsupportedPromise('chown'),
    utimes: createUnsupportedPromise('utimes'),
    realpath: createUnsupportedPromise('realpath'),
    link: createUnsupportedPromise('link'),
    symlink: createUnsupportedPromise('symlink'),
    readlink: createUnsupportedPromise('readlink'),
    truncate: createUnsupportedPromise('truncate'),
    open: createUnsupportedPromise('open'),
    rm: createUnsupportedPromise('rm'),
    watch: createUnsupportedPromise('watch'),
};

// Sync functions - stub implementations
export const readFileSync = createUnsupportedSync('readFileSync');
export const writeFileSync = createUnsupportedSync('writeFileSync');
export const appendFileSync = createUnsupportedSync('appendFileSync');
export const unlinkSync = createUnsupportedSync('unlinkSync');
export const mkdirSync = createUnsupportedSync('mkdirSync');
export const rmdirSync = createUnsupportedSync('rmdirSync');
export const readdirSync = createUnsupportedSync('readdirSync');
export const statSync = createUnsupportedSync('statSync');
export const lstatSync = createUnsupportedSync('lstatSync');
export const renameSync = createUnsupportedSync('renameSync');
export const copyFileSync = createUnsupportedSync('copyFileSync');
export const accessSync = createUnsupportedSync('accessSync');
export const chmodSync = createUnsupportedSync('chmodSync');
export const chownSync = createUnsupportedSync('chownSync');
export const existsSync = () => false; // Safe to return false
export const realpathSync = createUnsupportedSync('realpathSync');
export const linkSync = createUnsupportedSync('linkSync');
export const symlinkSync = createUnsupportedSync('symlinkSync');
export const readlinkSync = createUnsupportedSync('readlinkSync');
export const truncateSync = createUnsupportedSync('truncateSync');

// Async functions - stub implementations
export const readFile = (_path: string, options: any, callback?: any) => {
    const cb = typeof options === 'function' ? options : callback;
    if (cb) cb(new Error('[fs polyfill] readFile is not supported in browser environment'));
};
export const writeFile = (_path: string, _data: any, options: any, callback?: any) => {
    const cb = typeof options === 'function' ? options : callback;
    if (cb) cb(new Error('[fs polyfill] writeFile is not supported in browser environment'));
};
export const appendFile = (_path: string, _data: any, options: any, callback?: any) => {
    const cb = typeof options === 'function' ? options : callback;
    if (cb) cb(new Error('[fs polyfill] appendFile is not supported in browser environment'));
};
export const stat = (_path: string, callback: any) => {
    callback(new Error('[fs polyfill] stat is not supported in browser environment'));
};
export const lstat = (_path: string, callback: any) => {
    callback(new Error('[fs polyfill] lstat is not supported in browser environment'));
};
export const exists = (_path: string, callback: any) => {
    callback(false);
};

// Stream functions - stub implementations that throw
export const createReadStream = createUnsupportedSync('createReadStream');
export const createWriteStream = createUnsupportedSync('createWriteStream');

// Watch functions
export const watch = createUnsupportedSync('watch');
export const watchFile = createUnsupportedSync('watchFile');
export const unwatchFile = createUnsupportedSync('unwatchFile');

// File descriptor functions
export const open = (_path: string, _flags: any, mode: any, callback?: any) => {
    const cb = typeof mode === 'function' ? mode : callback;
    if (cb) cb(new Error('[fs polyfill] open is not supported in browser environment'));
};
export const close = (_fd: number, callback: any) => {
    callback(new Error('[fs polyfill] close is not supported in browser environment'));
};
export const read = (_fd: number, _buffer: any, _offset: number, _length: number, _position: any, callback: any) => {
    callback(new Error('[fs polyfill] read is not supported in browser environment'));
};
export const write = (_fd: number, _buffer: any, _offset: number, _length: number, _position: any, callback: any) => {
    callback(new Error('[fs polyfill] write is not supported in browser environment'));
};

// Directory functions
export const mkdir = (_path: string, options: any, callback?: any) => {
    const cb = typeof options === 'function' ? options : callback;
    if (cb) cb(new Error('[fs polyfill] mkdir is not supported in browser environment'));
};
export const readdir = (_path: string, options: any, callback?: any) => {
    const cb = typeof options === 'function' ? options : callback;
    if (cb) cb(new Error('[fs polyfill] readdir is not supported in browser environment'));
};
export const rmdir = (_path: string, options: any, callback?: any) => {
    const cb = typeof options === 'function' ? options : callback;
    if (cb) cb(new Error('[fs polyfill] rmdir is not supported in browser environment'));
};

// Link functions
export const link = (_existingPath: string, _newPath: string, callback: any) => {
    callback(new Error('[fs polyfill] link is not supported in browser environment'));
};
export const unlink = (_path: string, callback: any) => {
    callback(new Error('[fs polyfill] unlink is not supported in browser environment'));
};
export const symlink = (_target: string, _path: string, type: any, callback?: any) => {
    const cb = typeof type === 'function' ? type : callback;
    if (cb) cb(new Error('[fs polyfill] symlink is not supported in browser environment'));
};
export const readlink = (_path: string, options: any, callback?: any) => {
    const cb = typeof options === 'function' ? options : callback;
    if (cb) cb(new Error('[fs polyfill] readlink is not supported in browser environment'));
};
export const realpath = (_path: string, options: any, callback?: any) => {
    const cb = typeof options === 'function' ? options : callback;
    if (cb) cb(new Error('[fs polyfill] realpath is not supported in browser environment'));
};

// Permission functions
export const chmod = (_path: string, _mode: any, callback: any) => {
    callback(new Error('[fs polyfill] chmod is not supported in browser environment'));
};
export const chown = (_path: string, _uid: number, _gid: number, callback: any) => {
    callback(new Error('[fs polyfill] chown is not supported in browser environment'));
};
export const access = (_path: string, mode: any, callback?: any) => {
    const cb = typeof mode === 'function' ? mode : callback;
    if (cb) cb(new Error('[fs polyfill] access is not supported in browser environment'));
};

// Other functions
export const rename = (_oldPath: string, _newPath: string, callback: any) => {
    callback(new Error('[fs polyfill] rename is not supported in browser environment'));
};
export const copyFile = (_src: string, _dest: string, mode: any, callback?: any) => {
    const cb = typeof mode === 'function' ? mode : callback;
    if (cb) cb(new Error('[fs polyfill] copyFile is not supported in browser environment'));
};
export const truncate = (_path: string, len: number, callback?: any) => {
    const cb = typeof len === 'function' ? len : callback;
    if (cb) cb(new Error('[fs polyfill] truncate is not supported in browser environment'));
};
export const utimes = (_path: string, _atime: any, _mtime: any, callback: any) => {
    callback(new Error('[fs polyfill] utimes is not supported in browser environment'));
};

// Constants
export const constants = {
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1,
    COPYFILE_EXCL: 1,
    COPYFILE_FICLONE: 2,
    COPYFILE_FICLONE_FORCE: 4,
    O_RDONLY: 0,
    O_WRONLY: 1,
    O_RDWR: 2,
    O_CREAT: 64,
    O_EXCL: 128,
    O_TRUNC: 512,
    O_APPEND: 1024,
    S_IFMT: 61440,
    S_IFREG: 32768,
    S_IFDIR: 16384,
    S_IFCHR: 8192,
    S_IFBLK: 24576,
    S_IFIFO: 4096,
    S_IFLNK: 40960,
    S_IFSOCK: 49152,
};

// Default export
export default {
    promises,
    readFileSync,
    writeFileSync,
    appendFileSync,
    unlinkSync,
    mkdirSync,
    rmdirSync,
    readdirSync,
    statSync,
    lstatSync,
    renameSync,
    copyFileSync,
    accessSync,
    chmodSync,
    chownSync,
    existsSync,
    realpathSync,
    linkSync,
    symlinkSync,
    readlinkSync,
    truncateSync,
    readFile,
    writeFile,
    appendFile,
    stat,
    lstat,
    exists,
    createReadStream,
    createWriteStream,
    watch,
    watchFile,
    unwatchFile,
    open,
    close,
    read,
    write,
    mkdir,
    readdir,
    rmdir,
    link,
    unlink,
    symlink,
    readlink,
    realpath,
    chmod,
    chown,
    access,
    rename,
    copyFile,
    truncate,
    utimes,
    constants,
};
