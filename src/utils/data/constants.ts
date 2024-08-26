import { SuppliersData } from '../../types';

export const SUPPLIERS_DATA: SuppliersData = {
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
    },
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
      logoutBtn: '.account__leave-btn',
    },
  },
  patriot: {
    credentials: 'Кизим',
    cookieName: 'ptCookies',
    loginURL: 'https://optautotorg.com/',
    logoutURL: 'https://optautotorg.com/?logout',
    selectors: {
      loginForm: '#modalFormLogin',
      credentialsEl: 'a[href="https://x-orion.ru/lk"] span',
      emailUsernameField: '#email_auth',
      passwordField: '#password_auth',
      loginBtn: '.btn-login',
      logoutBtn: '.account__leave-btn',
    },
  },
  turboCars: {
    credentials: '32831',
    cookieName: 'turboCarsCookies',
    loginURL: 'https://turbo-cars.net/office/SECURE.asp',
    logoutURL: 'https://turbo-cars.net/office/login.asp?mode=new',
    selectors: {
      loginForm: 'a[data-bs-toggle="modal"]',
      credentialsEl: 'a[href="https://x-orion.ru/lk"] span',
      emailUsernameField: '#email_auth',
      passwordField: '#password_auth',
      loginBtn: '.btn-login',
      logoutBtn: '.account__leave-btn',
    },
  },
  armtek: {
    credentials: 'Кизим',
    cookieName: 'arCookies',
    loginURL: 'https://etp.armtek.by/search',
    logoutURL: '',
    selectors: {
      loginForm: 'a[data-bs-toggle="modal"]',
      credentialsEl: 'a[href="https://x-orion.ru/lk"] span',
      emailUsernameField: '#email_auth',
      passwordField: '#password_auth',
      loginBtn: '.btn-login',
      logoutBtn: '.account__leave-btn',
    },
  },
};

Object.freeze(SUPPLIERS_DATA);
