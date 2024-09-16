import { SuppliersData } from 'types';

export const SUPPLIERS_DATA: SuppliersData = {
  turboCars: {
    credentials: '32831',
    cookieName: 'turboCarsCookies',
    loginURL: 'https://turbo-cars.net/office/',
    dashboardURL: 'https://turbo-cars.net/office/News.asp',
    logoutURL: 'https://turbo-cars.net/office/login.asp?mode=new',
    selectors: {
      loginForm: 'a[data-bs-toggle="modal"]',
      credentialsEl: '#t',
      emailUsernameField: '#CODE',
      passwordField: '#Password1',
      loginBtn: 'input[type="submit"]',
      logoutBtn: 'a[href="login.asp?mode=new"]',
      input: '',
    },
  },
  ug: {
    credentials: 'Кизим',
    cookieName: 'ugCookies',
    loginURL: 'https://ugautopart.ru/',
    logoutURL: 'https://ugautopart.ru/?FranchiseeId=3993538&logout',
    deepSearchURL: 'https://ugautopart.ru/search?pcode=',
    selectors: {
      loginForm: '.loginForm',
      credentialsEl: '#modalFormLogin',
      emailUsernameField: '#login_modal',
      passwordField: '#pass_modal',
      loginBtn: '.submitButton',
      logoutBtn: '.exit',
      input: '.ui-autocomplete-input',
    },
  },
};

Object.freeze(SUPPLIERS_DATA);

export const HEADLESS_SETTINGS = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
  language: {
    'accept-language': 'ru-RU,ru;q=0.9',
  },
};

Object.freeze(HEADLESS_SETTINGS);
