import * as companion from '@uppy/companion'
import { config } from './config'

// extract protocal and host form url 
const companionDomain = config.companionDomain
const companionOptions = {
	providerOptions: {
		dropbox: {
			key: config.companionDropboxKey,
			secret: config.companionDropboxSecret,
			scope: 'files.content.read files.content.write files.metadata.read',
		},
	},
	server: {
		host: companionDomain.split('://')[0],
		protocol: companionDomain.split('://')[1]
	},
	path: '/',
	filePath: config.campanionTempPath,
	secret: config.campanionSecret,
	debug: config.debug
}

let appResult = companion.app(companionOptions)

export default {
	app: appResult.app,
	socket: companion.socket,
}


