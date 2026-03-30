// js/auth.js
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { auth, db, isMock } from "./firebase-config.js";

let currentUser = null;
let currentAlias = null;

// Mock local storage for auth if firebase is not configured
const MOCK_STORAGE_KEY = "prode_mock_user";

export function initAuth(onUserChange) {
    if (isMock) {
        const stored = localStorage.getItem(MOCK_STORAGE_KEY);
        if (stored) {
            const user = JSON.parse(stored);
            currentUser = { uid: user.uid };
            currentAlias = user.alias;
            onUserChange(currentUser, currentAlias, user.score);
        } else {
            onUserChange(null, null, 0);
        }
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            // Get user alias from DB
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            let score = 0;
            if (userSnap.exists()) {
                currentAlias = userSnap.data().alias;
                score = userSnap.data().score || 0;
            }
            onUserChange(user, currentAlias, score);
        } else {
            currentUser = null;
            currentAlias = null;
            onUserChange(null, null, 0);
        }
    });
}

export async function loginWithAlias(alias) {
    if (!alias || alias.trim() === "") throw new Error("Alias inválido");
    
    if (isMock) {
        const mockUid = "mock_" + Math.random().toString(36).substr(2, 9);
        const userData = { uid: mockUid, alias: alias.trim(), score: 0 };
        localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(userData));
        setTimeout(() => location.reload(), 500);
        return;
    }

    try {
        const { user } = await signInAnonymously(auth);
        
        // Save user alias if new
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);
        
        if (!docSnap.exists()) {
            await setDoc(userRef, {
                alias: alias.trim(),
                score: 0,
                createdAt: serverTimestamp()
            });
        }
    } catch (error) {
        console.error("Login Error:", error);
        throw error;
    }
}

export function getCurrentUser() {
    return { user: currentUser, alias: currentAlias };
}
