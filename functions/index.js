/* ============================================
   BoomBoomMovie — Firebase Cloud Functions
   Email notifications for request approval
   ============================================

   PRÉREQUIS DE DÉPLOIEMENT
   1) Activer le plan Blaze sur le projet Firebase (pay-as-you-go).
      Sans ce plan les Cloud Functions ne peuvent pas être déployées.

   2) Initialiser le dossier functions si pas déjà fait :
        firebase init functions
      (choisir Node 20 ou 22, JavaScript, ESLint optionnel)

   3) Installer les dépendances :
        cd functions
        npm install firebase-admin firebase-functions nodemailer

   4) Configurer le compte SMTP. Deux options :

      A) Gmail (rapide, limité ~500 mails/jour) — créer un mot de passe
         d'application sur https://myaccount.google.com/apppasswords puis :
           firebase functions:config:set \
             smtp.host="smtp.gmail.com" \
             smtp.port="465" \
             smtp.user="ton.email@gmail.com" \
             smtp.pass="le-mot-de-passe-app-16-caracteres" \
             smtp.from="BoomBoomMovie <ton.email@gmail.com>"

      B) SendGrid / Mailgun / Brevo — recommandé pour la prod
         (limites + délivrabilité meilleures).

   5) Déployer :
        firebase deploy --only functions

   COMPORTEMENT
   - À chaque update sur un doc /requests/{id}, si status passe à
     "approved" ET que requestedBy a un email connu (collection users),
     un email est envoyé.
   - L'email contient le titre, un lien direct vers le contenu,
     et un footer avec lien de désabonnement (à venir).
   ============================================ */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

const SITE_URL = 'https://boomboommovie.live';

function getTransporter() {
  const cfg = functions.config().smtp || {};
  return nodemailer.createTransport({
    host: cfg.host,
    port: Number(cfg.port || 465),
    secure: Number(cfg.port || 465) === 465,
    auth: { user: cfg.user, pass: cfg.pass }
  });
}

exports.onRequestApproved = functions.firestore
  .document('requests/{requestId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only fire when status flips to 'approved'
    if (before.status === after.status) return null;
    if (after.status !== 'approved') return null;

    const uid = after.requestedBy;
    if (!uid) return null;

    // Lookup the user's email + display name
    const userSnap = await admin.firestore().collection('users').doc(uid).get();
    if (!userSnap.exists) return null;
    const user = userSnap.data();
    const email = user.email;
    if (!email) return null;

    const cfg = functions.config().smtp || {};
    const transporter = getTransporter();

    const title = after.title || 'votre demande';
    const tmdbID = after.tmdbID;
    const link = tmdbID ? `${SITE_URL}/browse.html?tmdbid=${tmdbID}` : SITE_URL;
    const displayName = user.displayName || 'cher cinéphile';

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#0e0e10;color:#fff;padding:32px;border-radius:12px">
        <div style="font-size:13px;letter-spacing:.15em;color:#a78bfa;text-transform:uppercase;font-weight:700">BoomBoomMovie</div>
        <h1 style="font-size:26px;margin:8px 0 16px;color:#fff">🎬 ${title} est disponible</h1>
        <p style="color:#bababa;line-height:1.6">Salut ${displayName},</p>
        <p style="color:#bababa;line-height:1.6">Bonne nouvelle — la demande que tu as faite a été approuvée et le contenu est maintenant disponible sur BoomBoomMovie.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#8b5cf6;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Regarder maintenant →</a>
        </p>
        <p style="color:#666;font-size:12px;margin-top:32px;border-top:1px solid #222;padding-top:16px">
          Tu reçois cet email parce que tu as fait une demande sur BoomBoomMovie. Pour ne plus recevoir ces notifications, désactive les emails dans tes paramètres.
        </p>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: cfg.from || cfg.user,
        to: email,
        subject: `🎬 ${title} est disponible sur BoomBoomMovie`,
        html
      });
      console.log(`Approval email sent to ${email} for request ${context.params.requestId}`);
    } catch (err) {
      console.error('Failed to send approval email:', err);
    }
    return null;
  });
