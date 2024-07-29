import { Buffer } from 'buffer';

export {};

declare global {
    interface Window {
        Buffer: any;
    }
}

window.Buffer = Buffer;
