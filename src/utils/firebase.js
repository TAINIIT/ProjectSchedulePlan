import { initializeApp } from 'firebase/app';
import {
    getFirestore, doc, setDoc, getDoc
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

/* ─── Firebase config ──────────────────────────────────────── */
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FB_API_KEY || "AIzaSyAKAM7LnUTMU7SLdqKrjcY639K4ko0VTaE",
    authDomain: "projectscheduleplan.firebaseapp.com",
    projectId: import.meta.env.VITE_FB_PROJECT_ID || "projectscheduleplan",
    storageBucket: "projectscheduleplan.firebasestorage.app",
    messagingSenderId: "783911677881",
    appId: "1:783911677881:web:51164ad31b10d81afc5068",
    measurementId: "G-K3ER7CG6HZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

/* ─── Document ID for the project data ─────────────────────── */
// Use 'default' fallback, but ideally we use user-specific IDs
const DEFAULT_DOC = 'default';

/* ─── Save project data to Firestore ───────────────────────── */
export async function saveToFirestore(data, userId = null) {
    try {
        const docId = userId ? `user_${userId}` : DEFAULT_DOC;
        await setDoc(doc(db, 'projects', docId), {
            ...data,
            ownerId: userId,
            updatedAt: new Date().toISOString(),
        });
        return true;
    } catch (err) {
        console.error('[Firebase] Save failed:', err);
        return false;
    }
}

/* ─── Load project data from Firestore ─────────────────────── */
export async function loadFromFirestore(userId = null) {
    try {
        const docId = userId ? `user_${userId}` : DEFAULT_DOC;
        const snap = await getDoc(doc(db, 'projects', docId));
        if (snap.exists()) return snap.data();
        return null;
    } catch (err) {
        console.error('[Firebase] Load failed:', err);
        return null; // Return null to handle empty state in UI
    }
}

export { db, auth, googleProvider };
export { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
