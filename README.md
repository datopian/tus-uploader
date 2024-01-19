## Express js server for tus resumable directory upload 
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


### Notes
It does not work with R2 as [CloudFlare](https://developers.cloudflare.com/r2/api/s3/api/#implemented-bucket-level-operations),  does not yet support the `x-amz-tagging-directive` header in R2.