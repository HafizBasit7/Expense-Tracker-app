// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCy0q_DD14eX7XdKCYcDdwagtSrxSP4Ioc",
  authDomain: "expense-tracker-3d211.firebaseapp.com",
  projectId: "expense-tracker-3d211",
  storageBucket: "expense-tracker-3d211.firebasestorage.app",
  messagingSenderId: "73216675857",
  appId: "1:73216675857:web:dd1398602ab872c9ef61b0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// auth
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
})

//db
export const firestore = getFirestore(app);