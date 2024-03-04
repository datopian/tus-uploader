import { FileStore, Configstore } from '@tus/file-store'
import fs from 'node:fs'
import stream from 'node:stream'
import http from 'node:http'
import { DataStore, Upload } from '@tus/server'


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
	async removeFolder(folder: string) {
		return new Promise((resolve, reject) => {
			fs.rmdir(folder, { recursive: true }, (err) => {
				if (err) {
					reject(err)
				} else {
					resolve(void 0)
				}
			})
		})

	}

	// Get the folder info ex: size, file count
	async getFolderInfo(folder: string) {
		return new Promise((resolve, reject) => {
			fs.readdir(folder, (err, files) => {
				if (err) {
					reject(err)
				} else {
					let fileCount = files.length
					let size = 0
					let readSize = ''
					files.forEach((file) => {
						size += fs.statSync(folder + '/' + file).size
					})
					readSize = formatBytes(size)
					resolve({ fileCount, readSize })
				}
			})
		})
	}
}
