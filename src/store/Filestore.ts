import { FileStore, Configstore } from '@tus/file-store'
import fs from 'node:fs'
import path from 'node:path'


type Options = {
  directory: string
  configstore?: Configstore
  expirationPeriodInMilliseconds?: number
}


function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}


export class ExtendedFileStore extends FileStore {
  constructor(options: Options) {
    super(options)
  }
  // Remove the folder
  async removeFolder(id_or_path: string) {
    return new Promise((resolve, reject) => {
      fs.rmdir(id_or_path, { recursive: true }, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve(void 0)
        }
      })
    })
  }

  private traverseDirectory = (dir_path: string,
    fileCount = 0, size = 0, fileList: string[] = []) => {
    const files = fs.readdirSync(dir_path);
    for (let file of files) {
      let fullPath = path.join(dir_path, file);
      let stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        ({ fileCount, size, fileList } =
          this.traverseDirectory(fullPath, fileCount, size, fileList));
      } else {
        fileCount++;
        size += stats.size;
        let relativePath = path.relative(dir_path, fullPath);
        fileList.push(relativePath);
      }
    }
    return { fileCount, size, fileList };
  }

  async getFolderInfo(id_or_path: string) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(id_or_path)) {
        return { fileCount: 0, readSize: '0 Bytes', fileList: [] };
      }
      try {
        let { fileCount, size, fileList } = this.traverseDirectory(id_or_path);
        let readSize = formatBytes(size);
        resolve({ fileCount, readSize, fileList });
      } catch (err) {
        reject(err);
      }
    })
  }

  downloadFile(file_id: string) {
    const filePath = path.join(this.directory, file_id);
    if (!fs.existsSync(filePath)) {
      console.log('File not found');
      throw new Error('File not found');
    }
    
    return fs.createReadStream(path.join(this.directory, file_id))
  }
}
