const firebaseConfig = (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__) || {
    apiKey: "",
    authDomain: "ignite-chapel-membership-app.firebaseapp.com",
    projectId: "ignite-chapel-membership-app",
    storageBucket: "ignite-chapel-membership-app.firebasestorage.app",
    messagingSenderId: "260200397046",
    appId: "1:260200397046:web:b0c2517d29dc012b9014d7"
};

let auth;
let db;

if (firebaseConfig.apiKey && typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
} else {
    console.warn('[AI Studio] FIREBASE_API_KEY is not set — running with offline fallback stubs.');
    const createSnap = (docs = []) => ({
        empty: docs.length === 0,
        size: docs.length,
        docs,
        forEach: (fn) => docs.forEach(fn)
    });
    const makeCollection = () => ({
        get: async () => createSnap([]),
        where: () => makeCollection(),
        orderBy: () => makeCollection(),
        limit: () => makeCollection(),
        add: async () => { throw new Error('Firebase is not configured. Set FIREBASE_API_KEY in environment.'); },
        doc: () => ({
            get: async () => ({ exists: false, data: () => ({}) }),
            set: async () => { throw new Error('Firebase is not configured. Set FIREBASE_API_KEY in environment.'); },
            update: async () => { throw new Error('Firebase is not configured. Set FIREBASE_API_KEY in environment.'); },
            delete: async () => { throw new Error('Firebase is not configured. Set FIREBASE_API_KEY in environment.'); }
        })
    });
    auth = {
        onAuthStateChanged: (cb) => { setTimeout(() => cb(null), 0); return () => {}; },
        signInWithEmailAndPassword: async () => {
            throw new Error('Firebase API key not configured. Set FIREBASE_API_KEY in environment.');
        },
        signOut: async () => {}
    };
    db = {
        collection: () => makeCollection()
    };
}

