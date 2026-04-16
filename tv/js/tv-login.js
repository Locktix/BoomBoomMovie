/* ============================================
   BoomBoomMovie TV — Login
   ============================================ */

(() => {
  let isLogin = true;

  const form = document.getElementById('auth-form');
  const nameGroup = document.getElementById('name-group');
  const inputName = document.getElementById('input-name');
  const inputEmail = document.getElementById('input-email');
  const inputPassword = document.getElementById('input-password');
  const btnSubmit = document.getElementById('btn-submit');
  const toggleText = document.getElementById('toggle-text');
  const toggleLink = document.getElementById('toggle-link');
  const errorEl = document.getElementById('error');
  const subtitleEl = document.getElementById('subtitle');

  // If already logged in, go straight to browse
  BBM.auth.onAuthStateChanged((user) => {
    if (user) {
      window.location.href = 'browse.html';
    }
  });

  function setMode(login) {
    isLogin = login;
    if (isLogin) {
      subtitleEl.textContent = 'Connecte-toi pour accéder à ton espace';
      btnSubmit.textContent = "S'identifier";
      toggleText.textContent = 'Nouveau sur BoomBoomMovie ?';
      toggleLink.textContent = 'Inscris-toi.';
      nameGroup.style.display = 'none';
      inputPassword.autocomplete = 'current-password';
    } else {
      subtitleEl.textContent = 'Crée ton compte en quelques secondes';
      btnSubmit.textContent = "S'inscrire";
      toggleText.textContent = 'Déjà un compte ?';
      toggleLink.textContent = 'Connecte-toi.';
      nameGroup.style.display = 'block';
      inputPassword.autocomplete = 'new-password';
    }
    errorEl.classList.remove('show');
  }

  toggleLink.addEventListener('click', () => setMode(!isLogin));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = inputEmail.value.trim();
    const password = inputPassword.value;
    const name = inputName.value.trim();

    if (!email || !password) return;

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Chargement...';
    errorEl.classList.remove('show');

    try {
      if (isLogin) {
        await BBM.Auth.login(email, password);
      } else {
        await BBM.Auth.register(email, password, name);
      }
      window.location.href = 'browse.html';
    } catch (err) {
      errorEl.textContent = BBM.Auth.translateError(err.code);
      errorEl.classList.add('show');
      btnSubmit.disabled = false;
      btnSubmit.textContent = isLogin ? "S'identifier" : "S'inscrire";
    }
  });
})();
