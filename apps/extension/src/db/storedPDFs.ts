/**
 * Stored PDFs API
 * 
 * CRUD operations for PDF storage in IndexedDB.
 * Fixes blob URL issue where PDFs can't be opened in new browser tabs.
 */

import { db } from './database';
import type { StoredPDF } from './types';

const PDF_EXPIRY_HOURS = 24;

/**
 * Generate a unique ID for PDF storage
 */
function generatePDFId(): string {
    return `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Store a PDF blob in IndexedDB
 * 
 * @param blob - The PDF blob to store
 * @param filename - Filename for the PDF
 * @returns The unique ID for the stored PDF
 */
export async function storePDF(blob: Blob, filename: string): Promise<string> {
    const id = generatePDFId();
    const now = Date.now();
    const expiresAt = now + (PDF_EXPIRY_HOURS * 60 * 60 * 1000);

    const storedPDF: StoredPDF = {
        id,
        filename,
        blob,
        size: blob.size,
        createdAt: now,
        expiresAt,
    };

    await db.storedPDFs.add(storedPDF);

    console.debug(`[StoredPDFs] Stored PDF: ${filename} (${id}), size: ${blob.size} bytes`);

    return id;
}

/**
 * Retrieve a stored PDF by ID
 * 
 * @param id - The PDF ID
 * @returns The stored PDF or undefined if not found
 */
export async function getPDF(id: string): Promise<StoredPDF | undefined> {
    const pdf = await db.storedPDFs.get(id);

    if (pdf) {
        // Check if expired
        if (Date.now() > pdf.expiresAt) {
            console.debug(`[StoredPDFs] PDF expired, deleting: ${id}`);
            await deletePDF(id);
            return undefined;
        }
    }

    return pdf;
}

/**
 * Delete a stored PDF by ID
 * 
 * @param id - The PDF ID to delete
 */
export async function deletePDF(id: string): Promise<void> {
    await db.storedPDFs.delete(id);
    console.debug(`[StoredPDFs] Deleted PDF: ${id}`);
}

/**
 * Clean up all expired PDFs
 * 
 * @returns The number of PDFs deleted
 */
export async function cleanupExpiredPDFs(): Promise<number> {
    const now = Date.now();

    // Find all expired PDFs
    const expiredPDFs = await db.storedPDFs
        .where('expiresAt')
        .below(now)
        .toArray();

    // Delete them
    for (const pdf of expiredPDFs) {
        await db.storedPDFs.delete(pdf.id);
    }

    if (expiredPDFs.length > 0) {
        console.debug(`[StoredPDFs] Cleaned up ${expiredPDFs.length} expired PDFs`);
    }

    return expiredPDFs.length;
}

/**
 * Get all stored PDFs (for debugging/management)
 * 
 * @returns Array of all stored PDFs
 */
export async function getAllStoredPDFs(): Promise<StoredPDF[]> {
    return db.storedPDFs.toArray();
}
