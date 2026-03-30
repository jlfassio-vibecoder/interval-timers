/**
 * Strings for the roster welcome island only (not global i18n).
 */

export type WelcomeLocale = 'en' | 'es' | 'fr';

const STORAGE_KEY = 'welcome_locale';

export function getStoredWelcomeLocale(): WelcomeLocale {
  if (typeof window === 'undefined') return 'en';
  try {
    const v = localStorage.getItem(STORAGE_KEY)?.trim().toLowerCase();
    if (v === 'es') return 'es';
    if (v === 'fr') return 'fr';
  } catch {
    /* private mode */
  }
  return 'en';
}

export function setStoredWelcomeLocale(locale: WelcomeLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* private mode */
  }
}

export interface WelcomeLandingStrings {
  brandSubtitle: string;
  loadingInvitation: string;
  loadingInvitationDetails: string;
  checkingSession: string;
  signInEmailPhone: string;
  /** Shown in the status strip for trainer (client) roster invites when signed out. */
  clientInviteStatusStrip: string;
  /** Reopen the create-account modal after the user closed it (client invites). */
  clientOpenSignupCta: string;
  /** Opens auth modal on the log-in tab (client invites). */
  clientLogInInsteadCta: string;
  finishingSetup: string;
  invitedBy: string;
  invitedAt: string;
  kindFriendSub: string;
  kindClientSub: string;
  signInToAccept: string;
  signInSameContact: string;
  acceptSuccessFriend: string;
  acceptSuccessClient: string;
  openApp: string;
  missionControl: string;
  couldNotAccept: string;
  signInInvitedEmailRefresh: string;
  footerPrivacy: string;
  footerTerms: string;
  footerWrongPerson: string;
  footerWrongPersonSignOut: string;
  footerWrongPersonSignedOut: string;
  localeLabel: string;
  localeEn: string;
  localeEs: string;
  localeFr: string;
  scheduleNext7Days: string;
  scheduleReadOnly: string;
  scheduleEmpty: string;
  scheduleOpenToPlan: string;
  scheduleRetry: string;
  scheduleCouldNotLoad: string;
  /**
   * Logged-in /welcome hero (no invite token). Use `{name}` for the trainer’s first name.
   */
  welcomeLoggedInTrainerTeaser: string;
  /** Badge label for unified calendar event type `program` on /welcome schedule preview. */
  scheduleEventProgram: string;
  scheduleEventAmrap: string;
  scheduleEventTimer: string;
  /** Fallback badge when `type` is unknown. */
  scheduleEventOther: string;
  /** Footer CTA when the week list has sessions (opens app home). */
  scheduleSeeFullCalendar: string;
  /** Logged-in /welcome when user has more than one active program enrollment. */
  welcomeMultipleProgramsHint: string;
}

/** Subset passed into WelcomeSchedulePreview (avoids dummy empty fields). */
export type WelcomeSchedulePreviewStrings = Pick<
  WelcomeLandingStrings,
  | 'scheduleNext7Days'
  | 'scheduleReadOnly'
  | 'scheduleEmpty'
  | 'scheduleOpenToPlan'
  | 'scheduleRetry'
  | 'scheduleCouldNotLoad'
  | 'scheduleEventProgram'
  | 'scheduleEventAmrap'
  | 'scheduleEventTimer'
  | 'scheduleEventOther'
  | 'scheduleSeeFullCalendar'
>;

