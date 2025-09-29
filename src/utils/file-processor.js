/**
 * File Processing Utilities - Production Ready
 */

import { FILE_CONFIG } from '../config/constants.js';

export class FileProcessor {
    /**
     * Extract file information from raw data with multiple format support
     */
    static extractFileInfo(rawData) {
        let fileName = null;
        let fileData = null;

        // Log for debugging in production
        console.log('File extraction - available keys:', Object.keys(rawData).filter(k => k.toLowerCase().includes('file')));

        // Case 1: Frontend format (fileName + file as base64)
        if (rawData.fileName && rawData.file) {
            fileName = rawData.fileName;
            fileData = rawData.file;
        }
        // Case 2: Alternative frontend format (filename + fileData)
        else if (rawData.filename && rawData.fileData) {
            fileName = rawData.filename;
            fileData = rawData.fileData;
        }
        // Case 3: Object format (nested file object)
        else if (rawData.file && typeof rawData.file === 'object') {
            fileName = rawData.file.filename || rawData.file.name;
            fileData = rawData.file.data || rawData.file.content;
        }
        // Case 4: Direct base64 with name inference
        else if (rawData.file && typeof rawData.file === 'string') {
            fileName = rawData.fileName || `file_${Date.now()}`;
            fileData = rawData.file;
        }

        // Validate extracted data
        if (fileName && fileData) {
            console.log('File extracted successfully:', {
                fileName,
                dataLength: fileData.length,
                dataPrefix: fileData.substring(0, 50) + '...'
            });
        }

        return { fileName, fileData };
    }

    /**
     * Process file data and extract base64 content and file type
     */
    static processFileData(fileData, rawFileObject, fileName) {
        let base64Data = fileData;
        let fileType = null;

        try {
            // Handle data URL format (frontend FileReader output)
            if (fileData.startsWith('data:')) {
                const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    fileType = matches[1];
                    base64Data = matches[2];
                } else {
                    throw new Error('Invalid data URL format');
                }
            }
            // Handle direct base64 format
            else {
                // Validate base64 format
                if (!this.isValidBase64(fileData)) {
                    throw new Error('Invalid base64 data');
                }
                fileType = rawFileObject?.type || this.guessFileTypeFromName(fileName);
            }

            return { base64Data, fileType };

        } catch (error) {
            console.error('File data processing failed:', error);
            throw new Error(`File processing error: ${error.message}`);
        }
    }

    /**
     * Validate base64 string format
     */
    static isValidBase64(str) {
        if (typeof str !== 'string') return false;
        try {
            return btoa(atob(str)) === str;
        } catch (err) {
            return false;
        }
    }

    /**
     * Guess file type from filename extension
     */
    static guessFileTypeFromName(filename) {
        if (!filename) return 'application/octet-stream';

        const ext = filename.toLowerCase().split('.').pop();
        const typeMap = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };

        return typeMap[ext] || FILE_CONFIG.TYPE_MAPPING[ext] || 'application/octet-stream';
    }

    /**
     * Validate file type against allowed types
     */
    static validateFileType(fileType, allowedTypes = FILE_CONFIG.ALLOWED_TYPES) {
        if (!fileType) return false;

        // Extract main type (image/jpeg -> jpeg)
        const mainType = fileType.split('/').pop();
        const fullType = fileType;

        return allowedTypes.includes(mainType) || allowedTypes.includes(fullType);
    }

    /**
     * Validate file size
     */
    static validateFileSize(size, maxSize = FILE_CONFIG.MAX_SIZE) {
        return size <= maxSize;
    }

    /**
     * Sanitize filename for security
     */
    static sanitizeFilename(filename) {
        return filename
            .replace(/[^a-zA-Z0-9.\-_]/g, '_')
            .replace(/_{2,}/g, '_')
            .substring(0, 255); // Limit length
    }

    /**
     * Compute SHA-256 hash for file
     */
    static async computeHash(buffer) {
        try {
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            return Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        } catch (error) {
            console.error('Hash computation failed:', error);
            throw new Error('File hash computation failed');
        }
    }

    /**
     * Comprehensive file validation
     */
    static validateFile(fileInfo, allowedTypes, maxSize) {
        const errors = [];

        if (!fileInfo.type) {
            errors.push('Unable to detect file type');
        } else if (!this.validateFileType(fileInfo.type, allowedTypes)) {
            errors.push(`File type ${fileInfo.type} not allowed`);
        }

        if (!this.validateFileSize(fileInfo.size, maxSize)) {
            errors.push(`File size ${fileInfo.size} exceeds limit ${maxSize}`);
        }

        if (!fileInfo.filename || fileInfo.filename.length === 0) {
            errors.push('Invalid filename');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
