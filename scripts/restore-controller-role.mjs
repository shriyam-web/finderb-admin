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

const { data, error } = await supabase
  .from('admins')
  .update({
    role: 'controller',
    is_disabled: false,
    login_enabled: true,
    allowed_tabs: null,
    allowed_tab_modes: null,
  })
  .eq('email', 'controller.dev@finderb.com')
  .select('id, email, role, login_enabled, is_disabled')
  .maybeSingle();

if (error) {
  console.error(error.message);
  process.exit(1);
}

if (!data) {
  console.error('No admin row for controller.dev@finderb.com');
  process.exit(1);
}

console.log(
  `${data.email} → ${data.role} | login_enabled=${data.login_enabled} | disabled=${data.is_disabled}`,
);
