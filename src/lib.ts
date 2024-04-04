import { fileStoreDatastore, s3StoreDatastore } from './index';

export const getResourceSummary = async (storeType: string, resourcePath: string) => {
  switch (storeType) {
    case 'file_store':
      return await fileStoreDatastore.getFolderInfo(resourcePath);
    case 's3store':
      // TODO: Implement S3 folder info retrieval
      break;
    default:
      throw new Error(`Unsupported store type: ${storeType}`);
  }
};

export const deleteResource = async (storeType: string, resourcePath: string) => {
  switch (storeType) {
    case 'file_store':
      return await fileStoreDatastore.removeFolder(resourcePath);
    case 's3store':
      // TODO: Implement S3 folder deletion
      break;
    default:
      throw new Error(`Unsupported store type: ${storeType}`);
  }
};

export const downloadFile = async (storeType: string, file: string) => {
  switch (storeType) {
    case 'file_store':
      return await fileStoreDatastore.downloadFile(file);
    case 's3store':
      // TODO: Implement S3 file download
      break;
    default:
      throw new Error(`Unsupported store type: ${storeType}`);
  }
};