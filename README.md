## Express js tus server for resumable file and folder  upload 
### Installation
```bash
npm install
npm start
```

### Environment variables
Udate .env file with your values

```bash
SERVER_PORT=4000
SERVER_URL=http://127.0.0.1:4000
ENABLE_FOLDER_UPLOAD=true # enable folder upload
SERVER_UPLOAD_PATH=/uploads

CORS_ORIGIN="http://localhost:3000"
REDIS_URL=redis://localhost:6379/0

# S3 storage configuration
S3_BUCKET=<bucket name>
S3_ENDPOINT=http://127.0.0.1:9000/
S3_ACCESS_KEY=<access key>
S3_ACCESS_SECRET=<access secret>
S3_REGION=<region> 

# You can disable tags by setting this to false, if your s3 server does not support tags eg. for R2 stroage
S3_USE_TAGS=true 

# Store configuration  it can be memory, s3_store or file_store
STORE_TYPE=s3_store

# Upload path when using file store 
FILE_STORE_PATH=./uploads
FILE_STORE_EXPIRY=86400000

# Config store can be memory, redis,  file
CONFIG_STORE=memory
CONFIG_STORE_PATH=./uploads
```

### Authentication & Authorization

To obtain a JWT token, you can either use the [ckanext-authz-service](https://github.com/datopian/ckanext-authz-service) CKAN extension if you are integrating with CKAN or create your own JWT token provider.

Provive public key in .env file or public key file path in .env file

``` bash
AUTH_PUBLIC_KEY_FILE=
AUTH_PUBLIC_KEY= 
SESSION_SECRET= # secret session key
SCOPE_TYPE=CKAN # CKAN authz type or any other scope type saparated by space
```

## Frontend Implementation
You could use [uppy](https://uppy.io/) to upload files and folders to tus server or use [tus-js-client](https://github.com/tus/tus-js-client)


```javascript
// Snippet for uppy
new Uppy({
        autoProceed: false,
    }).use(Tus, {
        async onBeforeRequest(req, file) {
            req.setHeader('Authorization', "JWT Token");
        },
        endpoint: "http://127.0.0.1:4000", // tus upload url
    });
```
