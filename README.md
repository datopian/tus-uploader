## Express js tus server for resumable file and folder  upload 
### Installation
```bash
npm install
npm start
```

### Environment variables
Udate .env file with your values

```bash
S3_BUCKET= 
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_ACCESS_SECRET=
S3_REGION=
```


### Authentication & Authorization

To obtain a JWT token, you can either use the [ckanext-authz-service](https://github.com/datopian/ckanext-authz-service) CKAN extension if you are integrating with CKAN or create your own JWT token provider.

Provive public key in .env file or public key file path in .env file

``` bash
AUTH_PUBLIC_KEY_FILE=
AUTH_PUBLIC_KEY= 
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

### Notes
If you are using tus-js-client, you need to set useTags to false in storage configuration

```
new S3Store({
  ...restOptions
  useTags: false
})

```