const EN: WelcomeLandingStrings = {
  brandSubtitle: 'HIIT Workout Timer',
  loadingInvitation: 'Loading invitation…',
  loadingInvitationDetails: 'Loading invitation details…',
  checkingSession: 'Checking session…',
  signInEmailPhone: 'Sign in with the email or phone you were invited with.',
  clientInviteStatusStrip:
    'Create your account with your invited email, or log in if you already have one.',
  clientOpenSignupCta: 'Open create account',
  clientLogInInsteadCta: 'Already have an account? Log in',
  finishingSetup: 'Finishing setup…',
  invitedBy: 'Invited by',
  invitedAt: 'at',
  kindFriendSub: 'Connect as a friend on their roster.',
  kindClientSub: 'Join their training programs as a client.',
  signInToAccept: 'Sign in to accept',
  signInSameContact: 'Use the same email or phone you were invited with.',
  acceptSuccessFriend: "You're in — invitation accepted (friend).",
  acceptSuccessClient: "You're in — invitation accepted (client).",
  openApp: 'Open app',
  missionControl: 'Mission Control',
  couldNotAccept: 'Could not accept invitation.',
  signInInvitedEmailRefresh:
    'Sign in with the invited email, then refresh this page if acceptance does not complete.',
  footerPrivacy: 'Privacy',
  footerTerms: 'Terms',
  footerWrongPerson: 'Wrong person?',
  footerWrongPersonSignOut: 'Sign out',
  footerWrongPersonSignedOut: 'Use Sign in with the account that received the invite.',
  localeLabel: 'Language',
  localeEn: 'EN',
  localeEs: 'ES',
  localeFr: 'FR',
  scheduleNext7Days: 'Next 7 days',
  scheduleReadOnly: 'Upcoming sessions on your calendar (read-only)',
  scheduleEmpty: 'No sessions scheduled this week.',
  scheduleOpenToPlan: 'Open app to plan',
  scheduleRetry: 'Retry',
  scheduleCouldNotLoad: 'Couldn’t load schedule',
  welcomeLoggedInTrainerTeaser: "Here's what {name} has planned for you this week.",
  scheduleEventProgram: 'Program',
  scheduleEventAmrap: 'AMRAP',
  scheduleEventTimer: 'Timer',
  scheduleEventOther: 'Session',
  scheduleSeeFullCalendar: 'See full calendar in the app',
  welcomeMultipleProgramsHint:
    'You have more than one active program — switch programs in the app if this week looks off.',
};

const ES: WelcomeLandingStrings = {
  brandSubtitle: 'HIIT Workout Timer',
  loadingInvitation: 'Cargando invitación…',
  loadingInvitationDetails: 'Cargando detalles de la invitación…',
  checkingSession: 'Comprobando sesión…',
  signInEmailPhone: 'Inicia sesión con el correo o teléfono con el que te invitaron.',
  clientInviteStatusStrip:
    'Crea tu cuenta con el correo invitado, o inicia sesión si ya tienes una.',
  clientOpenSignupCta: 'Abrir crear cuenta',
  clientLogInInsteadCta: '¿Ya tienes cuenta? Iniciar sesión',
  finishingSetup: 'Finalizando configuración…',
  invitedBy: 'Invitación de',
  invitedAt: 'en',
  kindFriendSub: 'Conéctate como amigo en su lista.',
  kindClientSub: 'Únete a sus programas como cliente.',
  signInToAccept: 'Iniciar sesión para aceptar',
  signInSameContact: 'Usa el mismo correo o teléfono con el que te invitaron.',
  acceptSuccessFriend: 'Listo — invitación aceptada (amigo).',
  acceptSuccessClient: 'Listo — invitación aceptada (cliente).',
  openApp: 'Abrir app',
  missionControl: 'Mission Control',
  couldNotAccept: 'No se pudo aceptar la invitación.',
  signInInvitedEmailRefresh:
    'Inicia sesión con el correo invitado y actualiza la página si no se completa.',
  footerPrivacy: 'Privacidad',
  footerTerms: 'Términos',
  footerWrongPerson: '¿No eres tú?',
  footerWrongPersonSignOut: 'Cerrar sesión',
  footerWrongPersonSignedOut: 'Inicia sesión con la cuenta que recibió la invitación.',
  localeLabel: 'Idioma',
  localeEn: 'EN',
  localeEs: 'ES',
  localeFr: 'FR',
  scheduleNext7Days: 'Próximos 7 días',
  scheduleReadOnly: 'Próximas sesiones en tu calendario (solo lectura)',
  scheduleEmpty: 'No hay sesiones programadas esta semana.',
  scheduleOpenToPlan: 'Abrir la app para planificar',
  scheduleRetry: 'Reintentar',
  scheduleCouldNotLoad: 'No se pudo cargar el calendario',
  welcomeLoggedInTrainerTeaser: 'Esto es lo que {name} ha planeado para ti esta semana.',
  scheduleEventProgram: 'Programa',
  scheduleEventAmrap: 'AMRAP',
  scheduleEventTimer: 'Temporizador',
  scheduleEventOther: 'Sesión',
  scheduleSeeFullCalendar: 'Ver el calendario completo en la app',
  welcomeMultipleProgramsHint:
    'Tienes más de un programa activo — cambia de programa en la app si esta semana no cuadra.',
};

