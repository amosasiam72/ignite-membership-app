import http from 'http';

const API_KEY = 'AIzaSyB3t8hT8mnXh8bqw5QsO1rYDaO3-MfX8fE';
const PROJECT_ID = 'ignite-chapel-membership-app';

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function createAuthUser(email, password) {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to create auth user');
    return data;
}

async function createFirestoreDoc(uid, email, displayName, permissions, createdBy) {
    const fields = {
        email: { stringValue: email },
        role: { stringValue: 'admin' },
        permissions: { arrayValue: { values: permissions.map(p => ({ stringValue: p })) } },
        displayName: { stringValue: displayName || email.split('@')[0] },
        createdBy: { stringValue: createdBy || '' },
        createdAt: { stringValue: new Date().toISOString() },
        lastLogin: { nullValue: null }
    };
    const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
    const res = await fetch(`https://firestore.googleapis.com/v1/${docPath}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to create user profile');
    }
}

const server = http.createServer(async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (req.method === 'POST' && req.url === '/createAdmin') {
        let body = '';
        for await (const chunk of req) body += chunk;
        try {
            const { email, password, displayName, permissions } = JSON.parse(body);
            if (!email || !password) throw new Error('Email and password required');
            const authData = await createAuthUser(email, password);
            await createFirestoreDoc(authData.localId, email, displayName, permissions || [], '');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, uid: authData.localId, email }));
            console.log(`Created admin: ${email} (uid: ${authData.localId})`);
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    } else if (req.method === 'DELETE' && req.url.startsWith('/deleteUser/')) {
        const uid = req.url.split('/deleteUser/')[1];
        try {
            const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
            await fetch(`https://firestore.googleapis.com/v1/${docPath}`, { method: 'DELETE' });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            console.log(`Deleted user doc: ${uid}`);
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Admin server running on http://localhost:${PORT}`);
    console.log('Endpoints:');
    console.log('  POST /createAdmin  - Create a new admin user');
    console.log('  DELETE /deleteUser/:uid - Remove a user document');
    console.log('\nPress Ctrl+C to stop.');
});
