const firebaseConfig = {
    apiKey: "AIzaSyB3t8hT8mnXh8bqw5QsO1rYDaO3-MfX8fE",
    authDomain: "ignite-chapel-membership-app.firebaseapp.com",
    projectId: "ignite-chapel-membership-app",
    storageBucket: "ignite-chapel-membership-app.firebasestorage.app",
    messagingSenderId: "260200397046",
    appId: "1:260200397046:web:b0c2517d29dc012b9014d7"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
