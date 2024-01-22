## Express js tus server for  resumable file and folder  upload 
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
Provive public key in .env file or public key file path in .env file

``` bash
AUTH_PUBLIC_KEY_FILE=
AUTH_PUBLIC_KEY= 
```


### Notes
It does not work with R2 as [CloudFlare](https://developers.cloudflare.com/r2/api/s3/api/#implemented-bucket-level-operations),  does not yet support the `x-amz-tagging-directive` header in R2.