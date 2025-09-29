/**
 * Submission Data Preparation
 */

export class SubmissionBuilder {
    static extractFormFields(data) {
        return {
            name: data.name || data.Name,
            email: data.email || data.Email,
            message: data.message || data.Message,
            phone: data.phone || data.Phone,
            subject: data.subject || data.Subject,
            company: data.company || data.Company,
            website: data.website || data.Website
        };
    }

    static build(formFields, fileInfo, request, env) {
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        const now = new Date();

        return {
            // Form data
            Name: formFields.name,
            Email: formFields.email,
            Message: formFields.message,
            Phone: formFields.phone,
            Subject: formFields.subject,
            Company: formFields.company,
            Website: formFields.website,

            // Metadata
            Timestamp: now.toISOString(),
            'IP Address': clientIP,
            'Country': request.headers.get('cf-ipcountry') || 'Unknown',
            'User Agent': request.headers.get('user-agent') || 'Unknown',
            Origin: request.headers.get('origin') || 'Unknown',
            Referer: request.headers.get('referer') || 'Unknown',

            // File information
            'File Name': fileInfo ? fileInfo.filename : null,
            'File Size': fileInfo ? fileInfo.size : null,
            'File URL': fileInfo ? fileInfo.url : null,
            'File Hash': fileInfo ? fileInfo.hash : null,

            // System fields
            'Submission ID': this.generateUUID(),
            'Environment': env.ENVIRONMENT || 'production',
            'Created At': now.toISOString(),
        };
    }

    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }
}
