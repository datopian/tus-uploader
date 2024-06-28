import dotenv from 'dotenv'
dotenv.config()


const envs = {
    // General configuration
    serverPort: process.env.SERVER_PORT || 4000,
    serverUrl: process.env.SERVER_URL || 'http://localhost:4000',
    enableFolderUpload: process.env.ENABLE_FOLDER_UPLOAD === 'true' || false,
    serverUploadPath: process.env.SERVER_UPLOAD_PATH || '/upload',
    debug: process.env.DEBUG === 'true' || false,
    env: process.env.NODE_ENV || 'development',


    // Auth configuration
    corsOrigin: process.env.CORS_ORIGIN || '*',
    sessionSecret: process.env.SESSION_SECRET || 'secret',
    sessionExpiry: parseInt(process.env.SESSION_EXPIRY as string) || 86400,
    scopeType: process.env.SCOPE_TYPE || 'CKAN',
    authPublicKey: process.env.AUTH_PUBLIC_KEY || '',
    authPublicKeyFile: process.env.AUTH_PUBLIC_KEY_FILE || '',

    // Redis configuration
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379/0',

    // S3 configuration
    s3UseTags: process.env.S3_USE_TAGS === 'true' || false,
    s3Bucket: process.env.S3_BUCKET as string,
    s3Endpoint: process.env.S3_ENDPOINT as string,
    s3AccessKey: process.env.S3_ACCESS_KEY as string,
    s3AccessSecret: process.env.S3_ACCESS_SECRET as string,
    s3Region: process.env.S3_REGION as string,
    s3PartSize: parseInt(process.env.S3_PART_SIZE as string) || 10485760,

    // Store configuration
    storeType: process.env.STORE_TYPE || 'file_store',
    fileStorePath: process.env.FILE_STORE_PATH || './uploads',
    fileStoreExpiry: parseInt(process.env.FILE_STORE_EXPIRY as string) || 86400000,
    configStore: process.env.CONFIG_STORE || 'memory',

    // Uppy companion configuration
    companionUppyUpload: process.env.COMPANION_UPLOAD_ENABLE === 'true' || false,
    campanionSecret: process.env.COMPANION_SECRET || 'some-secret',
    campanionTempPath: process.env.COMPANION_TEMP_PATH || './uploads/tmp',
    companionDomain: process.env.COMPANION_DOMAIN || 'http://localhost:3020',
    companionDropboxKey: process.env.COMPANION_DROPBOX_KEY as string,
    companionDropboxSecret: process.env.COMPANION_DROPBOX_SECRET as string,
}

export const config = {
    ...envs,
};