/* ============================================
   BoomBoomMovie — Authentication
   ============================================ */

BBM.Auth = {
  currentUser: null,

  /** Inscription email/mot de passe */
  async register(email, password, displayName) {
    const cred = await BBM.auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: displayName || email.split('@')[0] });

    // Créer le document utilisateur dans Firestore
    await BBM.db.collection('users').doc(cred.user.uid).set({
      displayName: displayName || email.split('@')[0],
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      myList: [],
      continueWatching: {}
    });

    return cred.user;
  },

  /** Connexion email/mot de passe */
  async login(email, password) {
    const cred = await BBM.auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  },

  /** Réinitialisation du mot de passe */
  async resetPassword(email) {
    await BBM.auth.sendPasswordResetEmail(email);
  },

  /** Déconnexion */
  async logout() {
    await BBM.auth.signOut();
    window.location.href = 'index.html';
  },

  /** Écouter les changements d'état d'auth */
  onAuthStateChanged(callback) {
    BBM.auth.onAuthStateChanged((user) => {
      BBM.Auth.currentUser = user;
      callback(user);
    });
  },

  /** Rediriger si non connecté */
  requireAuth() {
    return new Promise((resolve) => {
      BBM.auth.onAuthStateChanged((user) => {
        if (!user) {
          window.location.href = 'index.html';
        } else {
          BBM.Auth.currentUser = user;
          resolve(user);
        }
      });
    });
  },

  /** Rediriger si déjà connecté (pour la page login) */
  redirectIfLoggedIn() {
    BBM.auth.onAuthStateChanged((user) => {
      if (user) {
        window.location.href = 'browse.html';
      }
    });
  },

  /** Vérifier si l'utilisateur est admin (champ admin: true dans Firestore) */
  async isAdmin() {
    const user = this.currentUser;
    if (!user) return false;
    try {
      const doc = await BBM.db.collection('users').doc(user.uid).get();
      return doc.exists && doc.data().admin === true;
    } catch (e) {
      return false;
    }
  },

  /** Obtenir les initiales pour l'avatar */
  getInitials() {
    const user = BBM.Auth.currentUser;
    if (!user) return '?';
    const name = user.displayName || user.email || '?';
    return name.charAt(0).toUpperCase();
  },

  /** Obtenir le nom d'affichage */
  getDisplayName() {
    const user = BBM.Auth.currentUser;
    if (!user) return 'Utilisateur';
    return user.displayName || user.email.split('@')[0];
  },

  /** Traduire les erreurs Firebase en français */
  translateError(code) {
    const errors = {
      'auth/email-already-in-use': 'Cette adresse email est déjà utilisée.',
      'auth/invalid-email': 'Adresse email invalide.',
      'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères.',
      'auth/user-not-found': 'Aucun compte trouvé avec cette adresse.',
      'auth/wrong-password': 'Mot de passe incorrect.',
      'auth/too-many-requests': 'Trop de tentatives. Réessaie plus tard.',
      'auth/network-request-failed': 'Erreur réseau. Vérifie ta connexion.',
      'auth/invalid-credential': 'Email ou mot de passe incorrect.'
    };
    return errors[code] || 'Une erreur est survenue. Réessaie.';
  }
};
