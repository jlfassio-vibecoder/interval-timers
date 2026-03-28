/**
 * Strings for the roster welcome island only (not global i18n).
 */

export type WelcomeLocale = 'en' | 'es';

const STORAGE_KEY = 'welcome_locale';

export function getStoredWelcomeLocale(): WelcomeLocale {
  if (typeof window === 'undefined') return 'en';
  try {
    const v = localStorage.getItem(STORAGE_KEY)?.trim().toLowerCase();
    if (v === 'es') return 'es';
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
  scheduleNext7Days: string;
  scheduleReadOnly: string;
  scheduleEmpty: string;
  scheduleOpenToPlan: string;
  scheduleRetry: string;
  scheduleCouldNotLoad: string;
}

const EN: WelcomeLandingStrings = {
  brandSubtitle: 'HIIT Workout Timer',
  loadingInvitation: 'Loading invitation…',
  loadingInvitationDetails: 'Loading invitation details…',
  checkingSession: 'Checking session…',
  signInEmailPhone: 'Sign in with the email or phone you were invited with.',
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
  scheduleNext7Days: 'Next 7 days',
  scheduleReadOnly: 'Upcoming sessions on your calendar (read-only)',
  scheduleEmpty: 'No sessions scheduled this week.',
  scheduleOpenToPlan: 'Open app to plan',
  scheduleRetry: 'Retry',
  scheduleCouldNotLoad: 'Couldn’t load schedule',
};

const ES: WelcomeLandingStrings = {
  brandSubtitle: 'HIIT Workout Timer',
  loadingInvitation: 'Cargando invitación…',
  loadingInvitationDetails: 'Cargando detalles de la invitación…',
  checkingSession: 'Comprobando sesión…',
  signInEmailPhone: 'Inicia sesión con el correo o teléfono con el que te invitaron.',
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
  scheduleNext7Days: 'Próximos 7 días',
  scheduleReadOnly: 'Próximas sesiones en tu calendario (solo lectura)',
  scheduleEmpty: 'No hay sesiones programadas esta semana.',
  scheduleOpenToPlan: 'Abrir la app para planificar',
  scheduleRetry: 'Reintentar',
  scheduleCouldNotLoad: 'No se pudo cargar el calendario',
};

export function getWelcomeLandingStrings(locale: WelcomeLocale): WelcomeLandingStrings {
  return locale === 'es' ? ES : EN;
}
