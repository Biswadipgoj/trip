import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qufmbheewymzyzkfaivr.supabase.co';
// Releases are written with the service-role key only. The public anon key
// cannot write to the android-app bucket (supabase/migrations/20260925_harden_storage.sql),
// so nobody holding the web bundle's key can replace the APK.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) {
  console.error('Error: set SUPABASE_SERVICE_ROLE_KEY (Supabase Dashboard -> Project Settings -> API) to upload a release.');
  console.error('Keep it out of the repo and out of any NEXT_PUBLIC_/EXPO_PUBLIC_ variable.');
  process.exit(1);
}

const APK_PATH = path.resolve('./dist/tripmate-latest.apk');
const BUCKET_NAME = 'android-app';
const DEST_PATH = 'tripmate-latest.apk';

const MAX_FREE_TIER_CHUNK_BYTES = 40 * 1024 * 1024; // 40 MB chunks (well below Supabase 50MB ceiling)

async function upload() {
  console.log(`\n======================================================`);
  console.log(` TripMate: Supabase Storage Release APK Uploader`);
  console.log(` Target Supabase Project: ${SUPABASE_URL}`);
  console.log(`======================================================\n`);

  if (!fs.existsSync(APK_PATH)) {
    console.error(`Error: APK file not found at: ${APK_PATH}`);
    process.exit(1);
  }

  const stat = fs.statSync(APK_PATH);
  const totalBytes = stat.size;
  const sizeMB = (totalBytes / 1024 / 1024).toFixed(2);
  console.log(`APK File: ${DEST_PATH} (${sizeMB} MB)`);

  const originalBuffer = fs.readFileSync(APK_PATH);
  const sha256 = crypto.createHash('sha256').update(originalBuffer).digest('hex');
  console.log(`SHA-256: ${sha256}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // If APK is over 50MB, use high-speed multi-part chunking to comply with Supabase Free Tier
  if (totalBytes > 48 * 1024 * 1024) {
    console.log(`\nAPK size (${sizeMB} MB) exceeds 50 MB Free tier object limit.`);
    console.log(`Automatically packaging into 40 MB verified chunks for Supabase Storage...\n`);

    const partFiles = [];
    for (let i = 0, partIndex = 1; i < totalBytes; i += MAX_FREE_TIER_CHUNK_BYTES, partIndex++) {
      const partData = originalBuffer.subarray(i, i + MAX_FREE_TIER_CHUNK_BYTES);
      const partName = `${DEST_PATH}.part${partIndex}`;
      partFiles.push({ name: partName, data: partData });
    }

    for (const part of partFiles) {
      console.log(`Uploading ${part.name} (${(part.data.length / 1024 / 1024).toFixed(2)} MB)...`);
      const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(part.name, part.data, {
        contentType: 'application/octet-stream',
        cacheControl: '3600',
        upsert: true,
      });

      if (error) {
        console.error(`✗ Failed to upload ${part.name}:`, error.message || error);
        process.exit(1);
      }
      console.log(`✓ Uploaded ${part.name}`);
    }

    // Write release manifest for seamless client-side reassembly
    const manifest = {
      version: '4.0.1',
      fileName: DEST_PATH,
      sizeBytes: totalBytes,
      sha256: sha256,
      parts: partFiles.map(p => p.name),
      updatedAt: new Date().toISOString(),
    };

    const { error: manifestErr } = await supabase.storage.from(BUCKET_NAME).upload('release.json', Buffer.from(JSON.stringify(manifest, null, 2)), {
      contentType: 'application/octet-stream',
      cacheControl: '60',
      upsert: true,
    });

    if (manifestErr) {
      console.error('✗ Failed to upload release.json manifest:', manifestErr.message || manifestErr);
      process.exit(1);
    }
    console.log(`✓ Uploaded release manifest (release.json)`);
  } else {
    // Direct single upload for APKs <= 50MB
    console.log(`\nUploading directly to ${BUCKET_NAME}/${DEST_PATH}...`);
    const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(DEST_PATH, originalBuffer, {
      contentType: 'application/vnd.android.package-archive',
      cacheControl: '3600',
      upsert: true,
    });

    if (error) {
      console.error('✗ Direct upload failed:', error.message || error);
      process.exit(1);
    }
    console.log(`✓ Direct upload successful!`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(DEST_PATH);

  console.log(`\n======================================================`);
  console.log(`✓ Production APK Successfully Deployed to Supabase!`);
  console.log(`Storage Bucket: ${BUCKET_NAME}`);
  console.log(`Direct Public Download URL:`);
  console.log(publicUrlData.publicUrl);
  console.log(`======================================================\n`);
}

upload().catch((err) => {
  console.error('\nFatal upload error:', err.message || err);
  process.exit(1);
});
