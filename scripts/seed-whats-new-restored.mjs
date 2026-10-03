import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnvFiles(dirs) {
  for (const dir of dirs) {
    for (const file of ['.env', '.env.local']) {
      const path = resolve(dir, file);
      if (!existsSync(path)) continue;
      for (const line of readFileSync(path, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
}

loadEnvFiles([
  resolve(process.cwd()),
  resolve(process.cwd(), '..', 'FinderB'),
  resolve(process.cwd(), '..', 'FinderB Sites', 'FinderB'),
]);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase URL or key');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const title = 'Your account access is restored';
const body = 'You can now use your account again.';
const published_at = '2026-09-11T00:03:00+05:30';

const { data: existing, error: existingError } = await supabase
  .from('admin_whats_new')
  .select('id')
  .eq('title', title)
  .maybeSingle();

if (existingError) {
  console.error(existingError.message);
  process.exit(1);
}

if (existing?.id) {
  console.log('Already seeded', existing.id);
  process.exit(0);
}

const { data, error } = await supabase
  .from('admin_whats_new')
  .insert({ title, body, published_at })
  .select('id')
  .single();

if (error || !data) {
  console.error(error?.message || 'Insert failed');
  process.exit(1);
}

console.log('Seeded', data.id);
