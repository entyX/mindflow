import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAGS1jQxzbjzS0ckWQtRoZz1WAqr2wrw1U",
  authDomain: "mindflowai-431c8.firebaseapp.com",
  projectId: "mindflowai-431c8",
  storageBucket: "mindflowai-431c8.firebasestorage.app",
  messagingSenderId: "446226047471",
  appId: "1:446226047471:web:19926cc544b69acf94d61a",
  measurementId: "G-N71KR4LJYK",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