const FR: WelcomeLandingStrings = {
  brandSubtitle: 'HIIT Workout Timer',
  loadingInvitation: 'Chargement de l’invitation…',
  loadingInvitationDetails: 'Chargement des détails…',
  checkingSession: 'Vérification de la session…',
  signInEmailPhone: 'Connectez-vous avec l’e-mail ou le numéro avec lequel vous avez été invité.',
  clientInviteStatusStrip:
    'Créez votre compte avec l’e-mail invité, ou connectez-vous si vous en avez déjà un.',
  clientOpenSignupCta: 'Créer un compte',
  clientLogInInsteadCta: 'Déjà un compte ? Se connecter',
  finishingSetup: 'Finalisation…',
  invitedBy: 'Invitation de',
  invitedAt: 'chez',
  kindFriendSub: 'Connectez-vous en tant qu’ami sur sa liste.',
  kindClientSub: 'Rejoignez ses programmes en tant que client.',
  signInToAccept: 'Se connecter pour accepter',
  signInSameContact: 'Utilisez le même e-mail ou numéro que pour l’invitation.',
  acceptSuccessFriend: 'C’est fait — invitation acceptée (ami).',
  acceptSuccessClient: 'C’est fait — invitation acceptée (client).',
  openApp: 'Ouvrir l’app',
  missionControl: 'Mission Control',
  couldNotAccept: 'Impossible d’accepter l’invitation.',
  signInInvitedEmailRefresh:
    'Connectez-vous avec l’e-mail invité, puis actualisez la page si l’acceptation ne se termine pas.',
  footerPrivacy: 'Confidentialité',
  footerTerms: 'Conditions',
  footerWrongPerson: 'Ce n’est pas vous ?',
  footerWrongPersonSignOut: 'Se déconnecter',
  footerWrongPersonSignedOut: 'Connectez-vous avec le compte qui a reçu l’invitation.',
  localeLabel: 'Langue',
  localeEn: 'EN',
  localeEs: 'ES',
  localeFr: 'FR',
  scheduleNext7Days: '7 prochains jours',
  scheduleReadOnly: 'Séances à venir sur votre calendrier (lecture seule)',
  scheduleEmpty: 'Aucune séance prévue cette semaine.',
  scheduleOpenToPlan: 'Ouvrir l’app pour planifier',
  scheduleRetry: 'Réessayer',
  scheduleCouldNotLoad: 'Impossible de charger le calendrier',
  welcomeLoggedInTrainerTeaser: 'Voici ce que {name} a prévu pour vous cette semaine.',
  scheduleEventProgram: 'Programme',
  scheduleEventAmrap: 'AMRAP',
  scheduleEventTimer: 'Minuteur',
  scheduleEventOther: 'Séance',
  scheduleSeeFullCalendar: 'Voir le calendrier complet dans l’app',
  welcomeMultipleProgramsHint:
    'Vous avez plusieurs programmes actifs — changez de programme dans l’app si cette semaine ne correspond pas.',
};

export function getWelcomeLandingStrings(locale: WelcomeLocale): WelcomeLandingStrings {
  if (locale === 'es') return ES;
  if (locale === 'fr') return FR;
  return EN;
}

/** First word of trainer display name for welcome teaser (e.g. "Jane Doe" → "Jane"). */
export function trainerFirstNameForWelcome(displayName: string | null | undefined): string | null {
  if (!displayName?.trim()) return null;
  const first = displayName.trim().split(/\s+/)[0];
  return first || null;
}
