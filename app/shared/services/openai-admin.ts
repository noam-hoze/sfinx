import fs from 'fs';
import path from 'path';

/**
 * Validates an OpenAI API key against the live OpenAI API endpoint
 */
export async function validateOpenAIKey(key: string): Promise<{ valid: boolean; status: number; message: string }> {
  if (!key || key.trim() === '') {
    return { valid: false, status: 401, message: 'No key provided' };
  }
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    if (res.ok) {
      const data = await res.json();
      return { valid: true, status: res.status, message: `Active & Valid (${data.data?.length || 0} models available)` };
    } else {
      const err = await res.json().catch(() => ({}));
      return { valid: false, status: res.status, message: err?.error?.message || 'Invalid or Revoked API Key (HTTP 401)' };
    }
  } catch (e: any) {
    return { valid: false, status: 500, message: e?.message || 'Network error verifying key' };
  }
}

/**
 * Updates OPENAI_API_KEY in .env.local file
 */
export function updateEnvLocalKey(newKey: string) {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('OPENAI_API_KEY=')) {
        content = content.replace(/OPENAI_API_KEY=.*/g, `OPENAI_API_KEY="${newKey}"`);
      } else {
        content += `\nOPENAI_API_KEY="${newKey}"`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
    }
    process.env.OPENAI_API_KEY = newKey;
  } catch (err) {
    console.error('Error updating .env.local:', err);
  }
}

/**
 * Programmatically creates a new Service Account API key using OpenAI Administration API
 * and automatically deletes all previous Service Accounts under the project.
 */
export async function rotateOpenAIKeysViaAdminApi(adminKey: string): Promise<{ key?: string; saId?: string; revokedOldKeysCount: number; success: boolean; error?: string }> {
  try {
    // 1. Fetch Organization Projects
    const projRes = await fetch('https://api.openai.com/v1/organization/projects', {
      headers: { 'Authorization': `Bearer ${adminKey}` }
    });

    if (!projRes.ok) {
      const err = await projRes.json().catch(() => ({}));
      return { success: false, revokedOldKeysCount: 0, error: err?.error?.message || `HTTP ${projRes.status} fetching projects` };
    }

    const projData = await projRes.json();
    const targetProj = projData.data?.find((p: any) => p.name === 'Default project') || projData.data?.[0];

    if (!targetProj) {
      return { success: false, revokedOldKeysCount: 0, error: 'No active OpenAI projects found for organization' };
    }

    const projectId = targetProj.id;

    // 2. Fetch existing Service Accounts to identify old ones for deletion
    const existingSaRes = await fetch(`https://api.openai.com/v1/organization/projects/${projectId}/service_accounts`, {
      headers: { 'Authorization': `Bearer ${adminKey}` }
    });
    const existingSaData = await existingSaRes.json().catch(() => ({ data: [] }));
    const oldSaIds: string[] = (existingSaData.data || []).map((sa: any) => sa.id);

    // 3. Create New Service Account API Key
    const saRes = await fetch(`https://api.openai.com/v1/organization/projects/${projectId}/service_accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `sfinx-nhi-sa-${Date.now()}`
      })
    });

    if (!saRes.ok) {
      const err = await saRes.json().catch(() => ({}));
      return { success: false, revokedOldKeysCount: 0, error: err?.error?.message || `HTTP ${saRes.status} creating service account` };
    }

    const saData = await saRes.json();
    const newSaId = saData.id;
    const secretKey = saData.api_key?.value || saData.api_key?.secret;

    // 4. Delete Old Service Accounts from OpenAI Platform
    let revokedOldKeysCount = 0;
    for (const oldSaId of oldSaIds) {
      if (oldSaId !== newSaId) {
        try {
          const delRes = await fetch(`https://api.openai.com/v1/organization/projects/${projectId}/service_accounts/${oldSaId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminKey}` }
          });
          if (delRes.ok) {
            revokedOldKeysCount++;
          }
        } catch {
          // Continue deleting remaining
        }
      }
    }

    if (secretKey) {
      updateEnvLocalKey(secretKey);
    }

    return { key: secretKey, saId: newSaId, revokedOldKeysCount, success: true };
  } catch (e: any) {
    return { success: false, revokedOldKeysCount: 0, error: e?.message || 'Network error calling OpenAI Admin API' };
  }
}
