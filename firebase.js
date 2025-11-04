// firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyAQFT-1tPwh1VuUnSyYuJ-NAxrF7HicnO8",
  authDomain: "smart-habit-tracker-tritech.firebaseapp.com",
  projectId: "smart-habit-tracker-tritech",
  storageBucket: "smart-habit-tracker-tritech.appspot.com",
  messagingSenderId: "317885108789",
  appId: "1:317885108789:web:1ba4d4da70af03b965177c",
  measurementId: "G-YDRLW99F49"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Make available globally
window.auth = auth;
window.db = db;
