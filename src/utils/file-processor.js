/**
 * File Processing Utilities
 */

import { FILE_CONFIG } from '../config/constants.js';

export class FileProcessor {
    static extractFileInfo(rawData) {
        let fileName = null;
        let fileData = null;

        if (rawData.file && typeof rawData.file === 'object') {
            fileName = rawData.file.filename || rawData.file.name;
            fileData = rawData.file.data || rawData.file.content;
        } else if (rawData.fileName && rawData.fileData) {
            fileName = rawData.fileName;
            fileData = rawData.fileData;
        }

        return { fileName, fileData };
    }

    static processFileData(fileData, rawFileObject, fileName) {
        let base64Data = fileData;
        let fileType = null;

        if (fileData.startsWith('data:')) {
            const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                fileType = matches[1];
                base64Data = matches[2];
            } else {
                throw new Error('Invalid file data format');
            }
        } else {
            fileType = rawFileObject?.type || this.guessFileTypeFromName(fileName);
        }

        return { base64Data, fileType };
    }

    static guessFileTypeFromName(filename) {
        if (!filename) return null;
        const ext = filename.toLowerCase().split('.').pop();
        return FILE_CONFIG.TYPE_MAPPING[ext] || null;
    }

    static validateFileType(fileType, allowedTypes = FILE_CONFIG.ALLOWED_TYPES) {
        return fileType && allowedTypes.includes(fileType);
    }

    static validateFileSize(size, maxSize = FILE_CONFIG.MAX_SIZE) {
        return size <= maxSize;
    }

    static sanitizeFilename(filename) {
        return filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
    }

    static async computeHash(buffer) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
}
