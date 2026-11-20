const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'firebase-app');

app.use(express.json());

function getFirebaseConfig() {
  const appletConfigPath = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(appletConfigPath)) {
    try {
      return JSON.parse(fs.readFileSync(appletConfigPath, 'utf8'));
    } catch (err) {
      console.warn('[AI Studio] Failed to parse firebase-applet-config.json:', err.message);
    }
  }

  return {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'ignite-chapel-membership-app.firebaseapp.com',
    projectId: process.env.FIREBASE_PROJECT_ID || 'ignite-chapel-membership-app',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'ignite-chapel-membership-app.firebasestorage.app',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '260200397046',
    appId: process.env.FIREBASE_APP_ID || '1:260200397046:web:b0c2517d29dc012b9014d7'
  };
}

app.get('/firebase-config.js', (_req, res) => {
  const config = getFirebaseConfig();
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`window.__FIREBASE_CONFIG__ = ${JSON.stringify(config)};\n` +
    fs.readFileSync(path.join(PUBLIC_DIR, 'firebase-config.js'), 'utf8'));
});

app.post('/createAdmin', async (req, res) => {
  const config = getFirebaseConfig();
  if (!config.apiKey) {
    return res.status(500).json({ error: 'FIREBASE_API_KEY is not configured in environment.' });
  }

  const { email, password, displayName, permissions } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const authRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      }
    );
    const authData = await authRes.json();
    if (!authRes.ok) {
      throw new Error(authData.error?.message || 'Failed to create auth user');
    }

    const fields = {
      email: { stringValue: email },
      role: { stringValue: 'admin' },
      permissions: { arrayValue: { values: (permissions || []).map(p => ({ stringValue: p })) } },
      displayName: { stringValue: displayName || email.split('@')[0] },
      createdBy: { stringValue: '' },
      createdAt: { stringValue: new Date().toISOString() },
      lastLogin: { nullValue: null }
    };
    const docPath = `projects/${config.projectId}/databases/(default)/documents/users/${authData.localId}`;
    const fsRes = await fetch(`https://firestore.googleapis.com/v1/${docPath}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    if (!fsRes.ok) {
      const err = await fsRes.json();
      throw new Error(err.error?.message || 'Failed to create user profile');
    }

    return res.json({ success: true, uid: authData.localId, email });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.delete('/deleteUser/:uid', async (req, res) => {
  const config = getFirebaseConfig();
  const { uid } = req.params;
  try {
    const docPath = `projects/${config.projectId}/databases/(default)/documents/users/${uid}`;
    await fetch(`https://firestore.googleapis.com/v1/${docPath}`, { method: 'DELETE' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.use(express.static(PUBLIC_DIR));

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Ignite Chapel Membership running on http://${HOST}:${PORT}`);
});
