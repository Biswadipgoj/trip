import fs from 'fs';
import path from 'path';
import * as tus from 'tus-js-client';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qufmbheewymzyzkfaivr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1Zm1iaGVld3ltenl6a2ZhaXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTUxMDYsImV4cCI6MjA5NjU3MTEwNn0.pv9WAWZ41O09HWal24PTIpDhtal_GYJRgnf1IoLUhn4';

const APK_PATH = path.resolve('./dist/tripmate-latest.apk');
const BUCKET_NAME = 'android-app';
const DEST_PATH = 'tripmate-latest.apk';

async function upload() {
  console.log(`Connecting to Supabase at: ${SUPABASE_URL}`);
  if (!fs.existsSync(APK_PATH)) {
    console.error(`APK file not found at: ${APK_PATH}`);
    process.exit(1);
  }

  const stat = fs.statSync(APK_PATH);
  const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
  console.log(`Preparing to upload ${DEST_PATH} (${sizeMB} MB) via Resumable TUS protocol...`);

  // Extract project ref from URL (e.g. https://qufmbheewymzyzkfaivr.supabase.co -> qufmbheewymzyzkfaivr)
  const urlObj = new URL(SUPABASE_URL);
  const projectRef = urlObj.hostname.split('.')[0];
  const endpoint = `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;

  console.log(`TUS Endpoint: ${endpoint}`);

  const fileStream = fs.createReadStream(APK_PATH);

  await new Promise((resolve, reject) => {
    const upload = new tus.Upload(fileStream, {
      endpoint: endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: BUCKET_NAME,
        objectName: DEST_PATH,
        contentType: 'application/vnd.android.package-archive',
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024, // 6 MB chunks
      onError: (error) => {
        console.error('TUS upload failed:', error);
        reject(error);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const pct = ((bytesUploaded / bytesTotal) * 100).toFixed(1);
        console.log(`Uploaded ${(bytesUploaded / 1024 / 1024).toFixed(1)} / ${(bytesTotal / 1024 / 1024).toFixed(1)} MB (${pct}%)`);
      },
      onSuccess: () => {
        console.log('\n✓ APK successfully uploaded to Supabase Storage!');
        resolve();
      },
    });

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    }).catch(reject);
  });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(DEST_PATH);

  console.log('Public Download URL:', publicUrlData.publicUrl);
}

upload().catch((err) => {
  console.error('\nUpload error details:', err.message || err);
  process.exit(1);
});
