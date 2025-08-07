// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDEpKODcHwa6nPY5sxafamEUO-g1-tlTwM",
    authDomain: "student-attendance-event.firebaseapp.com",
    databaseURL: "https://student-attendance-event-default-rtdb.firebaseio.com",  // ← Add this
    projectId: "student-attendance-event",
    storageBucket: "student-attendance-event.appspot.com",
    messagingSenderId: "122530145824",
    appId: "1:122530145824:web:0a79372284a8c76862be45"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get references to Firebase services
const auth = firebase.auth();
const database = firebase.database();

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
