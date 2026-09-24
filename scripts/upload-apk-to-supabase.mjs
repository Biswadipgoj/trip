import fs from 'fs';
import path from 'path';
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
  console.log(`Uploading ${DEST_PATH} (${(stat.size / 1024 / 1024).toFixed(2)} MB)...`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Read file as buffer
  const fileBuffer = fs.readFileSync(APK_PATH);

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(DEST_PATH, fileBuffer, {
      contentType: 'application/vnd.android.package-archive',
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error('Upload failed:', error);
    process.exit(1);
  }

  console.log('Upload successful!', data);
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(DEST_PATH);

  console.log('Public Download URL:', publicUrlData.publicUrl);
}

upload().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
