import { initializeApp } from 'firebase/app';
import {
    getFirestore, doc, setDoc, getDoc
} from 'firebase/firestore';

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

/* ─── Document ID for the project data ─────────────────────── */
const PROJECT_DOC = 'default';   // single-project mode

/* ─── Save project data to Firestore ───────────────────────── */
export async function saveToFirestore(data) {
    try {
        await setDoc(doc(db, 'projects', PROJECT_DOC), {
            ...data,
            updatedAt: new Date().toISOString(),
        });
        return true;
    } catch (err) {
        console.error('[Firebase] Save failed:', err);
        return false;
    }
}

/* ─── Load project data from Firestore ─────────────────────── */
export async function loadFromFirestore() {
    try {
        const snap = await getDoc(doc(db, 'projects', PROJECT_DOC));
        if (snap.exists()) return snap.data();
        return null;
    } catch (err) {
        console.error('[Firebase] Load failed:', err);
        return null;
    }
}

export { db };
