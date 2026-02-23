/**
 * Structured Logger for Job Queue System
 * Provides consistent logging with timestamps, levels, and metadata
 */

export enum LogLevel {
    ERROR = 'ERROR',
    WARN = 'WARN',
    INFO = 'INFO',
    DEBUG = 'DEBUG',
}

interface LogMetadata {
    [key: string]: any;
}

class Logger {
    private formatTimestamp(): string {
        return new Date().toISOString();
    }

    private formatMessage(
        level: LogLevel,
        message: string,
        metadata?: LogMetadata
    ): string {
        const timestamp = this.formatTimestamp();
        const baseLog = `[${timestamp}] [${level}] ${message}`;

        if (metadata && Object.keys(metadata).length > 0) {
            return `${baseLog} ${JSON.stringify(metadata, null, 2)}`;
        }

        return baseLog;
    }

    error(message: string, metadata?: LogMetadata): void {
        console.error(this.formatMessage(LogLevel.ERROR, message, metadata));
    }

    warn(message: string, metadata?: LogMetadata): void {
        console.warn(this.formatMessage(LogLevel.WARN, message, metadata));
    }

    info(message: string, metadata?: LogMetadata): void {
        console.log(this.formatMessage(LogLevel.INFO, message, metadata));
    }

    debug(message: string, metadata?: LogMetadata): void {
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
            console.log(this.formatMessage(LogLevel.DEBUG, message, metadata));
        }
    }

    /**
     * Log error with full error object details
     */
    logError(error: Error, context?: string, metadata?: LogMetadata): void {
        const errorMetadata: LogMetadata = {
            ...metadata,
            errorName: error.name,
            errorMessage: error.message,
            stack: error.stack,
        };

        if (context) {
            errorMetadata.context = context;
        }

        // Add custom error properties if they exist
        if ('errorCode' in error) {
            errorMetadata.errorCode = (error as any).errorCode;
        }
        if ('statusCode' in error) {
            errorMetadata.statusCode = (error as any).statusCode;
        }
        if ('isOperational' in error) {
            errorMetadata.isOperational = (error as any).isOperational;
        }

        this.error('Error occurred', errorMetadata);
    }
}

// Export singleton instance
export const logger = new Logger();
