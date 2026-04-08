/* ============================================
   BoomBoomMovie — Configuration
   ============================================ */

const BBM = window.BBM || {};

BBM.Config = {
  firebase: {
    apiKey: "AIzaSyCx7cA7dWH7F1W50TsWYLUQJjhVrIfmjwg",
    authDomain: "boomboommovie.firebaseapp.com",
    projectId: "boomboommovie",
    storageBucket: "boomboommovie.firebasestorage.app",
    messagingSenderId: "808365315379",
    appId: "1:808365315379:web:d0fa8881866cbe6fe31a46",
    measurementId: "G-2CM6YKDWMJ"
  },

  workerAPI: "https://liste-films-api.alanplokain.workers.dev/",

  tmdb: {
    apiKey: "05fa26f220d025af589338dc695b75ad",
    baseURL: "https://api.themoviedb.org/3",
    imageBase: "https://image.tmdb.org/t/p",
    language: "fr-FR"
  },

  // Image sizes
  posterSize: "w500",
  backdropSize: "original",
  profileSize: "w185",

  // Cache TTL (24h)
  cacheTTL: 24 * 60 * 60 * 1000,

  // Admin UIDs — ajoute ton UID Firebase ici
  adminUIDs: [
    "hD6Dzha6Y2WLL5YuC95UAeoImOC3", // Alan
    "mU5EDUS7k7N5CHf4UwULD9yg0pF3", // Pierre
    "blTqQi0VXfW0zEyh4MXDqe8rstD3" // Adrien
  ]
};

/*
   ============================================
   FIREBASE FIRESTORE — Structure attendue
   ============================================
   
   Avant d'utiliser le site, configure Firestore dans la console Firebase :
   
   1. Va dans Firebase Console > Firestore Database > Create Database
   2. Choisis "Start in test mode" ou applique ces règles :

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       match /requests/{requestId} {
         allow create: if request.auth != null;
         allow read: if request.auth != null && (resource.data.requestedBy == request.auth.uid || request.auth.uid in ['TON_UID_ICI']);
         allow update, delete: if request.auth != null && request.auth.uid in ['TON_UID_ICI'];
       }
     }
   }

   3. Active Authentication > Sign-in method > Email/Password

   Structure des documents :
   
   users/{uid}
     - displayName: string
     - email: string
     - createdAt: timestamp
     - myList: []          // tableau de tmdbID (strings)
     - continueWatching: {} // map { tmdbID: { progress, duration, category, season, episode, updatedAt } }
*/

// Initialize Firebase
firebase.initializeApp(BBM.Config.firebase);
BBM.auth = firebase.auth();
BBM.db = firebase.firestore();

window.BBM = BBM;
