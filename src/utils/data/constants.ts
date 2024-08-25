export const SUPPLIERS_DATA = {
  patriot: {
    credentials: 'Кизим',
    cookieName: 'ptCookies',
    loginURL: 'https://optautotorg.com/',
    logoutURL: 'https://optautotorg.com/?logout',
  },
  turboCars: {
    credentials: '32831',
    cookieName: 'turboCarsCookies',
    loginURL: 'https://turbo-cars.net/office/SECURE.asp',
    logoutURL: 'https://turbo-cars.net/office/login.asp?mode=new',
  },
  ug: {
    credentials: '9447854',
    cookieName: 'ugCookies',
    loginURL: 'https://ugautopart.ru/?FranchiseeId=3993538',
    logoutURL: 'https://ugautopart.ru/?FranchiseeId=3993538&logout',
    deepSearchURL: 'https://ugautopart.ru/search?pcode=',
  },
  orion: {
    credentials: 'аккаунт',
    cookieName: 'orCookies',
    loginURL: 'https://x-orion.ru/login',
    logoutURL: 'https://x-orion.ru/logout',
    dashboardURL: 'https://x-orion.ru/lk',
    selectors: {
      loginForm: 'a[data-bs-toggle="modal"]',
      credentialsEl: 'a[href="https://x-orion.ru/lk"] span',
      emailUsernameField: '#email_auth',
      passwordField: '#password_auth',
      loginBtn: '.btn-login',
    },
  },
  armtek: {
    credentials: 'Кизим',
    cookieName: 'arCookies',
    loginURL: 'https://etp.armtek.by/search',
    logoutURL: '',
  },
};

Object.freeze(SUPPLIERS_DATA);
